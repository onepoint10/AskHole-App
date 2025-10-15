"""
Migration script: Migrate existing prompts to Git versioning

This script:
1. Backs up the database
2. Adds new columns to prompt_templates table (file_path, current_commit)
3. Initializes Git repository
4. Migrates all existing prompts to Git
5. Updates database records with file paths and commit hashes
"""

import os
import sys
import shutil
import logging
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from src.database import db
from src.models.chat import PromptTemplate
from src.git_manager import PromptGitManager
from sqlalchemy import text

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def backup_database(db_path: Path) -> Path:
    """Create a backup of the database."""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = db_path.parent / f"{db_path.stem}_backup_{timestamp}{db_path.suffix}"

    logger.info(f"Creating database backup: {backup_path}")
    shutil.copy2(db_path, backup_path)
    logger.info("✓ Database backup created successfully")

    return backup_path


def add_git_columns():
    """Add file_path and current_commit columns to prompt_templates table."""
    try:
        logger.info("Adding new columns to prompt_templates table...")

        # Check if columns already exist
        result = db.session.execute(text("PRAGMA table_info(prompt_templates)"))
        columns = [row[1] for row in result]

        if 'file_path' not in columns:
            db.session.execute(text(
                "ALTER TABLE prompt_templates ADD COLUMN file_path VARCHAR(500)"
            ))
            logger.info("✓ Added file_path column")
        else:
            logger.info("  file_path column already exists")

        if 'current_commit' not in columns:
            db.session.execute(text(
                "ALTER TABLE prompt_templates ADD COLUMN current_commit VARCHAR(40)"
            ))
            logger.info("✓ Added current_commit column")
        else:
            logger.info("  current_commit column already exists")

        db.session.commit()
        logger.info("✓ Database schema updated successfully")

    except Exception as e:
        logger.error(f"Failed to add columns: {e}")
        db.session.rollback()
        raise


def migrate_prompts_to_git(git_manager: PromptGitManager):
    """Migrate all existing prompts to Git repository."""
    try:
        # Get all prompts
        prompts = PromptTemplate.query.all()
        total = len(prompts)

        if total == 0:
            logger.info("No prompts found to migrate")
            return

        logger.info(f"Found {total} prompts to migrate")

        success_count = 0
        error_count = 0

        for i, prompt in enumerate(prompts, 1):
            try:
                logger.info(f"Migrating prompt {i}/{total}: #{prompt.id} - {prompt.title}")

                # Prepare commit message
                commit_message = f"Initial commit for prompt #{prompt.id}: {prompt.title}"

                # Get author name (use username if available, otherwise default)
                author_name = "Unknown User"
                if hasattr(prompt, 'user') and prompt.user:
                    author_name = prompt.user.username

                # Save to Git
                commit_hash = git_manager.save_prompt(
                    prompt_id=prompt.id,
                    content=prompt.content,
                    commit_message=commit_message,
                    author_name=author_name
                )

                # Update database record
                prompt.file_path = f"prompts/{prompt.id}.md"
                prompt.current_commit = commit_hash

                logger.info(f"  ✓ Migrated successfully (commit: {commit_hash[:7]})")
                success_count += 1

            except Exception as e:
                logger.error(f"  ✗ Failed to migrate prompt {prompt.id}: {e}")
                error_count += 1
                continue

        # Commit all database updates
        db.session.commit()

        logger.info("=" * 60)
        logger.info(f"Migration completed:")
        logger.info(f"  Total prompts: {total}")
        logger.info(f"  ✓ Successful: {success_count}")
        logger.info(f"  ✗ Failed: {error_count}")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        db.session.rollback()
        raise


def verify_migration():
    """Verify that migration was successful."""
    try:
        logger.info("Verifying migration...")

        # Check all prompts have file_path and current_commit
        prompts = PromptTemplate.query.all()

        missing_file_path = 0
        missing_commit = 0

        for prompt in prompts:
            if not prompt.file_path:
                missing_file_path += 1
            if not prompt.current_commit:
                missing_commit += 1

        if missing_file_path > 0 or missing_commit > 0:
            logger.warning(f"✗ Verification failed:")
            logger.warning(f"  Prompts missing file_path: {missing_file_path}")
            logger.warning(f"  Prompts missing current_commit: {missing_commit}")
            return False

        logger.info(f"✓ Verification successful: All {len(prompts)} prompts have Git data")
        return True

    except Exception as e:
        logger.error(f"Verification failed: {e}")
        return False


def main():
    """Run the migration."""
    try:
        logger.info("=" * 60)
        logger.info("PROMPT GIT VERSIONING MIGRATION")
        logger.info("=" * 60)

        # Get database path
        from src.main import app
        with app.app_context():
            db_path = Path(app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', ''))

            # Step 1: Backup database
            logger.info("\n[Step 1/5] Creating database backup...")
            backup_path = backup_database(db_path)

            # Step 2: Add new columns
            logger.info("\n[Step 2/5] Updating database schema...")
            add_git_columns()

            # Step 3: Initialize Git manager
            logger.info("\n[Step 3/5] Initializing Git repository...")
            git_manager = PromptGitManager()
            logger.info("✓ Git repository initialized")

            # Step 4: Migrate prompts
            logger.info("\n[Step 4/5] Migrating prompts to Git...")
            migrate_prompts_to_git(git_manager)

            # Step 5: Verify migration
            logger.info("\n[Step 5/5] Verifying migration...")
            if verify_migration():
                logger.info("\n" + "=" * 60)
                logger.info("✓ MIGRATION COMPLETED SUCCESSFULLY!")
                logger.info("=" * 60)
                logger.info(f"Database backup saved at: {backup_path}")
                logger.info(f"Git repository created at: {git_manager.repo_path}")
                logger.info("\nIMPORTANT: Add the following to your .gitignore:")
                logger.info("  backend/src/prompts_repo/")
            else:
                logger.error("\n✗ Migration completed with warnings. Please review the logs.")
                return 1

        return 0

    except Exception as e:
        logger.error(f"\n✗ Migration failed: {e}")
        logger.error("\nIf you need to restore, use the backup database.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
