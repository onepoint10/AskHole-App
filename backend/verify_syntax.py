"""
Syntax verification for workflow features.
This script checks that all Python files have valid syntax.
"""

import sys
import os
import py_compile

def check_file_syntax(filepath):
    """Check if a Python file has valid syntax"""
    try:
        py_compile.compile(filepath, doraise=True)
        return True, None
    except py_compile.PyCompileError as e:
        return False, str(e)


def main():
    """Check syntax of all workflow-related files"""
    print("=" * 60)
    print("Workflow Features Syntax Verification")
    print("=" * 60)
    
    backend_dir = os.path.dirname(__file__)
    
    files_to_check = [
        os.path.join(backend_dir, 'src', 'models', 'workflow.py'),
        os.path.join(backend_dir, 'src', 'routes', 'workflow.py'),
        os.path.join(backend_dir, 'test_workflow_integration.py'),
    ]
    
    results = []
    
    for filepath in files_to_check:
        print(f"\nChecking {os.path.relpath(filepath, backend_dir)}...")
        if not os.path.exists(filepath):
            print(f"  ✗ File not found")
            results.append((filepath, False, "File not found"))
            continue
            
        success, error = check_file_syntax(filepath)
        if success:
            print(f"  ✓ Syntax OK")
            results.append((filepath, True, None))
        else:
            print(f"  ✗ Syntax Error: {error}")
            results.append((filepath, False, error))
    
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    
    passed = sum(1 for _, success, _ in results if success)
    failed = sum(1 for _, success, _ in results if not success)
    
    for filepath, success, error in results:
        status = "✓ PASSED" if success else "✗ FAILED"
        filename = os.path.relpath(filepath, backend_dir)
        print(f"{status}: {filename}")
        if error:
            print(f"  Error: {error}")
    
    print("\n" + "=" * 60)
    print(f"Total: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed == 0:
        print("\n✓ All files have valid Python syntax!")
    else:
        print("\n✗ Some files have syntax errors. Please fix them.")
    
    return failed == 0


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
