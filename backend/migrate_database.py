#!/usr/bin/env python3
"""
Database migration script to add public prompt functionality.
This script adds the new fields to existing tables and creates the new prompt_likes table.
"""

import sqlite3
import os
import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def migrate_database():
    """Migrate the database to add public prompt functionality."""
    
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
        
        # Check if the new columns already exist
        cursor.execute("PRAGMA table_info(prompt_templates)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # Add is_public column if it doesn't exist
        if 'is_public' not in columns:
            print("Adding is_public column to prompt_templates table...")
            cursor.execute("ALTER TABLE prompt_templates ADD COLUMN is_public BOOLEAN DEFAULT 0")
            print("✓ Added is_public column")
        else:
            print("✓ is_public column already exists")
        
        # Add likes_count column if it doesn't exist
        if 'likes_count' not in columns:
            print("Adding likes_count column to prompt_templates table...")
            cursor.execute("ALTER TABLE prompt_templates ADD COLUMN likes_count INTEGER DEFAULT 0")
            print("✓ Added likes_count column")
        else:
            print("✓ likes_count column already exists")
        
        # Check if prompt_likes table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='prompt_likes'")
        if cursor.fetchone() is None:
            print("Creating prompt_likes table...")
            cursor.execute("""
                CREATE TABLE prompt_likes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    prompt_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    FOREIGN KEY (prompt_id) REFERENCES prompt_templates (id),
                    UNIQUE(user_id, prompt_id)
                )
            """)
            print("✓ Created prompt_likes table")
        else:
            print("✓ prompt_likes table already exists")
        
        # Create indexes for better performance
        print("Creating indexes...")
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_prompt_likes_user_id ON prompt_likes(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_prompt_likes_prompt_id ON prompt_likes(prompt_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_prompt_templates_is_public ON prompt_templates(is_public)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_prompt_templates_likes_count ON prompt_templates(likes_count)")
            print("✓ Created indexes")
        except sqlite3.Error as e:
            print(f"Warning: Could not create some indexes: {e}")
        
        # Commit changes
        conn.commit()
        print("✓ Database migration completed successfully!")
        
        # Verify the migration
        print("\nVerifying migration...")
        cursor.execute("PRAGMA table_info(prompt_templates)")
        columns = [column[1] for column in cursor.fetchall()]
        print(f"prompt_templates columns: {columns}")
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='prompt_likes'")
        if cursor.fetchone():
            print("✓ prompt_likes table exists")
        else:
            print("✗ prompt_likes table missing")
        
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
    print("PromptHub Database Migration")
    print("=" * 40)
    
    success = migrate_database()
    
    if success:
        print("\n🎉 Migration completed successfully!")
        print("You can now use the public prompt functionality.")
    else:
        print("\n❌ Migration failed!")
        print("Please check the error messages above and try again.")
        sys.exit(1)