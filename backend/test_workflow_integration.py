"""
Integration test for workflow features.
This script verifies that the new workflow models and APIs are properly integrated.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

def test_models_import():
    """Test that all workflow models can be imported"""
    print("Testing model imports...")
    try:
        from src.models.workflow import (
            WorkflowSpace, WorkflowSpaceMember, WorkflowPromptAssociation,
            PromptVersion, Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution
        )
        print("✓ All workflow models imported successfully")
        return True
    except Exception as e:
        print(f"✗ Failed to import models: {e}")
        return False


def test_routes_import():
    """Test that workflow routes can be imported"""
    print("\nTesting routes import...")
    try:
        from src.routes.workflow import workflow_bp
        print("✓ Workflow routes imported successfully")
        return True
    except Exception as e:
        print(f"✗ Failed to import routes: {e}")
        return False


def test_database_integration():
    """Test that models can be integrated with the database"""
    print("\nTesting database integration...")
    try:
        from src.database import db
        from src.models.workflow import WorkflowSpace
        from flask import Flask
        
        # Create test app
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        
        db.init_app(app)
        
        with app.app_context():
            # Create tables
            db.create_all()
            
            # Test creating a workspace
            workspace = WorkflowSpace(
                name='Test Workspace',
                description='Test description',
                owner_id=1
            )
            db.session.add(workspace)
            db.session.commit()
            
            # Test querying
            result = WorkflowSpace.query.first()
            assert result is not None
            assert result.name == 'Test Workspace'
            
        print("✓ Database integration working correctly")
        return True
    except Exception as e:
        print(f"✗ Database integration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_model_relationships():
    """Test that model relationships work correctly"""
    print("\nTesting model relationships...")
    try:
        from src.database import db
        from src.models.workflow import (
            WorkflowSpace, WorkflowSpaceMember, Workflow, WorkflowNode, WorkflowEdge
        )
        from flask import Flask
        
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        
        db.init_app(app)
        
        with app.app_context():
            db.create_all()
            
            # Create workspace
            workspace = WorkflowSpace(
                name='Test Workspace',
                owner_id=1
            )
            db.session.add(workspace)
            db.session.flush()
            
            # Create member
            member = WorkflowSpaceMember(
                workspace_id=workspace.id,
                user_id=1,
                role='owner'
            )
            db.session.add(member)
            
            # Create workflow
            workflow = Workflow(
                workspace_id=workspace.id,
                name='Test Workflow',
                created_by=1
            )
            db.session.add(workflow)
            db.session.flush()
            
            # Create nodes
            node1 = WorkflowNode(
                workflow_id=workflow.id,
                node_type='prompt',
                label='Node 1'
            )
            node2 = WorkflowNode(
                workflow_id=workflow.id,
                node_type='prompt',
                label='Node 2'
            )
            db.session.add_all([node1, node2])
            db.session.flush()
            
            # Create edge
            edge = WorkflowEdge(
                workflow_id=workflow.id,
                source_node_id=node1.id,
                target_node_id=node2.id
            )
            db.session.add(edge)
            db.session.commit()
            
            # Test relationships
            result = WorkflowSpace.query.first()
            assert len(result.members) == 1
            assert len(result.workflows) == 1
            assert len(result.workflows[0].nodes) == 2
            assert len(result.workflows[0].edges) == 1
            
        print("✓ Model relationships working correctly")
        return True
    except Exception as e:
        print(f"✗ Model relationships test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_to_dict_methods():
    """Test that to_dict methods work correctly"""
    print("\nTesting to_dict methods...")
    try:
        from src.database import db
        from src.models.workflow import WorkflowSpace, Workflow, WorkflowNode
        from flask import Flask
        
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        
        db.init_app(app)
        
        with app.app_context():
            db.create_all()
            
            workspace = WorkflowSpace(
                name='Test Workspace',
                description='Test',
                owner_id=1
            )
            db.session.add(workspace)
            db.session.flush()
            
            workflow = Workflow(
                workspace_id=workspace.id,
                name='Test Workflow',
                created_by=1
            )
            db.session.add(workflow)
            db.session.flush()
            
            node = WorkflowNode(
                workflow_id=workflow.id,
                node_type='prompt',
                label='Test Node'
            )
            db.session.add(node)
            db.session.commit()
            
            # Test to_dict
            workspace_dict = workspace.to_dict()
            assert 'id' in workspace_dict
            assert 'name' in workspace_dict
            assert workspace_dict['name'] == 'Test Workspace'
            
            workflow_dict = workflow.to_dict()
            assert 'id' in workflow_dict
            assert 'nodes' in workflow_dict
            assert len(workflow_dict['nodes']) == 1
            
        print("✓ to_dict methods working correctly")
        return True
    except Exception as e:
        print(f"✗ to_dict test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("Workflow Features Integration Test")
    print("=" * 60)
    
    results = []
    results.append(("Model Imports", test_models_import()))
    results.append(("Routes Import", test_routes_import()))
    results.append(("Database Integration", test_database_integration()))
    results.append(("Model Relationships", test_model_relationships()))
    results.append(("to_dict Methods", test_to_dict_methods()))
    
    print("\n" + "=" * 60)
    print("Test Results:")
    print("=" * 60)
    
    passed = 0
    failed = 0
    for name, result in results:
        status = "PASSED" if result else "FAILED"
        symbol = "✓" if result else "✗"
        print(f"{symbol} {name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"Total: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return failed == 0


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
