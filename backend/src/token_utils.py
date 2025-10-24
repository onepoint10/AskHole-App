"""
Token utilities for secure password reset tokens using itsdangerous.
"""
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from flask import current_app
from src.models.user import User


def get_serializer():
    """Get configured URLSafeTimedSerializer instance"""
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'])


def get_reset_token(user_id, expires_in=1800):
    """
    Generate a secure, time-limited password reset token.

    Args:
        user_id (int): The user's ID to encode in the token
        expires_in (int): Token lifetime in seconds (default: 1800 = 30 minutes)

    Returns:
        str: A secure, signed token containing the user_id
    """
    serializer = get_serializer()
    token = serializer.dumps({'user_id': user_id}, salt='password-reset')
    return token


def verify_reset_token(token, max_age=1800):
    """
    Verify and decode a password reset token.

    Args:
        token (str): The token to verify
        max_age (int): Maximum age in seconds (default: 1800 = 30 minutes)

    Returns:
        User: The User object if token is valid, None otherwise

    Raises:
        SignatureExpired: If the token has expired
        BadSignature: If the token signature is invalid
    """
    serializer = get_serializer()

    try:
        # Load and verify the token
        data = serializer.loads(token, salt='password-reset', max_age=max_age)
        user_id = data.get('user_id')

        if not user_id:
            return None

        # Fetch and return the user
        user = User.query.get(user_id)
        return user

    except SignatureExpired:
        # Token has expired
        raise SignatureExpired('Password reset token has expired')
    except BadSignature:
        # Token is invalid or tampered
        raise BadSignature('Invalid password reset token')
    except Exception as e:
        # Catch any other exceptions
        raise Exception(f'Token verification failed: {str(e)}')
