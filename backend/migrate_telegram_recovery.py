#!/usr/bin/env python3
"""
Database migration script to add Telegram password recovery functionality.
This script adds telegram_chat_id to users table and creates telegram_link_codes table.
"""

import sqlite3
import os
import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def migrate_database():
    """Migrate the database to add Telegram password recovery functionality."""

    # Database path
    db_path = os.path.join(os.path.dirname(__file__), 'src', 'database', 'app.db')

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        print("Please run the application first to create the database.")
        return False

    print(f"Migrating database at {db_path}")

    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if the new columns already exist in users table
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]

        # Add telegram_chat_id column if it doesn't exist
        if 'telegram_chat_id' not in columns:
            print("Adding telegram_chat_id column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(128)")
            print("✓ Added telegram_chat_id column")
        else:
            print("✓ telegram_chat_id column already exists")

        # Check if telegram_link_codes table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='telegram_link_codes'")
        if cursor.fetchone() is None:
            print("Creating telegram_link_codes table...")
            cursor.execute("""
                CREATE TABLE telegram_link_codes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code VARCHAR(6) NOT NULL UNIQUE,
                    user_id INTEGER NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    is_used BOOLEAN NOT NULL DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """)
            print("✓ Created telegram_link_codes table")
        else:
            print("✓ telegram_link_codes table already exists")

        # Create indexes for better performance
        print("Creating indexes...")
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code ON telegram_link_codes(code)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user_id ON telegram_link_codes(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_is_used ON telegram_link_codes(is_used)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id)")
            print("✓ Created indexes")
        except sqlite3.Error as e:
            print(f"Warning: Could not create some indexes: {e}")

        # Commit changes
        conn.commit()
        print("✓ Database migration completed successfully!")

        # Verify the migration
        print("\nVerifying migration...")
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        print(f"users columns: {', '.join(columns)}")

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='telegram_link_codes'")
        if cursor.fetchone():
            print("✓ telegram_link_codes table exists")

            # Show table structure
            cursor.execute("PRAGMA table_info(telegram_link_codes)")
            link_codes_columns = [column[1] for column in cursor.fetchall()]
            print(f"telegram_link_codes columns: {', '.join(link_codes_columns)}")
        else:
            print("✗ telegram_link_codes table missing")

        return True

    except sqlite3.Error as e:
        print(f"Database migration failed: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error during migration: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("Telegram Password Recovery Migration")
    print("=" * 50)

    success = migrate_database()

    if success:
        print("\n🎉 Migration completed successfully!")
        print("\nNext steps:")
        print("1. Set TELEGRAM_BOT_TOKEN environment variable with your bot token")
        print("2. Set TELEGRAM_WEBHOOK_SECRET environment variable (for security)")
        print("3. Set FRONTEND_URL environment variable (default: http://localhost:5173)")
        print("4. Restart the Flask application")
        print("\nNew API endpoints available:")
        print("  POST /api/auth/link_telegram/request   - Generate linking code")
        print("  POST /api/auth/link_telegram/complete  - Complete Telegram linking")
        print("  POST /api/auth/forgot_password         - Request password reset")
        print("  POST /api/auth/reset_password          - Reset password with token")
    else:
        print("\n❌ Migration failed!")
        print("Please check the error messages above and try again.")
        sys.exit(1)
