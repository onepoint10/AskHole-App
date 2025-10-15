"""
Workflow Spaces API Routes

This module provides REST API endpoints for managing workflow spaces:
- Workspace CRUD operations
- Member management
- Prompt associations
- Prompt sequencing for DFG execution
"""

from flask import Blueprint, request, jsonify
from src.database import db
from src.models.workflow_space import (
    WorkflowSpace,
    WorkflowSpaceMember,
    WorkflowPromptAssociation
)
from src.models.chat import PromptTemplate
from src.models.user import User
from src.routes.auth import get_current_user
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)

workflow_spaces_bp = Blueprint('workflow_spaces', __name__)


def check_workspace_access(workspace_id, user_id, required_role='viewer'):
    """
    Check if user has access to workspace with required role.

    Args:
        workspace_id: ID of the workspace
        user_id: ID of the user
        required_role: Minimum required role ('viewer', 'editor', 'owner')

    Returns:
        WorkflowSpace object if access granted, None otherwise
    """
    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return None

    # Check if user is owner
    if workspace.owner_id == user_id:
        return workspace

    # Check if workspace is public and only viewer access is required
    if workspace.is_public and required_role == 'viewer':
        return workspace

    # Check membership
    member = WorkflowSpaceMember.query.filter_by(
        workflow_space_id=workspace_id,
        user_id=user_id
    ).first()

    if not member:
        return None if not workspace.is_public else (workspace if required_role == 'viewer' else None)

    # Role hierarchy: owner > editor > viewer
    role_levels = {'viewer': 0, 'editor': 1, 'owner': 2}
    required_level = role_levels.get(required_role, 0)
    user_level = role_levels.get(member.role, 0)

    if user_level >= required_level:
        return workspace

    return None


# ============================================================================
# Workspace Management Endpoints
# ============================================================================

@workflow_spaces_bp.route('', methods=['GET'])
def get_workspaces():
    """Get all workspaces accessible to current user."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    try:
        # Get workspaces where user is owner
        owned_workspaces = WorkflowSpace.query.filter_by(
            owner_id=current_user.id
        ).all()

        # Get workspaces where user is a member
        member_records = WorkflowSpaceMember.query.filter_by(
            user_id=current_user.id
        ).all()
        member_workspace_ids = [m.workflow_space_id for m in member_records]
        member_workspaces = WorkflowSpace.query.filter(
            WorkflowSpace.id.in_(member_workspace_ids)
        ).all() if member_workspace_ids else []

        # Combine and deduplicate
        all_workspaces = {w.id: w for w in owned_workspaces + member_workspaces}
        workspaces = list(all_workspaces.values())

        # Sort by updated_at descending
        workspaces.sort(key=lambda x: x.updated_at or x.created_at, reverse=True)

        return jsonify([w.to_dict() for w in workspaces])

    except Exception as e:
        logger.error(f"Error getting workspaces: {e}")
        return jsonify({'error': 'Failed to load workspaces'}), 500


@workflow_spaces_bp.route('', methods=['POST'])
def create_workspace():
    """Create a new workflow space."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.get_json()

    # Validate required fields
    if not data.get('name', '').strip():
        return jsonify({'error': 'Name is required'}), 400

    try:
        workspace = WorkflowSpace(
            name=data['name'].strip(),
            description=data.get('description', '').strip(),
            owner_id=current_user.id,
            is_public=bool(data.get('is_public', False)),
            prompt_sequence=json.dumps([])  # Initialize empty sequence
        )

        db.session.add(workspace)
        db.session.flush()  # Get workspace ID

        # Auto-add creator as owner member
        owner_member = WorkflowSpaceMember(
            workflow_space_id=workspace.id,
            user_id=current_user.id,
            role='owner'
        )
        db.session.add(owner_member)

        db.session.commit()

        logger.info(f"Created workspace {workspace.id} for user {current_user.id}")
        return jsonify(workspace.to_dict(include_members=True)), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating workspace: {e}")
        return jsonify({'error': 'Failed to create workspace'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>', methods=['GET'])
def get_workspace(workspace_id):
    """Get workspace details with members and prompts."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = check_workspace_access(workspace_id, current_user.id, 'viewer')
    if not workspace:
        return jsonify({'error': 'Workspace not found or access denied'}), 404

    try:
        return jsonify(workspace.to_dict(include_members=True, include_prompts=True))
    except Exception as e:
        logger.error(f"Error getting workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to load workspace'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>', methods=['PUT'])
def update_workspace(workspace_id):
    """Update workspace details."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = check_workspace_access(workspace_id, current_user.id, 'editor')
    if not workspace:
        return jsonify({'error': 'Workspace not found or insufficient permissions'}), 403

    data = request.get_json()

    # Validate fields
    if 'name' in data and not data['name'].strip():
        return jsonify({'error': 'Name cannot be empty'}), 400

    try:
        # Update fields
        if 'name' in data:
            workspace.name = data['name'].strip()
        if 'description' in data:
            workspace.description = data['description'].strip()
        if 'is_public' in data and workspace.owner_id == current_user.id:
            # Only owner can change visibility
            workspace.is_public = bool(data['is_public'])

        workspace.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Updated workspace {workspace_id} by user {current_user.id}")
        return jsonify(workspace.to_dict())

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to update workspace'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>', methods=['DELETE'])
def delete_workspace(workspace_id):
    """Delete a workflow space (owner only)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Only owner can delete
    if workspace.owner_id != current_user.id:
        return jsonify({'error': 'Only workspace owner can delete'}), 403

    try:
        db.session.delete(workspace)
        db.session.commit()

        logger.info(f"Deleted workspace {workspace_id} by user {current_user.id}")
        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to delete workspace'}), 500


# ============================================================================
# Member Management Endpoints
# ============================================================================

@workflow_spaces_bp.route('/<int:workspace_id>/members', methods=['GET'])
def get_members(workspace_id):
    """List workspace members."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = check_workspace_access(workspace_id, current_user.id, 'viewer')
    if not workspace:
        return jsonify({'error': 'Workspace not found or access denied'}), 404

    try:
        members = WorkflowSpaceMember.query.filter_by(
            workflow_space_id=workspace_id
        ).all()

        return jsonify([m.to_dict(include_user=True) for m in members])

    except Exception as e:
        logger.error(f"Error getting members for workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to load members'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>/members', methods=['POST'])
def add_member(workspace_id):
    """Add a member to workspace (owner only)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Only owner can add members
    if workspace.owner_id != current_user.id:
        return jsonify({'error': 'Only workspace owner can add members'}), 403

    data = request.get_json()
    user_id = data.get('user_id')
    role = data.get('role', 'viewer')

    # Validate
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400

    if role not in ['owner', 'editor', 'viewer']:
        return jsonify({'error': 'Invalid role. Must be owner, editor, or viewer'}), 400

    # Check if user exists
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Check if already a member
    existing = WorkflowSpaceMember.query.filter_by(
        workflow_space_id=workspace_id,
        user_id=user_id
    ).first()

    if existing:
        return jsonify({'error': 'User is already a member'}), 400

    try:
        member = WorkflowSpaceMember(
            workflow_space_id=workspace_id,
            user_id=user_id,
            role=role
        )
        db.session.add(member)
        workspace.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Added user {user_id} to workspace {workspace_id} with role {role}")
        return jsonify(member.to_dict(include_user=True)), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding member to workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to add member'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>/members/<int:user_id>', methods=['PUT'])
def update_member_role(workspace_id, user_id):
    """Update member role (owner only)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Only owner can change roles
    if workspace.owner_id != current_user.id:
        return jsonify({'error': 'Only workspace owner can change roles'}), 403

    member = WorkflowSpaceMember.query.filter_by(
        workflow_space_id=workspace_id,
        user_id=user_id
    ).first()

    if not member:
        return jsonify({'error': 'Member not found'}), 404

    # Cannot change owner's role
    if member.user_id == workspace.owner_id:
        return jsonify({'error': 'Cannot change workspace owner role'}), 400

    data = request.get_json()
    new_role = data.get('role')

    if not new_role or new_role not in ['owner', 'editor', 'viewer']:
        return jsonify({'error': 'Invalid role'}), 400

    try:
        member.role = new_role
        workspace.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Updated user {user_id} role in workspace {workspace_id} to {new_role}")
        return jsonify(member.to_dict(include_user=True))

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating member role in workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to update role'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>/members/<int:user_id>', methods=['DELETE'])
def remove_member(workspace_id, user_id):
    """Remove a member from workspace (owner only)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = WorkflowSpace.query.get(workspace_id)
    if not workspace:
        return jsonify({'error': 'Workspace not found'}), 404

    # Only owner can remove members
    if workspace.owner_id != current_user.id:
        return jsonify({'error': 'Only workspace owner can remove members'}), 403

    member = WorkflowSpaceMember.query.filter_by(
        workflow_space_id=workspace_id,
        user_id=user_id
    ).first()

    if not member:
        return jsonify({'error': 'Member not found'}), 404

    # Cannot remove owner
    if member.user_id == workspace.owner_id:
        return jsonify({'error': 'Cannot remove workspace owner'}), 400

    try:
        db.session.delete(member)
        workspace.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Removed user {user_id} from workspace {workspace_id}")
        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error removing member from workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to remove member'}), 500


# ============================================================================
# Prompt Management Endpoints
# ============================================================================

@workflow_spaces_bp.route('/<int:workspace_id>/prompts', methods=['GET'])
def get_workspace_prompts(workspace_id):
    """Get all prompts in workspace, ordered by order_index."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = check_workspace_access(workspace_id, current_user.id, 'viewer')
    if not workspace:
        return jsonify({'error': 'Workspace not found or access denied'}), 404

    try:
        associations = WorkflowPromptAssociation.query.filter_by(
            workflow_space_id=workspace_id
        ).order_by(WorkflowPromptAssociation.order_index).all()

        return jsonify([a.to_dict(include_prompt=True) for a in associations])

    except Exception as e:
        logger.error(f"Error getting prompts for workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to load prompts'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>/prompts', methods=['POST'])
def add_prompt_to_workspace(workspace_id):
    """Add a prompt to workspace (editor or owner)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = check_workspace_access(workspace_id, current_user.id, 'editor')
    if not workspace:
        return jsonify({'error': 'Workspace not found or insufficient permissions'}), 403

    data = request.get_json()
    prompt_id = data.get('prompt_id')

    if not prompt_id:
        return jsonify({'error': 'prompt_id is required'}), 400

    # Check if prompt exists and user has access
    prompt = PromptTemplate.query.filter(
        PromptTemplate.id == prompt_id,
        db.or_(
            PromptTemplate.user_id == current_user.id,
            PromptTemplate.is_public == True
        )
    ).first()

    if not prompt:
        return jsonify({'error': 'Prompt not found or access denied'}), 404

    # Check if already in workspace
    existing = WorkflowPromptAssociation.query.filter_by(
        workflow_space_id=workspace_id,
        prompt_id=prompt_id
    ).first()

    if existing:
        return jsonify({'error': 'Prompt already in workspace'}), 400

    try:
        # Get max order_index
        max_order = db.session.query(
            db.func.max(WorkflowPromptAssociation.order_index)
        ).filter_by(workflow_space_id=workspace_id).scalar() or 0

        association = WorkflowPromptAssociation(
            workflow_space_id=workspace_id,
            prompt_id=prompt_id,
            notes=data.get('notes', ''),
            order_index=data.get('order_index', max_order + 1),
            added_by=current_user.id
        )
        db.session.add(association)
        workspace.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Added prompt {prompt_id} to workspace {workspace_id}")
        return jsonify(association.to_dict(include_prompt=True)), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding prompt to workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to add prompt'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>/prompts/<int:prompt_id>', methods=['PUT'])
def update_prompt_association(workspace_id, prompt_id):
    """Update prompt association metadata (notes, order_index)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = check_workspace_access(workspace_id, current_user.id, 'editor')
    if not workspace:
        return jsonify({'error': 'Workspace not found or insufficient permissions'}), 403

    association = WorkflowPromptAssociation.query.filter_by(
        workflow_space_id=workspace_id,
        prompt_id=prompt_id
    ).first()

    if not association:
        return jsonify({'error': 'Prompt not in workspace'}), 404

    data = request.get_json()

    try:
        if 'notes' in data:
            association.notes = data['notes']
        if 'order_index' in data:
            association.order_index = data['order_index']

        workspace.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Updated prompt {prompt_id} association in workspace {workspace_id}")
        return jsonify(association.to_dict(include_prompt=True))

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating prompt association in workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to update association'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>/prompts/<int:prompt_id>', methods=['DELETE'])
def remove_prompt_from_workspace(workspace_id, prompt_id):
    """Remove a prompt from workspace (editor or owner)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = check_workspace_access(workspace_id, current_user.id, 'editor')
    if not workspace:
        return jsonify({'error': 'Workspace not found or insufficient permissions'}), 403

    association = WorkflowPromptAssociation.query.filter_by(
        workflow_space_id=workspace_id,
        prompt_id=prompt_id
    ).first()

    if not association:
        return jsonify({'error': 'Prompt not in workspace'}), 404

    try:
        db.session.delete(association)
        workspace.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Removed prompt {prompt_id} from workspace {workspace_id}")
        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error removing prompt from workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to remove prompt'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>/prompts/reorder', methods=['PUT'])
def reorder_prompts(workspace_id):
    """Reorder prompts in workspace by updating order_index."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = check_workspace_access(workspace_id, current_user.id, 'editor')
    if not workspace:
        return jsonify({'error': 'Workspace not found or insufficient permissions'}), 403

    data = request.get_json()
    prompt_ids = data.get('prompt_ids', [])

    if not prompt_ids or not isinstance(prompt_ids, list):
        return jsonify({'error': 'prompt_ids array is required'}), 400

    try:
        # Update order_index for each prompt
        for index, prompt_id in enumerate(prompt_ids):
            association = WorkflowPromptAssociation.query.filter_by(
                workflow_space_id=workspace_id,
                prompt_id=prompt_id
            ).first()

            if association:
                association.order_index = index

        # Update prompt_sequence for DFG execution
        workspace.prompt_sequence = json.dumps(prompt_ids)
        workspace.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Reordered {len(prompt_ids)} prompts in workspace {workspace_id}")
        return jsonify({
            'success': True,
            'prompt_sequence': prompt_ids
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error reordering prompts in workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to reorder prompts'}), 500
