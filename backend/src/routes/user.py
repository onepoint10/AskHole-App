from flask import Blueprint, jsonify, request
from src.database import db
from src.models.user import User
from src.routes.auth import get_current_user

user_bp = Blueprint('user', __name__)


@user_bp.route('/users', methods=['GET'])
def get_users():
    """Get all users (admin only)"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401
    
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])


@user_bp.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Get specific user"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401
    
    # Users can only view their own profile
    if current_user.id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())


@user_bp.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update user profile"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401
    
    # Users can only update their own profile
    if current_user.id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    user = User.query.get_or_404(user_id)
    data = request.json
    
    # Update allowed fields
    if 'username' in data:
        new_username = data['username'].strip()
        if len(new_username) < 3 or len(new_username) > 80:
            return jsonify({'error': 'Username must be 3-80 characters long'}), 400
        
        # Check if username is taken by another user
        existing_user = User.query.filter(
            User.username == new_username,
            User.id != user_id
        ).first()
        if existing_user:
            return jsonify({'error': 'Username already exists'}), 400
        
        user.username = new_username
    
    if 'email' in data:
        new_email = data['email'].strip().lower()
        # Validate email format
        import re
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', new_email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Check if email is taken by another user
        existing_user = User.query.filter(
            User.email == new_email,
            User.id != user_id
        ).first()
        if existing_user:
            return jsonify({'error': 'Email already registered'}), 400
        
        user.email = new_email
    
    try:
        db.session.commit()
        return jsonify(user.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Update failed: {str(e)}'}), 500


@user_bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete user account"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401
    
    # Users can only delete their own account
    if current_user.id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    user = User.query.get_or_404(user_id)
    
    try:
        db.session.delete(user)
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Delete failed: {str(e)}'}), 500