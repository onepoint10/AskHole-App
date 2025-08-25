#!/usr/bin/env python3
"""
Test script for file conversion functionality
"""

import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from src.file_converter import FileConverter

def test_file_conversion():
    """Test the file conversion functionality"""
    print("Testing file conversion...")
    
    # Create a test document
    test_content = """This is a test document for conversion.
    
It contains multiple lines and should be converted to PDF.

Features to test:
- Text formatting
- Multiple paragraphs
- Special characters: é, ñ, ü
- Numbers: 123, 456, 789
"""
    
    test_file = "test_document.txt"
    with open(test_file, "w", encoding="utf-8") as f:
        f.write(test_content)
    
    print(f"Created test file: {test_file}")
    
    try:
        # Test conversion
        print("Converting file to PDF...")
        result = FileConverter.convert_to_pdf(test_file)
        
        if result:
            print(f"✅ Conversion successful! Result: {result}")
            
            # Check if file exists
            if os.path.exists(result):
                print(f"✅ Converted file exists: {result}")
                print(f"✅ File size: {os.path.getsize(result)} bytes")
            else:
                print(f"❌ Converted file not found: {result}")
        else:
            print("❌ Conversion failed - no result returned")
            
    except Exception as e:
        print(f"❌ Conversion error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up test files
        if os.path.exists(test_file):
            os.remove(test_file)
            print(f"Cleaned up: {test_file}")
        
        # Clean up converted file if it exists
        if 'result' in locals() and result and os.path.exists(result):
            os.remove(result)
            print(f"Cleaned up: {result}")

if __name__ == "__main__":
    test_file_conversion()