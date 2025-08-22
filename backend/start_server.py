#!/usr/bin/env python3

import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

try:
    from main import app
    print("✅ Flask app created successfully")
    print("🚀 Starting server on http://localhost:5000")
    print("📱 Device persistence features enabled:")
    print("   - Remember Me functionality (90 days)")
    print("   - Device fingerprinting")
    print("   - Automatic session renewal")
    print("   - Device management")
    print("\nPress Ctrl+C to stop the server")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure all dependencies are installed:")
    print("pip install -r requirements.txt --break-system-packages")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error starting server: {e}")
    sys.exit(1)