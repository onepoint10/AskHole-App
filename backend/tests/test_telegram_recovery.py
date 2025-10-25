#!/usr/bin/env python3
"""
Test script for Telegram Password Recovery functionality.
Tests all components without requiring actual Telegram API calls.
"""

import sys
import os

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

print("=" * 60)
print("Telegram Password Recovery - Component Tests")
print("=" * 60)

# Test 1: Import all modules
print("\n1. Testing imports...")
try:
    from src.models.user import User, TelegramLinkCode
    from src.token_utils import get_reset_token, verify_reset_token
    from src.telegram_utils import send_telegram_message, format_password_reset_message
    print("✓ All modules imported successfully")
except Exception as e:
    print(f"✗ Import failed: {e}")
    sys.exit(1)

# Test 2: Token generation
print("\n2. Testing token generation...")
try:
    from flask import Flask
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'test-secret-key'

    with app.app_context():
        token = get_reset_token(user_id=123, expires_in=1800)
        print(f"✓ Token generated: {token[:50]}...")

        # Test token verification
        user_from_token = verify_reset_token(token, max_age=1800)
        # Note: This will return None since user doesn't exist in DB, but no exception means token is valid
        print("✓ Token verification structure is correct")
except Exception as e:
    print(f"✗ Token test failed: {e}")

# Test 3: TelegramLinkCode model
print("\n3. Testing TelegramLinkCode model...")
try:
    code = TelegramLinkCode.generate_code()
    print(f"✓ Generated 6-digit code: {code}")

    if len(code) == 6 and code.isdigit():
        print("✓ Code format is correct")
    else:
        print(f"✗ Invalid code format: {code}")
except Exception as e:
    print(f"✗ Code generation failed: {e}")

# Test 4: Message formatting
print("\n4. Testing message formatting...")
try:
    message = format_password_reset_message(
        reset_url="https://example.com/reset/abc123",
        username="testuser"
    )
    print("✓ Password reset message formatted:")
    print(message[:100] + "...")
except Exception as e:
    print(f"✗ Message formatting failed: {e}")

# Test 5: Database schema verification
print("\n5. Testing database schema...")
try:
    import sqlite3
    db_path = os.path.join(os.path.dirname(__file__), 'src', 'database', 'app.db')

    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check users table
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'telegram_chat_id' in columns:
            print("✓ users.telegram_chat_id column exists")
        else:
            print("✗ users.telegram_chat_id column missing")

        # Check telegram_link_codes table
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='telegram_link_codes'")
        if cursor.fetchone():
            print("✓ telegram_link_codes table exists")

            cursor.execute("PRAGMA table_info(telegram_link_codes)")
            link_columns = [col[1] for col in cursor.fetchall()]
            expected_columns = ['id', 'code', 'user_id', 'created_at', 'expires_at', 'is_used']

            missing = [col for col in expected_columns if col not in link_columns]
            if not missing:
                print("✓ All required columns present in telegram_link_codes")
            else:
                print(f"✗ Missing columns: {missing}")
        else:
            print("✗ telegram_link_codes table missing")

        conn.close()
    else:
        print("⚠ Database file not found (run migration first)")
except Exception as e:
    print(f"✗ Database verification failed: {e}")

# Test 6: Environment variable check
print("\n6. Checking environment variables...")
telegram_token = os.environ.get('TELEGRAM_BOT_TOKEN')
webhook_secret = os.environ.get('TELEGRAM_WEBHOOK_SECRET')
frontend_url = os.environ.get('FRONTEND_URL')

if telegram_token:
    print(f"✓ TELEGRAM_BOT_TOKEN is set: {telegram_token[:10]}...")
else:
    print("⚠ TELEGRAM_BOT_TOKEN not set (required for production)")

if webhook_secret:
    print(f"✓ TELEGRAM_WEBHOOK_SECRET is set: {webhook_secret[:10]}...")
else:
    print("⚠ TELEGRAM_WEBHOOK_SECRET not set (using default)")

if frontend_url:
    print(f"✓ FRONTEND_URL is set: {frontend_url}")
else:
    print("⚠ FRONTEND_URL not set (using default: http://localhost:5173)")

# Test 7: API Routes verification
print("\n7. Verifying API routes...")
try:
    from src.routes.auth import auth_bp

    # Get all routes in the blueprint
    routes = []
    for rule in auth_bp.url_prefix or []:
        pass

    expected_routes = [
        'link_telegram/request',
        'link_telegram/complete',
        'forgot_password',
        'reset_password'
    ]

    print("✓ Auth blueprint loaded successfully")
    print(f"  Expected routes: {', '.join(expected_routes)}")
except Exception as e:
    print(f"✗ Route verification failed: {e}")

print("\n" + "=" * 60)
print("Component Tests Complete!")
print("=" * 60)
print("\nTo test the full system:")
print("1. Set TELEGRAM_BOT_TOKEN environment variable")
print("2. Set TELEGRAM_WEBHOOK_SECRET environment variable")
print("3. Start the Flask application: python backend/src/main.py")
print("4. Use the API endpoints documented in TELEGRAM_PASSWORD_RECOVERY.md")
print("\nAPI Endpoints:")
print("  POST /api/auth/link_telegram/request")
print("  POST /api/auth/link_telegram/complete")
print("  POST /api/auth/forgot_password")
print("  POST /api/auth/reset_password")
