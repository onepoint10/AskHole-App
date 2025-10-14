"""Workflow Space models for organizing prompts into collaborative projects."""
from src.database import db
from datetime import datetime
import json


class WorkflowSpace(db.Model):
    """
    Workflow Space - A project/workspace for organizing prompts.
    
    Allows users to group related prompts together and collaborate with team members.
    """
    __tablename__ = 'workflow_spaces'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_public = db.Column(db.Boolean, default=False)
    prompt_sequence = db.Column(db.Text, nullable=True)  # JSON array of prompt IDs for DFG execution
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    members = db.relationship('WorkflowSpaceMember', backref='workspace', lazy=True, cascade='all, delete-orphan')
    prompt_associations = db.relationship('WorkflowPromptAssociation', backref='workspace', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        """Convert workspace to dictionary."""
        return {
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

    def get_prompt_sequence_details(self):
        """Get full prompt details for the sequence."""
        from src.models.chat import PromptTemplate
        
        if not self.prompt_sequence:
            return []
        
        try:
            prompt_ids = json.loads(self.prompt_sequence)
            prompts = []
            for prompt_id in prompt_ids:
                prompt = PromptTemplate.query.get(prompt_id)
                if prompt:
                    prompts.append({
                        'id': prompt.id,
                        'title': prompt.title,
                        'content': prompt.content,
                        'category': prompt.category
                    })
            return prompts
        except (json.JSONDecodeError, Exception):
            return []


class WorkflowSpaceMember(db.Model):
    """
    Workflow Space Member - Manages user access to workspaces.
    
    Roles:
    - owner: Full control (creator of workspace)
    - editor: Can add/remove prompts and edit workspace
    - viewer: Read-only access
    """
    __tablename__ = 'workflow_space_members'

    id = db.Column(db.Integer, primary_key=True)
    workflow_space_id = db.Column(db.Integer, db.ForeignKey('workflow_spaces.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='member')  # 'owner', 'editor', 'viewer'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Unique constraint: user can only be a member once per workspace
    __table_args__ = (db.UniqueConstraint('workflow_space_id', 'user_id', name='unique_workspace_member'),)

    def to_dict(self):
        """Convert member to dictionary."""
        from src.models.user import User
        user = User.query.get(self.user_id)
        
        return {
            'id': self.id,
            'workflow_space_id': self.workflow_space_id,
            'user_id': self.user_id,
            'username': user.username if user else 'Unknown',
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class WorkflowPromptAssociation(db.Model):
    """
    Workflow Prompt Association - Links prompts to workspaces.
    
    Allows prompts to be added to multiple workspaces with workspace-specific metadata.
    """
    __tablename__ = 'workflow_prompt_associations'

    id = db.Column(db.Integer, primary_key=True)
    workflow_space_id = db.Column(db.Integer, db.ForeignKey('workflow_spaces.id'), nullable=False)
    prompt_id = db.Column(db.Integer, db.ForeignKey('prompt_templates.id'), nullable=False)
    notes = db.Column(db.Text, nullable=True)  # Workspace-specific notes about the prompt
    order_index = db.Column(db.Integer, default=0)  # For ordering prompts within workspace
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    added_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Unique constraint: prompt can only be added once per workspace
    __table_args__ = (db.UniqueConstraint('workflow_space_id', 'prompt_id', name='unique_workspace_prompt'),)

    def to_dict(self):
        """Convert association to dictionary."""
        from src.models.chat import PromptTemplate
        from src.models.user import User
        
        prompt = PromptTemplate.query.get(self.prompt_id)
        user = User.query.get(self.added_by)
        
        result = {
            'id': self.id,
            'workflow_space_id': self.workflow_space_id,
            'prompt_id': self.prompt_id,
            'notes': self.notes,
            'order_index': self.order_index,
            'added_at': self.added_at.isoformat() if self.added_at else None,
            'added_by': self.added_by,
            'added_by_username': user.username if user else 'Unknown'
        }
        
        # Include prompt details if available
        if prompt:
            result['prompt'] = prompt.to_dict()
        
        return result
