"""Migration script to add Workflow Space tables to the database."""
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.database import db
from src.models.workflow_space import WorkflowSpace, WorkflowSpaceMember, WorkflowPromptAssociation
from src.models.user import User
from src.models.chat import PromptTemplate
from flask import Flask
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app():
    """Create a minimal Flask app for migration."""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///src/database/app.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    return app


def check_table_exists(table_name):
    """Check if a table exists in the database."""
    inspector = db.inspect(db.engine)
    return table_name in inspector.get_table_names()


def migrate_workflow_spaces():
    """Run the migration to create workflow space tables."""
    app = create_app()
    
    with app.app_context():
        logger.info("Starting Workflow Spaces migration...")
        
        # Check which tables already exist
        tables_to_create = []
        
        if not check_table_exists('workflow_spaces'):
            tables_to_create.append('workflow_spaces')
            logger.info("✓ workflow_spaces table will be created")
        else:
            logger.info("⊘ workflow_spaces table already exists")
        
        if not check_table_exists('workflow_space_members'):
            tables_to_create.append('workflow_space_members')
            logger.info("✓ workflow_space_members table will be created")
        else:
            logger.info("⊘ workflow_space_members table already exists")
        
        if not check_table_exists('workflow_prompt_associations'):
            tables_to_create.append('workflow_prompt_associations')
            logger.info("✓ workflow_prompt_associations table will be created")
        else:
            logger.info("⊘ workflow_prompt_associations table already exists")
        
        # Create tables if needed
        if tables_to_create:
            logger.info(f"\nCreating {len(tables_to_create)} table(s)...")
            try:
                # Create only the workflow space tables
                WorkflowSpace.__table__.create(db.engine, checkfirst=True)
                WorkflowSpaceMember.__table__.create(db.engine, checkfirst=True)
                WorkflowPromptAssociation.__table__.create(db.engine, checkfirst=True)
                
                logger.info("✓ Migration completed successfully!")
                logger.info("\nNew tables created:")
                for table in tables_to_create:
                    logger.info(f"  - {table}")
                
                # Verify tables were created
                logger.info("\nVerifying tables...")
                for table_name in ['workflow_spaces', 'workflow_space_members', 'workflow_prompt_associations']:
                    if check_table_exists(table_name):
                        logger.info(f"  ✓ {table_name} exists")
                    else:
                        logger.error(f"  ✗ {table_name} was not created!")
                
            except Exception as e:
                logger.error(f"✗ Migration failed: {str(e)}")
                raise
        else:
            logger.info("\n✓ All tables already exist. No migration needed.")
        
        logger.info("\nMigration process complete!")


if __name__ == '__main__':
    try:
        migrate_workflow_spaces()
    except Exception as e:
        logger.error(f"Migration error: {str(e)}")
        sys.exit(1)
