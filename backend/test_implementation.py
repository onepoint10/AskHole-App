#!/usr/bin/env python3
"""
Test script to verify the public prompt functionality implementation.
This script tests the API endpoints without starting the full server.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.database import db
from src.models.chat import PromptTemplate, PromptLike
from src.models.user import User

def test_models():
    """Test that the models are properly defined."""
    print("Testing models...")
    
    # Test PromptTemplate model
    print("✓ PromptTemplate model imported successfully")
    print(f"  - Columns: {[c.name for c in PromptTemplate.__table__.columns]}")
    
    # Test PromptLike model
    print("✓ PromptLike model imported successfully")
    print(f"  - Columns: {[c.name for c in PromptLike.__table__.columns]}")
    
    # Check if new fields exist
    if hasattr(PromptTemplate, 'is_public'):
        print("✓ is_public field exists")
    else:
        print("✗ is_public field missing")
    
    if hasattr(PromptTemplate, 'likes_count'):
        print("✓ likes_count field exists")
    else:
        print("✗ likes_count field missing")

def test_database_schema():
    """Test the database schema."""
    print("\nTesting database schema...")
    
    try:
        # Initialize database
        from src.main import create_app
        app = create_app()
        
        with app.app_context():
            # Check if tables exist
            inspector = db.inspect(db.engine)
            tables = inspector.get_table_names()
            
            if 'prompt_templates' in tables:
                print("✓ prompt_templates table exists")
                
                # Check columns
                columns = inspector.get_columns('prompt_templates')
                column_names = [col['name'] for col in columns]
                
                if 'is_public' in column_names:
                    print("✓ is_public column exists")
                else:
                    print("✗ is_public column missing")
                
                if 'likes_count' in column_names:
                    print("✓ likes_count column exists")
                else:
                    print("✗ likes_count column missing")
            else:
                print("✗ prompt_templates table missing")
            
            if 'prompt_likes' in tables:
                print("✓ prompt_likes table exists")
            else:
                print("✗ prompt_likes table missing")
                
    except Exception as e:
        print(f"✗ Database schema test failed: {e}")

def test_api_routes():
    """Test that API routes are properly defined."""
    print("\nTesting API routes...")
    
    try:
        from src.routes.chat import chat_bp
        
        # Get all routes from the blueprint
        routes = []
        for rule in chat_bp.url_map.iter_rules():
            routes.append(f"{rule.methods} {rule.rule}")
        
        # Check for new routes
        new_routes = [
            "GET /public-prompts",
            "POST /prompts/<int:prompt_id>/like",
            "GET /prompts/<int:prompt_id>/like-status"
        ]
        
        for route in new_routes:
            method, path = route.split(' ', 1)
            found = any(method in r and path.replace('<int:', '<').replace('>', '') in r for r in routes)
            if found:
                print(f"✓ {route} route exists")
            else:
                print(f"✗ {route} route missing")
                
    except Exception as e:
        print(f"✗ API routes test failed: {e}")

if __name__ == "__main__":
    print("PromptHub Public Prompts Implementation Test")
    print("=" * 50)
    
    test_models()
    test_database_schema()
    test_api_routes()
    
    print("\n" + "=" * 50)
    print("Test completed!")