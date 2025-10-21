"""
Migration script for Workflow Spaces feature.

This script creates the necessary database tables for:
- WorkflowSpace
- WorkflowSpaceMember
- WorkflowPromptAssociation

Run this script to add workflow spaces functionality to existing AskHole installations.
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
    inspector = inspect(db.engine)
    return table_name in inspector.get_table_names()


def migrate_workflow_spaces():
    """Create workflow spaces tables if they don't exist."""

    with app.app_context():
        logger.info("Starting workflow spaces migration...")

        # Check which tables already exist
        tables_to_create = []

        if not table_exists('workflow_spaces'):
            tables_to_create.append('workflow_spaces')
        else:
            logger.info("Table 'workflow_spaces' already exists, skipping.")

        if not table_exists('workflow_space_members'):
            tables_to_create.append('workflow_space_members')
        else:
            logger.info("Table 'workflow_space_members' already exists, skipping.")

        if not table_exists('workflow_prompt_associations'):
            tables_to_create.append('workflow_prompt_associations')
        else:
            logger.info("Table 'workflow_prompt_associations' already exists, skipping.")

        if not tables_to_create:
            logger.info("All workflow spaces tables already exist. No migration needed.")
            return

        logger.info(f"Creating tables: {', '.join(tables_to_create)}")

        try:
            # Import models to register them with SQLAlchemy
            from src.models.workflow_space import (
                WorkflowSpace,
                WorkflowSpaceMember,
                WorkflowPromptAssociation
            )

            # Create only the missing tables
            db.create_all()

            logger.info("✓ Successfully created workflow spaces tables")

            # Verify tables were created
            if table_exists('workflow_spaces'):
                logger.info("✓ workflow_spaces table verified")
            if table_exists('workflow_space_members'):
                logger.info("✓ workflow_space_members table verified")
            if table_exists('workflow_prompt_associations'):
                logger.info("✓ workflow_prompt_associations table verified")

            logger.info("Migration completed successfully!")

        except Exception as e:
            logger.error(f"✗ Migration failed: {e}")
            logger.exception("Full error details:")
            raise


def verify_migration():
    """Verify that the migration was successful."""
    with app.app_context():
        try:
            from src.models.workflow_space import WorkflowSpace

            # Try to query the table
            count = WorkflowSpace.query.count()
            logger.info(f"✓ Verification successful: {count} workspaces found")
            return True
        except Exception as e:
            logger.error(f"✗ Verification failed: {e}")
            return False


if __name__ == '__main__':
    print("=" * 60)
    print("AskHole - Workflow Spaces Migration")
    print("=" * 60)
    print()

    # Backup reminder
    print("⚠️  IMPORTANT: Make sure you have backed up your database before proceeding!")
    print()

    response = input("Do you want to continue with the migration? (yes/no): ")

    if response.lower() not in ['yes', 'y']:
        print("Migration cancelled.")
        sys.exit(0)

    print()
    logger.info("Starting migration process...")

    try:
        migrate_workflow_spaces()
        print()

        if verify_migration():
            print()
            print("=" * 60)
            print("✓ Migration completed and verified successfully!")
            print("=" * 60)
        else:
            print()
            print("=" * 60)
            print("⚠️  Migration completed but verification failed.")
            print("Please check the logs for details.")
            print("=" * 60)
            sys.exit(1)

    except Exception as e:
        print()
        print("=" * 60)
        print("✗ Migration failed!")
        print(f"Error: {e}")
        print("=" * 60)
        sys.exit(1)
