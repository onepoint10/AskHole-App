from flask import Blueprint, request, jsonify, session
from src.database import db
from src.models.user import User, UserSession
from src.utils.device_utils import get_device_info_from_request
from datetime import datetime, timedelta
import re

def debug_session():
    """Debug session information"""
    print(f"Session contents: {dict(session)}")
    print(f"Session ID from cookie: {session.get('session_id')}")
    print(f"User ID from session: {session.get('user_id')}")
    print(f"Session permanent: {session.permanent}")
    print(f"Request cookies: {request.cookies}")
    return session.get('session_id')

auth_bp = Blueprint('auth', __name__)

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_password(password):
    """Validate password strength"""
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    if not re.search(r'[A-Za-z]', password):
        return False, "Password must contain at least one letter"
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number"
    return True, "Valid password"


def get_current_user():
    """Get current user from session - improved network compatibility with device tracking"""

    session_id = None

    # Method 1: Try Authorization header first (most reliable for CORS)
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        session_id = auth_header.split(' ')[1]
        print(f"Method 1 - Auth header session ID: {session_id}")

    # Method 2: Try Flask session
    if not session_id:
        session_id = session.get('session_id')
        print(f"Method 2 - Flask session ID: {session_id}")

    # Method 3: Try cookie directly
    if not session_id:
        session_id = request.cookies.get('session')
        print(f"Method 3 - Cookie session ID: {session_id}")

    if not session_id:
        print("No session_id found in any method")
        print(f"Available headers: {dict(request.headers)}")
        print(f"Available cookies: {dict(request.cookies)}")
        return None

    print(f"Looking up session: {session_id}")

    # FIXED: Don't try to decode Flask session tokens from Authorization header
    # If this looks like a Flask session token AND it came from cookie/Flask session, try to decode it
    if (session_id.startswith('eyJ') and '.' in session_id and
        (auth_header is None or not auth_header.startswith('Bearer '))):
        print("Detected Flask session token from cookie, extracting session_id")
        try:
            from flask import current_app
            from itsdangerous import URLSafeTimedSerializer

            serializer = URLSafeTimedSerializer(current_app.secret_key)
            session_data = serializer.loads(session_id)
            actual_session_id = session_data.get('session_id')
            print(f"Extracted actual session_id: {actual_session_id}")

            if actual_session_id:
                session_id = actual_session_id
            else:
                print("No session_id found in Flask session data")
                return None
        except Exception as e:
            print(f"Failed to decode Flask session: {e}")
            # Don't return None immediately - the session_id might be our custom session ID
            print("Treating as direct session ID")

    # Look up session in database
    user_session = UserSession.query.filter_by(
        id=session_id,
        is_active=True
    ).first()

    if not user_session:
        print("No active user session found in database")
        return None

    if user_session.is_expired():
        print("User session expired")
        user_session.is_active = False
        db.session.commit()
        session.clear()
        return None

    # Update last activity
    user_session.update_activity()
    
    # Check if session should be renewed
    if user_session.should_renew():
        print("Renewing session")
        if user_session.is_remember_me:
            user_session.renew_session(days=90)  # 90 days for remember me
        else:
            user_session.renew_session(days=30)  # 30 days for regular sessions
        db.session.commit()

    print(f"Found user: {user_session.user.username}")
    return user_session.user


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user with improved network compatibility and device tracking"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        remember_me = data.get('remember_me', False)

        # Validation
        if not username or not email or not password:
            return jsonify({'error': 'All fields are required'}), 400

        if len(username) < 3 or len(username) > 80:
            return jsonify({'error': 'Username must be 3-80 characters long'}), 400

        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400

        valid_password, password_message = validate_password(password)
        if not valid_password:
            return jsonify({'error': password_message}), 400

        # Check if user exists
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 400

        # Create new user
        user = User(username=username, email=email)
        user.set_password(password)

        db.session.add(user)
        db.session.commit()

        # Get device information
        device_info = get_device_info_from_request()
        
        # Create session with device tracking
        session_id = UserSession.generate_session_id()
        session_duration = 90 if remember_me else 30
        
        user_session = UserSession(
            id=session_id,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(days=session_duration),
            device_id=device_info['device_id'],
            device_name=device_info['device_name'],
            device_type=device_info['device_type'],
            user_agent=device_info['user_agent'],
            ip_address=device_info['ip_address'],
            is_remember_me=remember_me
        )

        db.session.add(user_session)
        db.session.commit()

        # FIXED: Set Flask session for local compatibility
        session.clear()
        session['session_id'] = session_id
        session['user_id'] = user.id
        session.permanent = True

        # Create response and set cookie
        response = jsonify({
            'success': True,
            'message': 'Registration successful',
            'user': user.to_dict(),
            'session_id': session_id,  # Always send session_id in response
            'device_info': {
                'device_id': device_info['device_id'],
                'device_name': device_info['device_name'],
                'device_type': device_info['device_type']
            }
        })

        # FIXED: Set cookie with network-compatible settings
        cookie_max_age = 90 * 24 * 60 * 60 if remember_me else 30 * 24 * 60 * 60
        response.set_cookie(
            'session',
            session_id,  # Send actual session_id, not Flask session
            max_age=cookie_max_age,
            httponly=False,
            secure=False,
            samesite='Lax',  # Changed for better compatibility
            domain=None,
            path='/'
        )

        # Always set session ID in response header
        response.headers['X-Session-ID'] = session_id

        return response, 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user with improved network compatibility and device tracking"""
    try:
        data = request.get_json()
        username_or_email = data.get('username', '').strip()
        password = data.get('password', '')
        remember_me = data.get('remember_me', False)

        print(f"Login attempt for: {username_or_email}")

        if not username_or_email or not password:
            return jsonify({'error': 'Username/email and password are required'}), 400

        # Find user by username or email
        user = User.query.filter(
            (User.username == username_or_email) |
            (User.email == username_or_email.lower())
        ).first()

        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid username/email or password'}), 401

        if not user.is_active:
            return jsonify({'error': 'Account is disabled'}), 403

        # Get device information
        device_info = get_device_info_from_request()
        
        # Check if there's an existing session for this device
        existing_session = UserSession.query.filter_by(
            user_id=user.id,
            device_id=device_info['device_id'],
            is_active=True
        ).first()
        
        if existing_session:
            # Update existing session instead of creating new one
            print(f"Found existing session for device: {existing_session.id}")
            existing_session.update_activity()
            
            # Renew if it's a remember me session or if it's close to expiry
            if existing_session.is_remember_me or existing_session.should_renew():
                session_duration = 90 if existing_session.is_remember_me else 30
                existing_session.renew_session(days=session_duration)
            
            db.session.commit()
            session_id = existing_session.id
        else:
            # Deactivate old sessions for this user (but keep remember me sessions)
            UserSession.query.filter_by(
                user_id=user.id,
                is_active=True,
                is_remember_me=False
            ).update({'is_active': False})

            # Create new session
            session_id = UserSession.generate_session_id()
            session_duration = 90 if remember_me else 30
            
            user_session = UserSession(
                id=session_id,
                user_id=user.id,
                expires_at=datetime.utcnow() + timedelta(days=session_duration),
                device_id=device_info['device_id'],
                device_name=device_info['device_name'],
                device_type=device_info['device_type'],
                user_agent=device_info['user_agent'],
                ip_address=device_info['ip_address'],
                is_remember_me=remember_me
            )

            db.session.add(user_session)
            db.session.commit()

        print(f"Using session {session_id} for user {user.id}")

        # FIXED: Set Flask session for local compatibility only
        session.clear()
        session['session_id'] = session_id
        session['user_id'] = user.id
        session.permanent = True

        print(f"Flask session after setting: {dict(session)}")

        # Create response
        response_data = {
            'success': True,
            'message': 'Login successful',
            'user': user.to_dict(),
            'session_id': session_id,  # Always send session_id in response for network clients
            'device_info': {
                'device_id': device_info['device_id'],
                'device_name': device_info['device_name'],
                'device_type': device_info['device_type']
            }
        }

        response = jsonify(response_data)

        # FIXED: Set cookie with network-compatible settings
        cookie_max_age = 90 * 24 * 60 * 60 if remember_me else 30 * 24 * 60 * 60
        response.set_cookie(
            'session',
            session_id,  # Send actual session_id, not Flask session
            max_age=cookie_max_age,
            httponly=False,
            secure=False,  # Must be False for local network
            samesite='Lax',  # Changed from None to Lax for better compatibility
            domain=None,
            path='/'
        )

        # FIXED: Always set session ID in response header for network clients
        response.headers['X-Session-ID'] = session_id

        return response

    except Exception as e:
        db.session.rollback()
        print(f"Login error: {str(e)}")
        return jsonify({'error': f'Login failed: {str(e)}'}), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout user"""
    try:
        session_id = session.get('session_id')
        if session_id:
            # Deactivate session
            UserSession.query.filter_by(id=session_id).update({'is_active': False})
            db.session.commit()
        
        # Clear session
        session.clear()
        
        return jsonify({'success': True, 'message': 'Logged out successfully'})
    
    except Exception as e:
        return jsonify({'error': f'Logout failed: {str(e)}'}), 500


@auth_bp.route('/me', methods=['GET'])
def get_current_user_info():
    """Get current user information"""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    
    return jsonify({
        'user': user.to_dict(),
        'authenticated': True
    })


@auth_bp.route('/check', methods=['GET'])
def check_auth():
    """Check authentication status"""
    user = get_current_user()
    return jsonify({
        'authenticated': user is not None,
        'user': user.to_dict() if user else None
    })

@auth_bp.route('/devices', methods=['GET'])
def get_user_devices():
    """Get all active sessions/devices for the current user"""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    
    # Get all active sessions for the user
    sessions = UserSession.query.filter_by(
        user_id=user.id,
        is_active=True
    ).order_by(UserSession.last_used.desc()).all()
    
    return jsonify({
        'devices': [session.to_dict() for session in sessions]
    })

@auth_bp.route('/devices/<session_id>', methods=['DELETE'])
def revoke_device(session_id):
    """Revoke a specific device session"""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    
    # Find the session and ensure it belongs to the current user
    user_session = UserSession.query.filter_by(
        id=session_id,
        user_id=user.id,
        is_active=True
    ).first()
    
    if not user_session:
        return jsonify({'error': 'Session not found'}), 404
    
    # Deactivate the session
    user_session.is_active = False
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Device session revoked'})

@auth_bp.route('/devices/revoke-all', methods=['POST'])
def revoke_all_devices():
    """Revoke all device sessions except the current one"""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    
    current_session_id = session.get('session_id')
    
    # Deactivate all other sessions for this user
    UserSession.query.filter(
        UserSession.user_id == user.id,
        UserSession.is_active == True,
        UserSession.id != current_session_id
    ).update({'is_active': False})
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'All other device sessions revoked'})

@auth_bp.route('/debug-session', methods=['GET'])
def debug_session_info():
    """Debug endpoint to check session status"""
    return jsonify({
        'session_contents': dict(session),
        'session_id_from_session': session.get('session_id'),
        'user_id_from_session': session.get('user_id'),
        'session_permanent': session.permanent,
        'request_cookies': dict(request.cookies),
        'request_headers': dict(request.headers)
    })