from src.database import db
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
import random
import string

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    telegram_chat_id = db.Column(db.String(128), nullable=True)  # Telegram chat ID for password recovery

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
            'is_active': self.is_active,
            'telegram_linked': self.telegram_chat_id is not None
        }


class UserSession(db.Model):
    __tablename__ = 'user_sessions'

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    @staticmethod
    def generate_session_id():
        """Generate secure session ID"""
        return secrets.token_urlsafe(48)

    def is_expired(self):
        """Check if session is expired"""
        return datetime.utcnow() > self.expires_at

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_active': self.is_active
        }


class TelegramLinkCode(db.Model):
    """Temporary codes for linking Telegram accounts"""
    __tablename__ = 'telegram_link_codes'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(6), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False, nullable=False)

    # Relationship
    user = db.relationship('User', backref='link_codes')

    @staticmethod
    def generate_code():
        """Generate a random 6-digit code"""
        return ''.join(random.choices(string.digits, k=6))

    def is_expired(self):
        """Check if code has expired"""
        return datetime.utcnow() > self.expires_at

    def is_valid(self):
        """Check if code is valid (not used and not expired)"""
        return not self.is_used and not self.is_expired()

    @classmethod
    def create_for_user(cls, user_id, validity_minutes=10):
        """Create a new link code for a user with specified validity"""
        code = cls.generate_code()
        # Ensure uniqueness
        while cls.query.filter_by(code=code, is_used=False).first():
            code = cls.generate_code()

        link_code = cls(
            code=code,
            user_id=user_id,
            expires_at=datetime.utcnow() + timedelta(minutes=validity_minutes)
        )
        return link_code

    def to_dict(self):
        return {
            'code': self.code,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_used': self.is_used,
            'is_valid': self.is_valid()
        }