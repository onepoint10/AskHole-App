from src.database import db
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import secrets

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    chat_sessions = db.relationship('ChatSession', backref='user', lazy=True, cascade='all, delete-orphan')
    prompt_templates = db.relationship('PromptTemplate', backref='user', lazy=True, cascade='all, delete-orphan')
    file_uploads = db.relationship('FileUpload', backref='user', lazy=True, cascade='all, delete-orphan')
    sessions = db.relationship('UserSession', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        """Set password hash"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check password"""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_active': self.is_active
        }


class UserSession(db.Model):
    __tablename__ = 'user_sessions'
    
    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    
    # Device tracking fields
    device_id = db.Column(db.String(128), nullable=True)  # Unique device identifier
    device_name = db.Column(db.String(255), nullable=True)  # Human-readable device name
    device_type = db.Column(db.String(50), nullable=True)  # mobile, desktop, tablet
    user_agent = db.Column(db.Text, nullable=True)  # Browser user agent
    ip_address = db.Column(db.String(45), nullable=True)  # IP address
    is_remember_me = db.Column(db.Boolean, default=False)  # Remember me token
    last_used = db.Column(db.DateTime, default=datetime.utcnow)  # Last activity timestamp
    
    @staticmethod
    def generate_session_id():
        """Generate secure session ID"""
        return secrets.token_urlsafe(48)
    
    @staticmethod
    def generate_device_id():
        """Generate a unique device identifier"""
        return secrets.token_urlsafe(32)
    
    def is_expired(self):
        """Check if session is expired"""
        return datetime.utcnow() > self.expires_at
    
    def should_renew(self):
        """Check if session should be renewed (within 7 days of expiry)"""
        if self.is_remember_me:
            # Remember me tokens get renewed if within 7 days of expiry
            return (self.expires_at - datetime.utcnow()).days <= 7
        else:
            # Regular sessions get renewed if within 1 day of expiry
            return (self.expires_at - datetime.utcnow()).days <= 1
    
    def renew_session(self, days=30):
        """Renew session expiration"""
        self.expires_at = datetime.utcnow() + timedelta(days=days)
        self.last_used = datetime.utcnow()
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_used = datetime.utcnow()
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_active': self.is_active,
            'device_id': self.device_id,
            'device_name': self.device_name,
            'device_type': self.device_type,
            'is_remember_me': self.is_remember_me,
            'last_used': self.last_used.isoformat() if self.last_used else None
        }