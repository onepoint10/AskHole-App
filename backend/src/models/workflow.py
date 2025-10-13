from src.database import db
from datetime import datetime
import json


class WorkflowSpace(db.Model):
    """Workflow/Project space to organize prompts and workflows"""
    __tablename__ = 'workflow_spaces'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    members = db.relationship('WorkflowSpaceMember', backref='workspace', lazy=True, cascade='all, delete-orphan')
    prompts = db.relationship('WorkflowPromptAssociation', backref='workspace', lazy=True, cascade='all, delete-orphan')
    workflows = db.relationship('Workflow', backref='workspace', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'owner_id': self.owner_id,
            'is_public': self.is_public,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'member_count': len(self.members),
            'prompt_count': len(self.prompts),
            'workflow_count': len(self.workflows)
        }


class WorkflowSpaceMember(db.Model):
    """Members of a workflow space with roles"""
    __tablename__ = 'workflow_space_members'

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey('workflow_spaces.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(50), default='member')  # owner, editor, viewer, member
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Ensure a user can only be a member once per workspace
    __table_args__ = (db.UniqueConstraint('workspace_id', 'user_id', name='unique_workspace_member'),)

    def to_dict(self):
        return {
            'id': self.id,
            'workspace_id': self.workspace_id,
            'user_id': self.user_id,
            'role': self.role,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None
        }


class WorkflowPromptAssociation(db.Model):
    """Association between workflow spaces and prompts"""
    __tablename__ = 'workflow_prompt_associations'

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey('workflow_spaces.id'), nullable=False)
    prompt_id = db.Column(db.Integer, db.ForeignKey('prompt_templates.id'), nullable=False)
    position = db.Column(db.Integer, default=0)  # Order of prompts in workspace
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Ensure a prompt can only be added once per workspace
    __table_args__ = (db.UniqueConstraint('workspace_id', 'prompt_id', name='unique_workspace_prompt'),)

    def to_dict(self):
        return {
            'id': self.id,
            'workspace_id': self.workspace_id,
            'prompt_id': self.prompt_id,
            'position': self.position,
            'added_at': self.added_at.isoformat() if self.added_at else None
        }


class PromptVersion(db.Model):
    """Git-style versioning for prompts"""
    __tablename__ = 'prompt_versions'

    id = db.Column(db.Integer, primary_key=True)
    prompt_id = db.Column(db.Integer, db.ForeignKey('prompt_templates.id'), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(100))
    tags = db.Column(db.Text)  # JSON string of tags
    commit_message = db.Column(db.Text)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'prompt_id': self.prompt_id,
            'version_number': self.version_number,
            'content': self.content,
            'title': self.title,
            'category': self.category,
            'tags': json.loads(self.tags) if self.tags else [],
            'commit_message': self.commit_message,
            'author_id': self.author_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Workflow(db.Model):
    """Directed Flow Graph (DFG) workflow definition"""
    __tablename__ = 'workflows'

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey('workflow_spaces.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    nodes = db.relationship('WorkflowNode', backref='workflow', lazy=True, cascade='all, delete-orphan')
    edges = db.relationship('WorkflowEdge', backref='workflow', lazy=True, cascade='all, delete-orphan')
    executions = db.relationship('WorkflowExecution', backref='workflow', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'workspace_id': self.workspace_id,
            'name': self.name,
            'description': self.description,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'nodes': [node.to_dict() for node in self.nodes],
            'edges': [edge.to_dict() for edge in self.edges]
        }


class WorkflowNode(db.Model):
    """Node in a workflow DFG (represents a prompt execution)"""
    __tablename__ = 'workflow_nodes'

    id = db.Column(db.Integer, primary_key=True)
    workflow_id = db.Column(db.Integer, db.ForeignKey('workflows.id'), nullable=False)
    prompt_id = db.Column(db.Integer, db.ForeignKey('prompt_templates.id'), nullable=True)  # Can be null for custom nodes
    node_type = db.Column(db.String(50), default='prompt')  # prompt, input, output, condition
    label = db.Column(db.String(200))
    config = db.Column(db.Text)  # JSON configuration for the node
    position_x = db.Column(db.Float, default=0)
    position_y = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'workflow_id': self.workflow_id,
            'prompt_id': self.prompt_id,
            'node_type': self.node_type,
            'label': self.label,
            'config': json.loads(self.config) if self.config else {},
            'position_x': self.position_x,
            'position_y': self.position_y,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class WorkflowEdge(db.Model):
    """Edge connecting nodes in a workflow DFG (represents data flow)"""
    __tablename__ = 'workflow_edges'

    id = db.Column(db.Integer, primary_key=True)
    workflow_id = db.Column(db.Integer, db.ForeignKey('workflows.id'), nullable=False)
    source_node_id = db.Column(db.Integer, db.ForeignKey('workflow_nodes.id'), nullable=False)
    target_node_id = db.Column(db.Integer, db.ForeignKey('workflow_nodes.id'), nullable=False)
    label = db.Column(db.String(200))
    config = db.Column(db.Text)  # JSON configuration for data mapping
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'workflow_id': self.workflow_id,
            'source_node_id': self.source_node_id,
            'target_node_id': self.target_node_id,
            'label': self.label,
            'config': json.loads(self.config) if self.config else {},
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class WorkflowExecution(db.Model):
    """Execution history of workflows"""
    __tablename__ = 'workflow_executions'

    id = db.Column(db.Integer, primary_key=True)
    workflow_id = db.Column(db.Integer, db.ForeignKey('workflows.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(50), default='pending')  # pending, running, completed, failed
    input_data = db.Column(db.Text)  # JSON input data
    output_data = db.Column(db.Text)  # JSON output data
    error_message = db.Column(db.Text)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id': self.id,
            'workflow_id': self.workflow_id,
            'user_id': self.user_id,
            'status': self.status,
            'input_data': json.loads(self.input_data) if self.input_data else {},
            'output_data': json.loads(self.output_data) if self.output_data else {},
            'error_message': self.error_message,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }
