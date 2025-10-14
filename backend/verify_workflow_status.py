"""Quick verification script to check workflow implementation status."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.main import create_app, db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def verify_implementation():
    """Verify that workflow features are properly implemented."""
    app = create_app()
    
    with app.app_context():
        logger.info("=" * 70)
        logger.info("WORKFLOW IMPLEMENTATION STATUS")
        logger.info("=" * 70)
        
        # Check database tables
        logger.info("\n1. Database Tables:")
        inspector = db.inspect(db.engine)
        existing_tables = inspector.get_table_names()
        
        required_tables = [
            'workflow_spaces',
            'workflow_space_members',
            'workflow_prompt_associations',
            'prompt_versions',
            'workflows',
            'workflow_nodes',
            'workflow_edges',
            'workflow_executions'
        ]
        
        all_exist = True
        for table in required_tables:
            exists = table in existing_tables
            status = "✓" if exists else "✗ MISSING"
            logger.info(f"   {status} {table}")
            if not exists:
                all_exist = False
        
        if not all_exist:
            logger.info("\n   Creating missing tables...")
            try:
                db.create_all()
                logger.info("   ✓ Tables created successfully!")
            except Exception as e:
                logger.error(f"   ✗ Error creating tables: {e}")
                return False
        
        # Check blueprints
        logger.info("\n2. Registered Blueprints:")
        for blueprint in app.blueprints:
            logger.info(f"   ✓ {blueprint}")
        
        if 'workflow' in app.blueprints:
            logger.info("   ✓ workflow blueprint is registered")
        else:
            logger.error("   ✗ workflow blueprint is NOT registered")
            return False
        
        # Check routes
        logger.info("\n3. Workflow Routes:")
        workflow_routes = [rule for rule in app.url_map.iter_rules() if 'workflow' in rule.rule or 'workspace' in rule.rule]
        
        if workflow_routes:
            for route in sorted(workflow_routes, key=lambda r: r.rule):
                methods = ', '.join(sorted(route.methods - {'HEAD', 'OPTIONS'}))
                logger.info(f"   ✓ {methods:20} {route.rule}")
        else:
            logger.warning("   ⚠ No workflow routes found!")
        
        logger.info("\n" + "=" * 70)
        logger.info("SUMMARY")
        logger.info("=" * 70)
        logger.info(f"Database Tables: {'✓ OK' if all_exist else '✗ MISSING TABLES'}")
        logger.info(f"Blueprint: {'✓ OK' if 'workflow' in app.blueprints else '✗ NOT REGISTERED'}")
        logger.info(f"Routes: {'✓ OK' if workflow_routes else '✗ NO ROUTES'}")
        
        if all_exist and 'workflow' in app.blueprints and workflow_routes:
            logger.info("\n✓ Workflow implementation is ready to use!")
            logger.info("\nNext steps:")
            logger.info("1. Start the backend: python src/main.py")
            logger.info("2. Test the API: curl http://localhost:5000/api/workspaces")
            logger.info("3. Integrate frontend components into App.jsx")
            return True
        else:
            logger.error("\n✗ Workflow implementation has issues - see errors above")
            return False

if __name__ == '__main__':
    success = verify_implementation()
    sys.exit(0 if success else 1)
