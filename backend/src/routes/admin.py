from flask import Blueprint, request, jsonify
from src.database import db
from src.models.user import User, UserSession
from src.models.chat import ChatSession, ChatMessage, PromptTemplate, FileUpload, PromptLike
from src.routes.auth import get_current_user
from datetime import datetime, timedelta
from sqlalchemy import func, desc, and_, or_
from sqlalchemy.sql import text
import logging
import os

logger = logging.getLogger(__name__)

admin_bp = Blueprint('admin', __name__)


def is_admin_user(user):
    """Check if user has admin privileges"""
    # For now, we'll consider the first user (ID 1) as admin
    # You can enhance this with a proper role system
    return user and user.id == 2


@admin_bp.route('/stats/overview', methods=['GET'])
def get_overview_stats():
    """Get overview statistics for the dashboard"""
    current_user = get_current_user()
    if not current_user or not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    try:
        # Basic counts
        total_users = User.query.count()
        active_users = User.query.filter_by(is_active=True).count()
        total_sessions = ChatSession.query.count()
        total_messages = ChatMessage.query.count()
        total_prompts = PromptTemplate.query.count()
        public_prompts = PromptTemplate.query.filter_by(is_public=True).count()
        total_files = FileUpload.query.count()

        # Active sessions (last 24 hours)
        yesterday = datetime.utcnow() - timedelta(days=1)
        active_sessions_24h = ChatSession.query.filter(
            ChatSession.updated_at >= yesterday
        ).count()

        # Active user sessions
        active_user_sessions = UserSession.query.filter(
            and_(
                UserSession.is_active == True,
                UserSession.expires_at > datetime.utcnow()
            )
        ).count()

        # Storage usage
        total_storage = db.session.query(func.sum(FileUpload.file_size)).scalar() or 0

        # Recent activity (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        new_users_week = User.query.filter(User.created_at >= week_ago).count()
        new_sessions_week = ChatSession.query.filter(ChatSession.created_at >= week_ago).count()
        new_messages_week = ChatMessage.query.filter(ChatMessage.timestamp >= week_ago).count()

        return jsonify({
            'users': {
                'total': total_users,
                'active': active_users,
                'new_this_week': new_users_week
            },
            'sessions': {
                'total': total_sessions,
                'active_24h': active_sessions_24h,
                'new_this_week': new_sessions_week
            },
            'messages': {
                'total': total_messages,
                'new_this_week': new_messages_week
            },
            'prompts': {
                'total': total_prompts,
                'public': public_prompts
            },
            'files': {
                'total': total_files,
                'total_size': total_storage
            },
            'active_user_sessions': active_user_sessions
        })

    except Exception as e:
        logger.error(f"Error getting overview stats: {e}")
        return jsonify({'error': 'Failed to get statistics'}), 500


@admin_bp.route('/stats/usage', methods=['GET'])
def get_usage_stats():
    """Get usage statistics over time"""
    current_user = get_current_user()
    if not current_user or not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    try:
        days = int(request.args.get('days', 30))
        start_date = datetime.utcnow() - timedelta(days=days)

        # Daily user registrations
        user_registrations = db.session.query(
            func.date(User.created_at).label('date'),
            func.count(User.id).label('count')
        ).filter(
            User.created_at >= start_date
        ).group_by(
            func.date(User.created_at)
        ).order_by('date').all()

        # Daily session creation
        session_creation = db.session.query(
            func.date(ChatSession.created_at).label('date'),
            func.count(ChatSession.id).label('count')
        ).filter(
            ChatSession.created_at >= start_date
        ).group_by(
            func.date(ChatSession.created_at)
        ).order_by('date').all()

        # Daily message count
        message_count = db.session.query(
            func.date(ChatMessage.timestamp).label('date'),
            func.count(ChatMessage.id).label('count')
        ).filter(
            ChatMessage.timestamp >= start_date
        ).group_by(
            func.date(ChatMessage.timestamp)
        ).order_by('date').all()

        return jsonify({
            'user_registrations': [
                {'date': str(row.date), 'count': row.count}
                for row in user_registrations
            ],
            'session_creation': [
                {'date': str(row.date), 'count': row.count}
                for row in session_creation
            ],
            'message_count': [
                {'date': str(row.date), 'count': row.count}
                for row in message_count
            ]
        })

    except Exception as e:
        logger.error(f"Error getting usage stats: {e}")
        return jsonify({'error': 'Failed to get usage statistics'}), 500


@admin_bp.route('/stats/models', methods=['GET'])
def get_model_stats():
    """Get model usage statistics"""
    current_user = get_current_user()
    if not current_user or not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    try:
        # Model usage by session count
        model_usage = db.session.query(
            ChatSession.model,
            ChatSession.client_type,
            func.count(ChatSession.id).label('session_count'),
            func.count(ChatMessage.id).label('message_count')
        ).outerjoin(
            ChatMessage, ChatSession.id == ChatMessage.session_id
        ).group_by(
            ChatSession.model, ChatSession.client_type
        ).order_by(
            desc('session_count')
        ).all()

        return jsonify({
            'model_usage': [
                {
                    'model': row.model,
                    'client_type': row.client_type,
                    'session_count': row.session_count,
                    'message_count': row.message_count or 0
                }
                for row in model_usage
            ]
        })

    except Exception as e:
        logger.error(f"Error getting model stats: {e}")
        return jsonify({'error': 'Failed to get model statistics'}), 500


@admin_bp.route('/users', methods=['GET'])
def get_all_users():
    """Get all users with pagination and filtering"""
    current_user = get_current_user()
    if not current_user or not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    try:
        page = int(request.args.get('page', 1))
        per_page = min(100, int(request.args.get('per_page', 20)))
        search = request.args.get('search', '').strip()
        active_only = request.args.get('active_only', 'false').lower() == 'true'

        # --- Calculate total count efficiently first ---
        total_query = User.query
        if search:
            search_pattern = f'%{search}%'
            total_query = total_query.filter(
                or_(
                    User.username.ilike(search_pattern),
                    User.email.ilike(search_pattern)
                )
            )
        if active_only:
            total_query = total_query.filter(User.is_active == True)
        total = total_query.count()  # This count is much faster

        # --- Then, build the complex query for paginated results with stats ---
        users_with_stats_query = db.session.query(
            User,
            func.count(ChatSession.id).label('session_count'),
            func.count(ChatMessage.id).label('message_count'),
            func.count(FileUpload.id).label('file_count'),
            func.max(UserSession.created_at).label('last_login')
        ).outerjoin(
            ChatSession, User.id == ChatSession.user_id
        ).outerjoin(
            ChatMessage, ChatSession.id == ChatMessage.session_id
        ).outerjoin(
            FileUpload, User.id == FileUpload.user_id
        ).outerjoin(
            UserSession, User.id == UserSession.user_id
        ).group_by(User.id)

        # Apply the same filters to the stats query
        if search:
            search_pattern = f'%{search}%'
            users_with_stats_query = users_with_stats_query.filter(
                or_(
                    User.username.ilike(search_pattern),
                    User.email.ilike(search_pattern)
                )
            )

        if active_only:
            users_with_stats_query = users_with_stats_query.filter(User.is_active == True)

        users_with_stats_query = users_with_stats_query.order_by(desc(User.created_at))

        # Paginate the stats query
        offset = (page - 1) * per_page
        results = users_with_stats_query.offset(offset).limit(per_page).all()

        users_data = []
        for user, session_count, message_count, file_count, last_login in results:
            user_dict = user.to_dict()
            user_dict.update({
                'session_count': session_count or 0,
                'message_count': message_count or 0,
                'file_count': file_count or 0,
                'last_login': last_login.isoformat() if last_login else None
            })
            users_data.append(user_dict)

        return jsonify({
            'users': users_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })

    except Exception as e:
        logger.error(f"Error getting users: {e}")
        return jsonify({'error': 'Failed to get users'}), 500


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
def update_user_status(user_id):
    """Update user status (activate/deactivate)"""
    current_user = get_current_user()
    if not current_user or not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Prevent admin from deactivating themselves
        if user.id == current_user.id:
            return jsonify({'error': 'Cannot modify your own account'}), 400

        data = request.get_json()

        if 'is_active' in data:
            user.is_active = bool(data['is_active'])

            # If deactivating, also deactivate all user sessions
            if not user.is_active:
                UserSession.query.filter_by(
                    user_id=user_id, is_active=True
                ).update({'is_active': False})

        db.session.commit()
        return jsonify(user.to_dict())

    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}")
        db.session.rollback()
        return jsonify({'error': 'Failed to update user'}), 500


@admin_bp.route('/sessions', methods=['GET'])
def get_all_sessions():
    """Get all chat sessions with user information"""
    current_user = get_current_user()
    if not current_user or not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    try:
        page = int(request.args.get('page', 1))
        per_page = min(100, int(request.args.get('per_page', 20)))
        user_id = request.args.get('user_id')
        model = request.args.get('model')

        query = db.session.query(
            ChatSession,
            User.username,
            func.count(ChatMessage.id).label('message_count')
        ).join(
            User, ChatSession.user_id == User.id
        ).outerjoin(
            ChatMessage, ChatSession.id == ChatMessage.session_id
        )

        if user_id:
            query = query.filter(ChatSession.user_id == int(user_id))

        if model:
            query = query.filter(ChatSession.model.ilike(f'%{model}%'))

        query = query.group_by(ChatSession.id, User.username).order_by(
            desc(ChatSession.updated_at)
        )

        # Paginate
        offset = (page - 1) * per_page
        results = query.offset(offset).limit(per_page).all()
        total = query.count()

        sessions_data = []
        for session, username, message_count in results:
            session_dict = session.to_dict()
            session_dict.update({
                'username': username,
                'message_count': message_count or 0
            })
            sessions_data.append(session_dict)

        return jsonify({
            'sessions': sessions_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })

    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        return jsonify({'error': 'Failed to get sessions'}), 500


@admin_bp.route('/files', methods=['GET'])
def get_all_files():
    """Get all uploaded files with user information"""
    current_user = get_current_user()
    if not current_user or not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    try:
        page = int(request.args.get('page', 1))
        per_page = min(100, int(request.args.get('per_page', 20)))
        user_id = request.args.get('user_id')

        query = db.session.query(
            FileUpload, User.username
        ).join(
            User, FileUpload.user_id == User.id
        )

        if user_id:
            query = query.filter(FileUpload.user_id == int(user_id))

        query = query.order_by(desc(FileUpload.uploaded_at))

        # Paginate
        offset = (page - 1) * per_page
        results = query.offset(offset).limit(per_page).all()
        total = query.count()

        files_data = []
        for file_upload, username in results:
            file_dict = file_upload.to_dict()
            file_dict.update({
                'username': username,
                'file_exists': os.path.exists(file_upload.file_path) if file_upload.file_path else False
            })
            files_data.append(file_dict)

        return jsonify({
            'files': files_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })

    except Exception as e:
        logger.error(f"Error getting files: {e}")
        return jsonify({'error': 'Failed to get files'}), 500


@admin_bp.route('/system/info', methods=['GET'])
def get_system_info():
    """Get system information"""
    current_user = get_current_user()
    if not current_user or not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    try:
        import psutil
        import platform

        # System info
        system_info = {
            'platform': platform.system(),
            'platform_release': platform.release(),
            'platform_version': platform.version(),
            'architecture': platform.machine(),
            'processor': platform.processor(),
            'python_version': platform.python_version()
        }

        # Memory info
        memory = psutil.virtual_memory()
        memory_info = {
            'total': memory.total,
            'available': memory.available,
            'used': memory.used,
            'percentage': memory.percent
        }

        # Disk info
        disk = psutil.disk_usage('/')
        disk_info = {
            'total': disk.total,
            'used': disk.used,
            'free': disk.free,
            'percentage': (disk.used / disk.total) * 100
        }

        # CPU info
        cpu_info = {
            'count': psutil.cpu_count(),
            'usage': psutil.cpu_percent(interval=1)
        }

        return jsonify({
            'system': system_info,
            'memory': memory_info,
            'disk': disk_info,
            'cpu': cpu_info
        })

    except ImportError:
        return jsonify({
            'error': 'psutil package required for system info',
            'install_command': 'pip install psutil'
        }), 500
    except Exception as e:
        logger.error(f"Error getting system info: {e}")
        return jsonify({'error': 'Failed to get system information'}), 500


@admin_bp.route('/logs', methods=['GET'])
def get_logs():
    """Get application logs"""
    current_user = get_current_user()
    if not current_user or not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    try:
        lines = int(request.args.get('lines', 100))
        level = request.args.get('level', 'INFO').upper()

        # This is a basic implementation - in production you'd want to read from actual log files
        logs = [
            {
                'timestamp': datetime.utcnow().isoformat(),
                'level': 'INFO',
                'message': 'Admin panel accessed',
                'user_id': current_user.id
            }
        ]

        return jsonify({'logs': logs})

    except Exception as e:
        logger.error(f"Error getting logs: {e}")
        return jsonify({'error': 'Failed to get logs'}), 500


@admin_bp.route('/maintenance/cleanup', methods=['POST'])
def cleanup_data():
    """Cleanup old data"""
    current_user = get_current_user()
    if not current_user or not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    try:
        data = request.get_json()
        days_old = int(data.get('days_old', 30))
        cleanup_types = data.get('cleanup_types', [])

        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        cleanup_results = {}

        if 'expired_sessions' in cleanup_types:
            # Cleanup expired user sessions
            expired_count = UserSession.query.filter(
                UserSession.expires_at < datetime.utcnow()
            ).count()
            UserSession.query.filter(
                UserSession.expires_at < datetime.utcnow()
            ).delete()
            cleanup_results['expired_sessions'] = expired_count

        if 'old_files' in cleanup_types:
            # Cleanup orphaned files
            orphaned_files = FileUpload.query.filter(
                FileUpload.uploaded_at < cutoff_date
            ).all()
            for file_upload in orphaned_files:
                if os.path.exists(file_upload.file_path):
                    os.remove(file_upload.file_path)
                db.session.delete(file_upload)
            cleanup_results['old_files'] = len(orphaned_files)

        db.session.commit()

        return jsonify({
            'success': True,
            'cleanup_results': cleanup_results
        })

    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        db.session.rollback()
        return jsonify({'error': 'Cleanup failed'}), 500