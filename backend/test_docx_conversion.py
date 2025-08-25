#!/usr/bin/env python3
"""
Test script for .docx file conversion functionality
"""

import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from src.file_converter import FileConverter

def test_docx_conversion():
    """Test the .docx file conversion functionality"""
    print("Testing .docx file conversion...")
    
    # Create a test .docx-like file (we'll create a simple text file and rename it for testing)
    test_content = """This is a test document for conversion.
    
It contains multiple lines and should be converted to PDF.

Features to test:
- Text formatting
- Multiple paragraphs
- Special characters: é, ñ, ü
- Numbers: 123, 456, 789
"""
    
    # Create a test file with .docx extension
    test_file = "test_document.docx"
    with open(test_file, "w", encoding="utf-8") as f:
        f.write(test_content)
    
    print(f"Created test file: {test_file}")
    print(f"File size: {os.path.getsize(test_file)} bytes")
    
    try:
        # Test conversion
        print("Converting .docx file to PDF...")
        result = FileConverter.convert_to_pdf(test_file)
        
        if result:
            print(f"✅ Conversion successful! Result: {result}")
            
            # Check if file exists
            if os.path.exists(result):
                print(f"✅ Converted file exists: {result}")
                print(f"✅ File size: {os.path.getsize(result)} bytes")
                
                # Check file extension
                file_ext = os.path.splitext(result)[1].lower()
                print(f"✅ Converted file extension: {file_ext}")
                
                if file_ext == '.pdf':
                    print("✅ Successfully converted to PDF!")
                else:
                    print(f"⚠️  Converted to {file_ext} (not PDF)")
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
    test_docx_conversion()