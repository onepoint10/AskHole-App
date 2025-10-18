"""
Workflow Space models for organizing prompts into collaborative workspaces.

This module defines:
- WorkflowSpace: Project/workspace for organizing prompts
- WorkflowSpaceMember: User membership and roles within workspaces
- WorkflowPromptAssociation: Many-to-many relationship between workspaces and prompts
- WorkflowPromptAttachment: File attachments for workflow prompt steps
"""

from src.database import db
from datetime import datetime
import json


class WorkflowSpace(db.Model):
    """
    Represents a workspace/project for organizing prompts.

    Workspaces allow users to:
    - Group related prompts together
    - Collaborate with team members
    - Create prompt sequences for DFG execution
    - Share workspaces publicly or keep them private
    """
    __tablename__ = 'workflow_spaces'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_public = db.Column(db.Boolean, default=False)
    prompt_sequence = db.Column(db.Text)  # JSON array of prompt IDs for DFG execution
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    members = db.relationship('WorkflowSpaceMember', backref='workspace', lazy=True, cascade='all, delete-orphan')
    prompt_associations = db.relationship('WorkflowPromptAssociation', backref='workspace', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, include_members=False, include_prompts=False):
        """
        Convert workflow space to dictionary.

        Args:
            include_members: Whether to include full member details
            include_prompts: Whether to include associated prompts

        Returns:
            Dictionary representation of the workspace
        """
        result = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'owner_id': self.owner_id,
            'is_public': self.is_public,
            'prompt_sequence': json.loads(self.prompt_sequence) if self.prompt_sequence else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'member_count': len(self.members),
            'prompt_count': len(self.prompt_associations)
        }

        if include_members:
            result['members'] = [member.to_dict() for member in self.members]

        if include_prompts:
            result['prompts'] = [assoc.to_dict(include_prompt=True) for assoc in self.prompt_associations]

        return result

    def get_prompt_sequence_details(self):
        """
        Get full prompt details for the sequence.

        Returns:
            List of prompt dictionaries in sequence order
        """
        from src.models.chat import PromptTemplate

        # Get all associations ordered by order_index
        associations = sorted(self.prompt_associations, key=lambda a: a.order_index)
        valid_prompt_ids = {assoc.prompt_id for assoc in associations}

        # Check if prompt_sequence is empty or invalid
        prompt_ids = []
        if self.prompt_sequence:
            try:
                prompt_ids = json.loads(self.prompt_sequence)
            except (json.JSONDecodeError, TypeError):
                prompt_ids = []

        # FALLBACK: If prompt_sequence is empty but we have associations, use associations
        if not prompt_ids and associations:
            prompt_ids = [assoc.prompt_id for assoc in associations]

            # Auto-fix: Update prompt_sequence in database for future use
            try:
                self.prompt_sequence = json.dumps(prompt_ids)
                from src.database import db
                db.session.commit()
            except Exception:
                db.session.rollback()

        if not prompt_ids:
            return []

        prompts = []
        for prompt_id in prompt_ids:
            # Only include prompts that are still associated with the workspace
            if prompt_id not in valid_prompt_ids:
                continue

            prompt = PromptTemplate.query.get(prompt_id)
            if prompt:
                prompts.append({
                    'id': prompt.id,
                    'title': prompt.title,
                    'content': prompt.content,
                    'category': prompt.category
                })

        return prompts


class WorkflowSpaceMember(db.Model):
    """
    Represents user membership in a workflow space.

    Roles:
    - owner: Full control, can delete workspace
    - editor: Can modify workspace and add/remove prompts
    - viewer: Read-only access
    """
    __tablename__ = 'workflow_space_members'

    id = db.Column(db.Integer, primary_key=True)
    workflow_space_id = db.Column(db.Integer, db.ForeignKey('workflow_spaces.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(20), default='member')  # 'owner', 'editor', 'viewer'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Ensure a user can only be a member of a workspace once
    __table_args__ = (
        db.UniqueConstraint('workflow_space_id', 'user_id', name='unique_workspace_member'),
    )

    def to_dict(self, include_user=True):
        """
        Convert member to dictionary.

        Args:
            include_user: Whether to include user details

        Returns:
            Dictionary representation of the member
        """
        result = {
            'id': self.id,
            'workflow_space_id': self.workflow_space_id,
            'user_id': self.user_id,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

        if include_user:
            from src.models.user import User
            user = User.query.get(self.user_id)
            if user:
                result['username'] = user.username

        return result


class WorkflowPromptAssociation(db.Model):
    """
    Many-to-many relationship between workflow spaces and prompts.

    Stores:
    - Which prompts belong to which workspaces
    - Workspace-specific notes about prompts
    - Ordering of prompts within workspace
    - Who added the prompt and when
    """
    __tablename__ = 'workflow_prompt_associations'

    id = db.Column(db.Integer, primary_key=True)
    workflow_space_id = db.Column(db.Integer, db.ForeignKey('workflow_spaces.id'), nullable=False)
    prompt_id = db.Column(db.Integer, db.ForeignKey('prompt_templates.id'), nullable=False)
    notes = db.Column(db.Text)  # Workspace-specific notes about the prompt
    order_index = db.Column(db.Integer, default=0)  # For ordering prompts
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    added_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Ensure a prompt can only be added to a workspace once
    __table_args__ = (
        db.UniqueConstraint('workflow_space_id', 'prompt_id', name='unique_workspace_prompt'),
        db.Index('idx_workspace_order', 'workflow_space_id', 'order_index'),
    )

    # Relationship to attachments
    attachments = db.relationship('WorkflowPromptAttachment', backref='prompt_association', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, include_prompt=False, include_attachments=False):
        """
        Convert association to dictionary.

        Args:
            include_prompt: Whether to include full prompt details

        Returns:
            Dictionary representation of the association
        """
        result = {
            'id': self.id,
            'workflow_space_id': self.workflow_space_id,
            'prompt_id': self.prompt_id,
            'notes': self.notes,
            'order_index': self.order_index,
            'added_at': self.added_at.isoformat() if self.added_at else None,
            'added_by': self.added_by
        }

        if include_prompt:
            from src.models.chat import PromptTemplate
            prompt = PromptTemplate.query.get(self.prompt_id)
            if prompt:
                result['prompt'] = prompt.to_dict()

        if include_attachments:
            result['attachments'] = [att.to_dict() for att in self.attachments]

        return result


class WorkflowPromptAttachment(db.Model):
    """
    File attachments for workflow prompt steps.

    Links file uploads to specific prompts in a workflow space,
    allowing documents to be attached to each step in the workflow.
    """
    __tablename__ = 'workflow_prompt_attachments'

    id = db.Column(db.Integer, primary_key=True)
    workflow_prompt_association_id = db.Column(db.Integer, db.ForeignKey('workflow_prompt_associations.id'), nullable=False)
    file_upload_id = db.Column(db.Integer, db.ForeignKey('file_uploads.id'), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    file_upload = db.relationship('FileUpload', backref='workflow_attachments', lazy=True)

    # Ensure a file can only be attached to a prompt once
    __table_args__ = (
        db.UniqueConstraint('workflow_prompt_association_id', 'file_upload_id', name='unique_prompt_file'),
    )

    def to_dict(self, include_file=True):
        """
        Convert attachment to dictionary.

        Args:
            include_file: Whether to include file upload details

        Returns:
            Dictionary representation of the attachment
        """
        result = {
            'id': self.id,
            'workflow_prompt_association_id': self.workflow_prompt_association_id,
            'file_upload_id': self.file_upload_id,
            'uploaded_by': self.uploaded_by,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None
        }

        if include_file and self.file_upload:
            result['file'] = self.file_upload.to_dict()

        return result
