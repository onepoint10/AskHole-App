"""
Workflow Spaces API Routes

This module provides REST API endpoints for managing workflow spaces:
- Workspace CRUD operations
- Member management
- Prompt associations
- Prompt sequencing for DFG execution
"""

from flask import Blueprint, request, jsonify, send_file
from src.database import db
from src.models.workflow_space import (
    WorkflowSpace,
    WorkflowSpaceMember,
    WorkflowPromptAssociation,
    WorkflowPromptAttachment
)
from src.models.chat import PromptTemplate, FileUpload
from src.models.user import User
from src.routes.auth import get_current_user
from datetime import datetime
import json
import logging
import os
from werkzeug.utils import secure_filename
import uuid

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

        # Get all public workspaces (visible to all users)
        public_workspaces = WorkflowSpace.query.filter_by(
            is_public=True
        ).all()

        # Combine and deduplicate (some public workspaces might be owned by user)
        all_workspaces = {w.id: w for w in owned_workspaces + member_workspaces + public_workspaces}
        workspaces = list(all_workspaces.values())

        # Sort by updated_at descending
        workspaces.sort(key=lambda x: x.updated_at or x.created_at, reverse=True)

        # Add role information for each workspace
        result = []
        for workspace in workspaces:
            workspace_dict = workspace.to_dict()

            # Determine user's role
            if workspace.owner_id == current_user.id:
                workspace_dict['role'] = 'owner'
                workspace_dict['is_owner'] = True
            else:
                member = WorkflowSpaceMember.query.filter_by(
                    workflow_space_id=workspace.id,
                    user_id=current_user.id
                ).first()
                if member:
                    workspace_dict['role'] = member.role
                    workspace_dict['is_owner'] = False
                elif workspace.is_public:
                    # Public workspace but user is not a member
                    workspace_dict['role'] = 'viewer'
                    workspace_dict['is_owner'] = False
                else:
                    # Shouldn't reach here, but default to viewer
                    workspace_dict['role'] = 'viewer'
                    workspace_dict['is_owner'] = False

            result.append(workspace_dict)

        return jsonify(result)

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
        result = workspace.to_dict(include_members=True, include_prompts=True)

        # Add current user's role in this workspace
        if workspace.owner_id == current_user.id:
            result['role'] = 'owner'
            result['is_owner'] = True
        else:
            # Find user's role in members
            member = WorkflowSpaceMember.query.filter_by(
                workflow_space_id=workspace_id,
                user_id=current_user.id
            ).first()
            result['role'] = member.role if member else 'viewer'
            result['is_owner'] = False

        return jsonify(result)
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

        # Update prompt_sequence to include the new prompt
        try:
            if workspace.prompt_sequence:
                prompt_ids = json.loads(workspace.prompt_sequence)
            else:
                prompt_ids = []

            # Add new prompt ID if not already in sequence
            if prompt_id not in prompt_ids:
                prompt_ids.append(prompt_id)
                workspace.prompt_sequence = json.dumps(prompt_ids)
        except (json.JSONDecodeError, ValueError):
            # Initialize with just this prompt
            workspace.prompt_sequence = json.dumps([prompt_id])

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

        # Update prompt_sequence to remove the deleted prompt ID
        if workspace.prompt_sequence:
            try:
                prompt_ids = json.loads(workspace.prompt_sequence)
                if prompt_id in prompt_ids:
                    prompt_ids.remove(prompt_id)
                    workspace.prompt_sequence = json.dumps(prompt_ids)
            except (json.JSONDecodeError, ValueError):
                pass

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


# ============================================================================
# Prompt Attachment Endpoints
# ============================================================================

@workflow_spaces_bp.route('/<int:workspace_id>/prompts/<int:prompt_id>/attachments', methods=['POST'])
def add_attachment(workspace_id, prompt_id):
    """Add a file attachment to a workflow prompt step (editor or owner)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = check_workspace_access(workspace_id, current_user.id, 'editor')
    if not workspace:
        return jsonify({'error': 'Workspace not found or insufficient permissions'}), 403

    # Check if prompt is in workspace
    association = WorkflowPromptAssociation.query.filter_by(
        workflow_space_id=workspace_id,
        prompt_id=prompt_id
    ).first()

    if not association:
        return jsonify({'error': 'Prompt not in workspace'}), 404

    # Get file_upload_id from request body
    data = request.get_json()
    file_upload_id = data.get('file_upload_id')

    if not file_upload_id:
        return jsonify({'error': 'file_upload_id is required'}), 400

    # Verify file upload exists and belongs to current user
    file_upload = FileUpload.query.filter_by(
        id=file_upload_id,
        user_id=current_user.id
    ).first()

    if not file_upload:
        return jsonify({'error': 'File not found or access denied'}), 404

    # Check if file is already attached to this prompt
    existing = WorkflowPromptAttachment.query.filter_by(
        workflow_prompt_association_id=association.id,
        file_upload_id=file_upload_id
    ).first()

    if existing:
        return jsonify({'error': 'File already attached to this prompt'}), 400

    try:
        attachment = WorkflowPromptAttachment(
            workflow_prompt_association_id=association.id,
            file_upload_id=file_upload_id,
            uploaded_by=current_user.id
        )
        db.session.add(attachment)
        workspace.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Added attachment {file_upload_id} to prompt {prompt_id} in workspace {workspace_id}")
        return jsonify(attachment.to_dict(include_file=True)), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding attachment to prompt {prompt_id} in workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to add attachment'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>/prompts/<int:prompt_id>/attachments', methods=['GET'])
def get_attachments(workspace_id, prompt_id):
    """Get all file attachments for a workflow prompt step."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = check_workspace_access(workspace_id, current_user.id, 'viewer')
    if not workspace:
        return jsonify({'error': 'Workspace not found or access denied'}), 404

    # Check if prompt is in workspace
    association = WorkflowPromptAssociation.query.filter_by(
        workflow_space_id=workspace_id,
        prompt_id=prompt_id
    ).first()

    if not association:
        return jsonify({'error': 'Prompt not in workspace'}), 404

    try:
        attachments = WorkflowPromptAttachment.query.filter_by(
            workflow_prompt_association_id=association.id
        ).all()

        return jsonify([att.to_dict(include_file=True) for att in attachments])

    except Exception as e:
        logger.error(f"Error getting attachments for prompt {prompt_id} in workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to load attachments'}), 500


@workflow_spaces_bp.route('/<int:workspace_id>/prompts/<int:prompt_id>/attachments/<int:attachment_id>', methods=['DELETE'])
def remove_attachment(workspace_id, prompt_id, attachment_id):
    """Remove a file attachment from a workflow prompt step (editor or owner)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    workspace = check_workspace_access(workspace_id, current_user.id, 'editor')
    if not workspace:
        return jsonify({'error': 'Workspace not found or insufficient permissions'}), 403

    # Check if prompt is in workspace
    association = WorkflowPromptAssociation.query.filter_by(
        workflow_space_id=workspace_id,
        prompt_id=prompt_id
    ).first()

    if not association:
        return jsonify({'error': 'Prompt not in workspace'}), 404

    # Get attachment
    attachment = WorkflowPromptAttachment.query.filter_by(
        id=attachment_id,
        workflow_prompt_association_id=association.id
    ).first()

    if not attachment:
        return jsonify({'error': 'Attachment not found'}), 404

    try:
        db.session.delete(attachment)
        workspace.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Removed attachment {attachment_id} from prompt {prompt_id} in workspace {workspace_id}")
        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error removing attachment {attachment_id} from prompt {prompt_id} in workspace {workspace_id}: {e}")
        return jsonify({'error': 'Failed to remove attachment'}), 500


# ============================================================================
# Workflow Execution Endpoint (DFG)
# ============================================================================

@workflow_spaces_bp.route('/<int:workspace_id>/execute', methods=['POST'])
def execute_workflow(workspace_id):
    """
    Execute the prompt sequence in a workflow space (DFG execution).

    Body:
    {
        "initial_input": "optional starting text",
        "model": "gemini-2.5-flash",
        "temperature": 1.0,
        "stop_on_error": true
    }

    Returns:
    {
        "success": true,
        "results": [...],
        "final_output": "...",
        "total_time": 12.5,
        "workspace_name": "My Workflow"
    }
    """
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Check access (viewer is enough to execute, no modification)
    workspace = check_workspace_access(workspace_id, current_user.id, 'viewer')
    if not workspace:
        return jsonify({'error': 'Workspace not found or access denied'}), 404

    # Get request data
    data = request.get_json()
    initial_input = data.get('initial_input', '')
    model = data.get('model', 'gemini-2.5-flash')
    temperature = data.get('temperature', 1.0)
    stop_on_error = data.get('stop_on_error', True)

    # Get API keys from request body (same pattern as /config endpoint)
    gemini_api_key = data.get('gemini_api_key')
    openrouter_api_key = data.get('openrouter_api_key')
    custom_providers_data = data.get('custom_providers', [])

    # Validate temperature
    try:
        temperature = float(temperature)
        if not (0.0 <= temperature <= 2.0):
            temperature = 1.0
    except (ValueError, TypeError):
        temperature = 1.0

    logger.info(f"Starting workflow execution for workspace {workspace_id} "
                f"by user {current_user.id}, model={model}")
    logger.info(f"API keys provided - Gemini: {bool(gemini_api_key)}, "
                f"OpenRouter: {bool(openrouter_api_key)}, "
                f"Custom providers: {len(custom_providers_data)}")

    try:
        # Import clients and executor
        from src.workflow_executor import WorkflowExecutor
        from src.gemini_client import GeminiClient
        from src.openrouter_client import OpenRouterClient
        from src.custom_client import CustomClient
        from src.git_manager import PromptGitManager
        import os
        from flask import current_app

        gemini_client = None
        openrouter_client = None
        custom_clients = {}

        # Initialize Gemini client if API key provided
        if gemini_api_key:
            try:
                gemini_client = GeminiClient(api_key=gemini_api_key)
                logger.info("Initialized Gemini client for workflow execution")
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini client: {e}")

        # Initialize OpenRouter client if API key provided
        if openrouter_api_key:
            try:
                openrouter_client = OpenRouterClient(api_key=openrouter_api_key)
                logger.info("Initialized OpenRouter client for workflow execution")
            except Exception as e:
                logger.warning(f"Failed to initialize OpenRouter client: {e}")

        # Initialize custom clients if provided
        if custom_providers_data:
            try:
                for provider in custom_providers_data:
                    name = provider.get('name')
                    api_key = provider.get('apiKey') or provider.get('api_key')
                    base_url = provider.get('baseUrl') or provider.get('base_url')
                    if name and api_key and base_url:
                        custom_clients[name] = CustomClient(
                            api_key=api_key,
                            base_url=base_url,
                            provider_name=name
                        )
                logger.info(f"Initialized {len(custom_clients)} custom clients for workflow execution")
            except Exception as e:
                logger.warning(f"Failed to initialize custom clients: {e}")

        # Initialize Git manager
        git_manager = None
        try:
            repo_path = os.getenv('PROMPTS_REPO_PATH',
                                os.path.join(current_app.root_path, 'prompts_repo'))
            git_manager = PromptGitManager(repo_path=repo_path)
        except Exception as e:
            logger.warning(f"Failed to initialize Git manager: {e}")

        # Create executor
        executor = WorkflowExecutor(
            workflow_space=workspace,
            gemini_client=gemini_client,
            openrouter_client=openrouter_client,
            custom_clients=custom_clients,
            git_manager=git_manager
        )

        # Execute workflow
        results = executor.execute(
            initial_input=initial_input,
            model=model,
            temperature=temperature,
            stop_on_error=stop_on_error
        )

        logger.info(f"Workflow execution completed for workspace {workspace_id}. "
                   f"Success: {results['success']}, Steps: {results.get('completed_steps', 0)}/{results.get('total_steps', 0)}")

        return jsonify({
            'success': results['success'],
            'results': results['results'],
            'final_output': results.get('final_output', ''),
            'total_time': results.get('total_time', 0),
            'workspace_name': workspace.name,
            'completed_steps': results.get('completed_steps', 0),
            'total_steps': results.get('total_steps', 0),
            'error': results.get('error')
        })

    except Exception as e:
        logger.exception(f"Workflow execution error for workspace {workspace_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'results': []
        }), 500


# ============================================================================
# Workflow Execution Endpoint with SSE Streaming (DFG)
# ============================================================================

@workflow_spaces_bp.route('/<int:workspace_id>/execute-stream', methods=['POST'])
def execute_workflow_stream(workspace_id):
    """
    Execute the prompt sequence in a workflow space with Server-Sent Events streaming.

    This endpoint streams real-time progress updates for each step in the workflow,
    allowing clients to show live progress indicators.

    Body:
    {
        "initial_input": "optional starting text",
        "model": "gemini-2.5-flash",
        "temperature": 1.0,
        "stop_on_error": true
    }

    Returns SSE stream with events:
    - event: start - Step execution started
    - event: progress - Step completed or errored
    - event: complete - Entire workflow completed
    - event: error - Fatal error occurred
    """
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Check access (viewer is enough to execute, no modification)
    workspace = check_workspace_access(workspace_id, current_user.id, 'viewer')
    if not workspace:
        return jsonify({'error': 'Workspace not found or access denied'}), 404

    # Get request data
    data = request.get_json()
    initial_input = data.get('initial_input', '')
    model = data.get('model', 'gemini-2.5-flash')
    temperature = data.get('temperature', 1.0)
    stop_on_error = data.get('stop_on_error', True)

    # Get API keys from request body
    gemini_api_key = data.get('gemini_api_key')
    openrouter_api_key = data.get('openrouter_api_key')
    custom_providers_data = data.get('custom_providers', [])

    # Validate temperature
    try:
        temperature = float(temperature)
        if not (0.0 <= temperature <= 2.0):
            temperature = 1.0
    except (ValueError, TypeError):
        temperature = 1.0

    logger.info(f"Starting SSE workflow execution for workspace {workspace_id} "
                f"by user {current_user.id}, model={model}")

    def generate():
        """Generator function for SSE stream"""
        try:
            # Import clients and executor
            from src.workflow_executor import WorkflowExecutor
            from src.gemini_client import GeminiClient
            from src.openrouter_client import OpenRouterClient
            from src.custom_client import CustomClient
            from src.git_manager import PromptGitManager
            import os
            from flask import current_app

            gemini_client = None
            openrouter_client = None
            custom_clients = {}

            # Initialize Gemini client if API key provided
            if gemini_api_key:
                try:
                    gemini_client = GeminiClient(api_key=gemini_api_key)
                    logger.info("Initialized Gemini client for workflow execution")
                except Exception as e:
                    logger.warning(f"Failed to initialize Gemini client: {e}")

            # Initialize OpenRouter client if API key provided
            if openrouter_api_key:
                try:
                    openrouter_client = OpenRouterClient(api_key=openrouter_api_key)
                    logger.info("Initialized OpenRouter client for workflow execution")
                except Exception as e:
                    logger.warning(f"Failed to initialize OpenRouter client: {e}")

            # Initialize custom clients if provided
            if custom_providers_data:
                try:
                    for provider in custom_providers_data:
                        name = provider.get('name')
                        api_key = provider.get('apiKey') or provider.get('api_key')
                        base_url = provider.get('baseUrl') or provider.get('base_url')
                        if name and api_key and base_url:
                            custom_clients[name] = CustomClient(
                                api_key=api_key,
                                base_url=base_url,
                                provider_name=name
                            )
                    logger.info(f"Initialized {len(custom_clients)} custom clients for workflow execution")
                except Exception as e:
                    logger.warning(f"Failed to initialize custom clients: {e}")

            # Initialize Git manager
            git_manager = None
            try:
                repo_path = os.getenv('PROMPTS_REPO_PATH',
                                    os.path.join(current_app.root_path, 'prompts_repo'))
                git_manager = PromptGitManager(repo_path=repo_path)
            except Exception as e:
                logger.warning(f"Failed to initialize Git manager: {e}")

            # Progress callback to emit SSE events
            events_queue = []

            def progress_callback(event_type, step_number, data):
                """Callback to emit progress events as SSE"""
                event_data = {
                    'event_type': event_type,
                    'step': step_number,
                    **data
                }
                # Store event in queue to be yielded
                events_queue.append(event_data)

            # Create executor
            executor = WorkflowExecutor(
                workflow_space=workspace,
                gemini_client=gemini_client,
                openrouter_client=openrouter_client,
                custom_clients=custom_clients,
                git_manager=git_manager
            )

            # Emit initial event
            yield f"data: {json.dumps({'event_type': 'init', 'workspace_name': workspace.name})}\n\n"

            # Execute workflow with progress callback
            # Note: Since execute() is synchronous and progress_callback is called during execution,
            # we need to rethink the approach. Let's use a different strategy.

            # Get prompt sequence first
            prompt_sequence = workspace.get_prompt_sequence_details()
            if not prompt_sequence:
                error_data = {'event_type': 'error', 'error': 'No prompts in sequence'}
                yield f"data: {json.dumps(error_data)}\n\n"
                return

            # Execute each step and yield progress
            current_input = initial_input
            results_list = []

            for step_number, prompt_info in enumerate(prompt_sequence, start=1):
                # Emit start event
                start_event = {
                    'event_type': 'start',
                    'step': step_number,
                    'prompt_id': prompt_info['id'],
                    'prompt_title': prompt_info['title'],
                    'total_steps': len(prompt_sequence)
                }
                yield f"data: {json.dumps(start_event)}\n\n"

                try:
                    import time as time_module
                    step_start = time_module.time()

                    # Get prompt content
                    prompt_content = executor._get_prompt_content(prompt_info['id'])
                    if not prompt_content:
                        raise Exception(f"Prompt {prompt_info['id']} content not found")

                    # Fetch attachments for this prompt
                    attachment_files = executor._get_prompt_attachments(prompt_info['id'])
                    if attachment_files:
                        logger.info(f"SSE Step {step_number}: Using {len(attachment_files)} attachment(s)")

                    # Format and execute
                    formatted_prompt = executor._format_prompt_with_input(prompt_content, current_input)
                    output = executor._execute_single_prompt(formatted_prompt, model, temperature, files=attachment_files)

                    execution_time = time_module.time() - step_start

                    # Store result
                    result = {
                        'step': step_number,
                        'prompt_id': prompt_info['id'],
                        'prompt_title': prompt_info['title'],
                        'input': current_input if current_input else '(no input)',
                        'output': output,
                        'execution_time': execution_time,
                        'error': None
                    }
                    results_list.append(result)

                    # Emit complete event
                    complete_event = {
                        'event_type': 'complete',
                        'step': step_number,
                        **result
                    }
                    yield f"data: {json.dumps(complete_event)}\n\n"

                    # Update input for next step
                    current_input = output

                except Exception as e:
                    execution_time = time_module.time() - step_start
                    error_result = {
                        'step': step_number,
                        'prompt_id': prompt_info['id'],
                        'prompt_title': prompt_info['title'],
                        'input': current_input if current_input else '(no input)',
                        'output': None,
                        'execution_time': execution_time,
                        'error': str(e)
                    }
                    results_list.append(error_result)

                    # Emit error event
                    error_event = {
                        'event_type': 'step_error',
                        'step': step_number,
                        'prompt_id': prompt_info['id'],
                        'prompt_title': prompt_info['title'],
                        'error': str(e),
                        'execution_time': execution_time
                    }
                    yield f"data: {json.dumps(error_event)}\n\n"

                    if stop_on_error:
                        break

            # Emit final completion event
            successful_results = [r for r in results_list if r['error'] is None]
            final_output = successful_results[-1]['output'] if successful_results else ''

            completion_data = {
                'event_type': 'workflow_complete',
                'success': len(successful_results) == len(prompt_sequence),
                'results': results_list,
                'final_output': final_output,
                'completed_steps': len(successful_results),
                'total_steps': len(prompt_sequence)
            }
            yield f"data: {json.dumps(completion_data)}\n\n"

            logger.info(f"SSE workflow execution completed for workspace {workspace_id}")

        except Exception as e:
            logger.exception(f"SSE workflow execution error for workspace {workspace_id}: {e}")
            error_data = {
                'event_type': 'error',
                'error': str(e)
            }
            yield f"data: {json.dumps(error_data)}\n\n"

    from flask import Response, stream_with_context

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',  # Disable nginx buffering
            'Connection': 'keep-alive'
        }
    )

