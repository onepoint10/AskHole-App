"""
Migration script for Workflow Prompt Attachments feature.

This script creates the workflow_prompt_attachments table to enable
file attachments for each step (prompt) in a workflow space.

Run this script to add file attachment functionality to workflow spaces.
"""

import os
import sys
from datetime import datetime

# Add parent directory to path to import src modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import db
from src.main import app
from sqlalchemy import inspect
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def table_exists(table_name):
    """Check if a table exists in the database."""
    with app.app_context():
        inspector = inspect(db.engine)
        return table_name in inspector.get_table_names()


def migrate_workflow_attachments():
    """Create workflow_prompt_attachments table if it doesn't exist."""

    with app.app_context():
        logger.info("Starting workflow prompt attachments migration...")

        # Check if table already exists
        if table_exists('workflow_prompt_attachments'):
            logger.info("Table 'workflow_prompt_attachments' already exists. No migration needed.")
            return

        logger.info("Creating table: workflow_prompt_attachments")

        try:
            # Import model to register it with SQLAlchemy
            from src.models.workflow_space import WorkflowPromptAttachment

            # Create only the missing table
            db.create_all()

            logger.info("✓ Successfully created workflow_prompt_attachments table")

            # Verify table was created
            if table_exists('workflow_prompt_attachments'):
                logger.info("✓ workflow_prompt_attachments table verified")

            logger.info("Migration completed successfully!")

        except Exception as e:
            logger.error(f"✗ Migration failed: {e}")
            logger.exception("Full error details:")
            raise


def verify_migration():
    """Verify that the migration was successful."""
    with app.app_context():
        logger.info("\n" + "=" * 60)
        logger.info("Verifying migration...")
        logger.info("=" * 60)

        inspector = inspect(db.engine)
        tables = inspector.get_table_names()

        logger.info(f"\nTotal tables in database: {len(tables)}")

        # Check for workflow attachments table
        if 'workflow_prompt_attachments' in tables:
            logger.info("✓ workflow_prompt_attachments table exists")

            # Get columns
            columns = inspector.get_columns('workflow_prompt_attachments')
            logger.info(f"  Columns: {', '.join([c['name'] for c in columns])}")

            # Get foreign keys
            fks = inspector.get_foreign_keys('workflow_prompt_attachments')
            logger.info(f"  Foreign keys: {len(fks)}")
            for fk in fks:
                logger.info(f"    - {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")
        else:
            logger.error("✗ workflow_prompt_attachments table NOT found!")

        logger.info("\n" + "=" * 60)


if __name__ == '__main__':
    print("=" * 60)
    print("AskHole - Workflow Prompt Attachments Migration")
    print("=" * 60)
    print()

    # Backup reminder
    print("⚠️  IMPORTANT: Please backup your database before proceeding!")
    print(f"   Database location: backend/src/database/app.db")
    print()

    response = input("Continue with migration? (yes/no): ").strip().lower()

    if response != 'yes':
        print("Migration cancelled.")
        sys.exit(0)

    print()
    print("Starting migration...")
    print()

    try:
        migrate_workflow_attachments()
        print()
        verify_migration()
        print()
        print("✓ Migration completed successfully!")
        print()
        print("Next steps:")
        print("1. Restart your Flask backend")
        print("2. Test file attachment functionality in workflow spaces")
        print()
    except Exception as e:
        print()
        print("✗ Migration failed!")
        print(f"   Error: {e}")
        print()
        print("Please check the logs above for details.")
        sys.exit(1)
