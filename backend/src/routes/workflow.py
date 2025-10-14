from flask import Blueprint, request, jsonify
from src.database import db
from src.models.workflow import (
    WorkflowSpace, WorkflowSpaceMember, WorkflowPromptAssociation,
    PromptVersion, Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution
)
from src.models.chat import PromptTemplate
from src.routes.auth import get_current_user
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)

workflow_bp = Blueprint('workflow', __name__)


# Workflow Space endpoints
@workflow_bp.route('/workspaces', methods=['GET'])
def get_workspaces():
    """Get all workflow spaces accessible to the current user"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Get owned workspaces
    owned = WorkflowSpace.query.filter_by(owner_id=current_user.id).all()
    
    # Get workspaces where user is a member
    memberships = WorkflowSpaceMember.query.filter_by(user_id=current_user.id).all()
    member_spaces = [WorkflowSpace.query.get(m.workspace_id) for m in memberships]
    
    # Combine and deduplicate
    all_spaces = {ws.id: ws for ws in owned + member_spaces if ws}
    
    return jsonify([ws.to_dict() for ws in all_spaces.values()])


@workflow_bp.route('/workspaces', methods=['POST'])
def create_workspace():
    """Create a new workflow space"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.get_json()
    name = data.get('name')
    description = data.get('description', '')
    is_public = data.get('is_public', False)

    if not name:
        return jsonify({'error': 'Name is required'}), 400

    try:
        workspace = WorkflowSpace(
            name=name,
            description=description,
            owner_id=current_user.id,
            is_public=is_public
        )
        db.session.add(workspace)
        db.session.flush()
        
        # Add owner as member
        member = WorkflowSpaceMember(
            workspace_id=workspace.id,
            user_id=current_user.id,
            role='owner'
        )
        db.session.add(member)
        db.session.commit()
        
        return jsonify(workspace.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating workspace: {e}")
        return jsonify({'error': 'Failed to create workspace'}), 500


@workflow_bp.route('/workspaces/<int:workspace_id>', methods=['GET'])
def get_workspace(workspace_id):
    """Get a specific workflow space with details"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Check access
    if workspace.owner_id != current_user.id and not workspace.is_public:
        member = WorkflowSpaceMember.query.filter_by(
            workspace_id=workspace_id,
            user_id=current_user.id
        ).first()
        if not member:
            return jsonify({'error': 'Access denied'}), 403

    # Get associated prompts
    associations = WorkflowPromptAssociation.query.filter_by(
        workspace_id=workspace_id
    ).order_by(WorkflowPromptAssociation.position).all()
    
    prompts = []
    for assoc in associations:
        prompt = PromptTemplate.query.get(assoc.prompt_id)
        if prompt:
            prompt_data = prompt.to_dict()
            prompt_data['position'] = assoc.position
            prompts.append(prompt_data)

    result = workspace.to_dict()
    result['prompts'] = prompts
    result['members'] = [m.to_dict() for m in workspace.members]
    
    return jsonify(result)


@workflow_bp.route('/workspaces/<int:workspace_id>', methods=['PUT'])
def update_workspace(workspace_id):
    """Update a workflow space"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Check if user is owner or editor
    if workspace.owner_id != current_user.id:
        member = WorkflowSpaceMember.query.filter_by(
            workspace_id=workspace_id,
            user_id=current_user.id
        ).first()
        if not member or member.role not in ['owner', 'editor']:
            return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json()
    
    try:
        if 'name' in data:
            workspace.name = data['name']
        if 'description' in data:
            workspace.description = data['description']
        if 'is_public' in data:
            workspace.is_public = data['is_public']
        
        workspace.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(workspace.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating workspace: {e}")
        return jsonify({'error': 'Failed to update workspace'}), 500


@workflow_bp.route('/workspaces/<int:workspace_id>', methods=['DELETE'])
def delete_workspace(workspace_id):
    """Delete a workflow space"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Only owner can delete
    if workspace.owner_id != current_user.id:
        return jsonify({'error': 'Only owner can delete workspace'}), 403

    try:
        db.session.delete(workspace)
        db.session.commit()
        return jsonify({'message': 'Workspace deleted successfully'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting workspace: {e}")
        return jsonify({'error': 'Failed to delete workspace'}), 500


# Workspace members endpoints
@workflow_bp.route('/workspaces/<int:workspace_id>/members', methods=['POST'])
def add_member(workspace_id):
    """Add a member to a workflow space"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Check if user is owner or editor
    if workspace.owner_id != current_user.id:
        member = WorkflowSpaceMember.query.filter_by(
            workspace_id=workspace_id,
            user_id=current_user.id
        ).first()
        if not member or member.role not in ['owner', 'editor']:
            return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json()
    user_id = data.get('user_id')
    role = data.get('role', 'member')

    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400

    try:
        new_member = WorkflowSpaceMember(
            workspace_id=workspace_id,
            user_id=user_id,
            role=role
        )
        db.session.add(new_member)
        db.session.commit()
        
        return jsonify(new_member.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding member: {e}")
        return jsonify({'error': 'Failed to add member'}), 500


@workflow_bp.route('/workspaces/<int:workspace_id>/members/<int:member_id>', methods=['DELETE'])
def remove_member(workspace_id, member_id):
    """Remove a member from a workflow space"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Check if user is owner
    if workspace.owner_id != current_user.id:
        return jsonify({'error': 'Only owner can remove members'}), 403

    member = WorkflowSpaceMember.query.get(member_id)
    if not member or member.workspace_id != workspace_id:
        return jsonify({'error': 'Member not found'}), 404

    try:
        db.session.delete(member)
        db.session.commit()
        return jsonify({'message': 'Member removed successfully'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error removing member: {e}")
        return jsonify({'error': 'Failed to remove member'}), 500


# Workspace prompts endpoints
@workflow_bp.route('/workspaces/<int:workspace_id>/prompts', methods=['POST'])
def add_prompt_to_workspace(workspace_id):
    """Add a prompt to a workflow space"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Check if user has access
    if workspace.owner_id != current_user.id:
        member = WorkflowSpaceMember.query.filter_by(
            workspace_id=workspace_id,
            user_id=current_user.id
        ).first()
        if not member:
            return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    prompt_id = data.get('prompt_id')
    position = data.get('position', 0)

    if not prompt_id:
        return jsonify({'error': 'Prompt ID is required'}), 400

    try:
        association = WorkflowPromptAssociation(
            workspace_id=workspace_id,
            prompt_id=prompt_id,
            position=position
        )
        db.session.add(association)
        db.session.commit()
        
        return jsonify(association.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding prompt to workspace: {e}")
        return jsonify({'error': 'Failed to add prompt to workspace'}), 500


@workflow_bp.route('/workspaces/<int:workspace_id>/prompts/<int:association_id>', methods=['DELETE'])
def remove_prompt_from_workspace(workspace_id, association_id):
    """Remove a prompt from a workflow space"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Check if user has access
    if workspace.owner_id != current_user.id:
        member = WorkflowSpaceMember.query.filter_by(
            workspace_id=workspace_id,
            user_id=current_user.id
        ).first()
        if not member or member.role not in ['owner', 'editor']:
            return jsonify({'error': 'Insufficient permissions'}), 403

    association = WorkflowPromptAssociation.query.get(association_id)
    if not association or association.workspace_id != workspace_id:
        return jsonify({'error': 'Association not found'}), 404

    try:
        db.session.delete(association)
        db.session.commit()
        return jsonify({'message': 'Prompt removed from workspace successfully'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error removing prompt from workspace: {e}")
        return jsonify({'error': 'Failed to remove prompt from workspace'}), 500


# Prompt version endpoints
@workflow_bp.route('/prompts/<int:prompt_id>/versions', methods=['GET'])
def get_prompt_versions(prompt_id):
    """Get all versions of a prompt"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    prompt = PromptTemplate.query.get(prompt_id)
    if not prompt:
        return jsonify({'error': 'Prompt not found'}), 404

    versions = PromptVersion.query.filter_by(
        prompt_id=prompt_id
    ).order_by(PromptVersion.version_number.desc()).all()

    return jsonify([v.to_dict() for v in versions])


@workflow_bp.route('/prompts/<int:prompt_id>/versions', methods=['POST'])
def create_prompt_version(prompt_id):
    """Create a new version of a prompt"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    prompt = PromptTemplate.query.get(prompt_id)
    if not prompt:
        return jsonify({'error': 'Prompt not found'}), 404

    if prompt.user_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    commit_message = data.get('commit_message', 'Update prompt')

    try:
        # Get the latest version number
        latest_version = PromptVersion.query.filter_by(
            prompt_id=prompt_id
        ).order_by(PromptVersion.version_number.desc()).first()
        
        version_number = (latest_version.version_number + 1) if latest_version else 1

        # Create new version
        version = PromptVersion(
            prompt_id=prompt_id,
            version_number=version_number,
            content=prompt.content,
            title=prompt.title,
            category=prompt.category,
            tags=prompt.tags,
            commit_message=commit_message,
            author_id=current_user.id
        )
        db.session.add(version)
        db.session.commit()
        
        return jsonify(version.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating prompt version: {e}")
        return jsonify({'error': 'Failed to create prompt version'}), 500


@workflow_bp.route('/prompts/<int:prompt_id>/versions/<int:version_id>/restore', methods=['POST'])
def restore_prompt_version(prompt_id, version_id):
    """Restore a prompt to a specific version"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    prompt = PromptTemplate.query.get(prompt_id)
    if not prompt:
        return jsonify({'error': 'Prompt not found'}), 404

    if prompt.user_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403

    version = PromptVersion.query.get(version_id)
    if not version or version.prompt_id != prompt_id:
        return jsonify({'error': 'Version not found'}), 404

    try:
        # Restore prompt to this version
        prompt.content = version.content
        prompt.title = version.title
        prompt.category = version.category
        prompt.tags = version.tags
        prompt.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify(prompt.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error restoring prompt version: {e}")
        return jsonify({'error': 'Failed to restore prompt version'}), 500


# Workflow (DFG) endpoints
@workflow_bp.route('/workspaces/<int:workspace_id>/workflows', methods=['GET'])
def get_workflows(workspace_id):
    """Get all workflows in a workspace"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Check access
    if workspace.owner_id != current_user.id and not workspace.is_public:
        member = WorkflowSpaceMember.query.filter_by(
            workspace_id=workspace_id,
            user_id=current_user.id
        ).first()
        if not member:
            return jsonify({'error': 'Access denied'}), 403

    workflows = Workflow.query.filter_by(workspace_id=workspace_id).all()
    return jsonify([w.to_dict() for w in workflows])


@workflow_bp.route('/workspaces/<int:workspace_id>/workflows', methods=['POST'])
def create_workflow(workspace_id):
    """Create a new workflow in a workspace"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Check if user has access
    if workspace.owner_id != current_user.id:
        member = WorkflowSpaceMember.query.filter_by(
            workspace_id=workspace_id,
            user_id=current_user.id
        ).first()
        if not member:
            return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    name = data.get('name')
    description = data.get('description', '')

    if not name:
        return jsonify({'error': 'Name is required'}), 400

    try:
        workflow = Workflow(
            workspace_id=workspace_id,
            name=name,
            description=description,
            created_by=current_user.id
        )
        db.session.add(workflow)
        db.session.commit()
        
        return jsonify(workflow.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating workflow: {e}")
        return jsonify({'error': 'Failed to create workflow'}), 500


@workflow_bp.route('/workflows/<int:workflow_id>', methods=['GET'])
def get_workflow(workflow_id):
    """Get a specific workflow with nodes and edges"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workflow = Workflow.query.get(workflow_id)
    if not workflow:
        return jsonify({'error': 'Workflow not found'}), 404

    return jsonify(workflow.to_dict())


@workflow_bp.route('/workflows/<int:workflow_id>', methods=['PUT'])
def update_workflow(workflow_id):
    """Update a workflow"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workflow = Workflow.query.get(workflow_id)
    if not workflow:
        return jsonify({'error': 'Workflow not found'}), 404

    data = request.get_json()

    try:
        if 'name' in data:
            workflow.name = data['name']
        if 'description' in data:
            workflow.description = data['description']
        if 'nodes' in data:
            # Delete existing nodes
            WorkflowNode.query.filter_by(workflow_id=workflow_id).delete()
            # Add new nodes
            for node_data in data['nodes']:
                node = WorkflowNode(
                    workflow_id=workflow_id,
                    prompt_id=node_data.get('prompt_id'),
                    node_type=node_data.get('node_type', 'prompt'),
                    label=node_data.get('label'),
                    config=json.dumps(node_data.get('config', {})),
                    position_x=node_data.get('position_x', 0),
                    position_y=node_data.get('position_y', 0)
                )
                db.session.add(node)
        
        if 'edges' in data:
            # Delete existing edges
            WorkflowEdge.query.filter_by(workflow_id=workflow_id).delete()
            # Add new edges
            for edge_data in data['edges']:
                edge = WorkflowEdge(
                    workflow_id=workflow_id,
                    source_node_id=edge_data.get('source_node_id'),
                    target_node_id=edge_data.get('target_node_id'),
                    label=edge_data.get('label'),
                    config=json.dumps(edge_data.get('config', {}))
                )
                db.session.add(edge)
        
        workflow.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(workflow.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating workflow: {e}")
        return jsonify({'error': 'Failed to update workflow'}), 500


@workflow_bp.route('/workflows/<int:workflow_id>', methods=['DELETE'])
def delete_workflow(workflow_id):
    """Delete a workflow"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workflow = Workflow.query.get(workflow_id)
    if not workflow:
        return jsonify({'error': 'Workflow not found'}), 404

    # Check if user is owner
    workspace = WorkflowSpace.query.get(workflow.workspace_id)
    if workspace.owner_id != current_user.id:
        return jsonify({'error': 'Only workspace owner can delete workflows'}), 403

    try:
        db.session.delete(workflow)
        db.session.commit()
        return jsonify({'message': 'Workflow deleted successfully'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting workflow: {e}")
        return jsonify({'error': 'Failed to delete workflow'}), 500


@workflow_bp.route('/workflows/<int:workflow_id>/execute', methods=['POST'])
def execute_workflow(workflow_id):
    """Execute a workflow"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workflow = Workflow.query.get(workflow_id)
    if not workflow:
        return jsonify({'error': 'Workflow not found'}), 404

    data = request.get_json()
    input_data = data.get('input_data', {})

    try:
        # Create execution record
        execution = WorkflowExecution(
            workflow_id=workflow_id,
            user_id=current_user.id,
            status='pending',
            input_data=json.dumps(input_data)
        )
        db.session.add(execution)
        db.session.commit()
        
        # TODO: Implement actual workflow execution logic
        # This would involve:
        # 1. Topologically sorting nodes based on edges
        # 2. Executing each node in order
        # 3. Passing data between nodes
        # 4. Handling errors and conditions
        
        return jsonify({
            'message': 'Workflow execution initiated',
            'execution_id': execution.id,
            'status': execution.status
        }), 202
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error executing workflow: {e}")
        return jsonify({'error': 'Failed to execute workflow'}), 500


@workflow_bp.route('/workflows/<int:workflow_id>/executions', methods=['GET'])
def get_workflow_executions(workflow_id):
    """Get execution history of a workflow"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workflow = Workflow.query.get(workflow_id)
    if not workflow:
        return jsonify({'error': 'Workflow not found'}), 404

    executions = WorkflowExecution.query.filter_by(
        workflow_id=workflow_id
    ).order_by(WorkflowExecution.started_at.desc()).all()

    return jsonify([e.to_dict() for e in executions])
