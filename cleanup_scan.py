#!/usr/bin/env python3
"""
AskHole Codebase Cleanup Tool
This script helps identify and optionally remove debug statements from the codebase.
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Tuple, Dict

class CodeCleanup:
    def __init__(self, root_path: str):
        self.root_path = Path(root_path)
        self.stats = {
            'files_scanned': 0,
            'console_log_found': 0,
            'print_found': 0,
            'logger_debug_found': 0,
            'test_endpoints_found': 0
        }

    def scan_file(self, filepath: Path) -> Dict[str, List[Tuple[int, str]]]:
        """Scan a file for debug statements."""
        results = {
            'console_log': [],
            'console_debug': [],
            'print_statements': [],
            'logger_debug': [],
            'test_routes': []
        }

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    # JavaScript/JSX console statements (keep error/warn)
                    if re.search(r'console\.log\(', line):
                        results['console_log'].append((line_num, line.strip()))
                        self.stats['console_log_found'] += 1

                    if re.search(r'console\.debug\(', line):
                        results['console_debug'].append((line_num, line.strip()))
                        self.stats['console_log_found'] += 1

                    # Python print statements
                    if re.search(r'^\s*print\(', line) and not re.search(r'#.*print', line):
                        results['print_statements'].append((line_num, line.strip()))
                        self.stats['print_found'] += 1

                    # Python logger.debug
                    if re.search(r'logger\.debug\(', line):
                        results['logger_debug'].append((line_num, line.strip()))
                        self.stats['logger_debug_found'] += 1

                    # Test/debug routes
                    if re.search(r'@.*route\(.*/test-|@.*route\(.*/debug-', line):
                        results['test_routes'].append((line_num, line.strip()))
                        self.stats['test_endpoints_found'] += 1

        except Exception as e:
            print(f"Error scanning {filepath}: {e}")

        return results

    def scan_directory(self, directory: Path, extensions: List[str]) -> Dict[str, Dict]:
        """Scan a directory for files with specific extensions."""
        all_results = {}

        for ext in extensions:
            for filepath in directory.rglob(f'*{ext}'):
                # Skip node_modules, __pycache__, etc.
                if any(skip in str(filepath) for skip in ['node_modules', '__pycache__', '.git', 'dist', 'build']):
                    continue

                self.stats['files_scanned'] += 1
                results = self.scan_file(filepath)

                # Only store files with findings
                if any(results.values()):
                    all_results[str(filepath)] = results

        return all_results

    def generate_report(self, results: Dict[str, Dict]) -> str:
        """Generate a markdown report of findings."""
        report = ["# Code Cleanup Scan Results\n"]
        report.append(f"**Files Scanned**: {self.stats['files_scanned']}\n")
        report.append(f"**console.log Found**: {self.stats['console_log_found']}\n")
        report.append(f"**print() Found**: {self.stats['print_found']}\n")
        report.append(f"**logger.debug Found**: {self.stats['logger_debug_found']}\n")
        report.append(f"**Test Endpoints Found**: {self.stats['test_endpoints_found']}\n\n")

        report.append("---\n\n")

        for filepath, findings in sorted(results.items()):
            has_findings = False
            file_section = [f"\n## {filepath}\n\n"]

            if findings['console_log']:
                has_findings = True
                file_section.append(f"### console.log Statements ({len(findings['console_log'])})\n")
                for line_num, line in findings['console_log']:
                    file_section.append(f"- Line {line_num}: `{line}`\n")
                file_section.append("\n")

            if findings['print_statements']:
                has_findings = True
                file_section.append(f"### print() Statements ({len(findings['print_statements'])})\n")
                for line_num, line in findings['print_statements']:
                    file_section.append(f"- Line {line_num}: `{line}`\n")
                file_section.append("\n")

            if findings['logger_debug']:
                has_findings = True
                file_section.append(f"### logger.debug() Statements ({len(findings['logger_debug'])})\n")
                for line_num, line in findings['logger_debug']:
                    file_section.append(f"- Line {line_num}: `{line}`\n")
                file_section.append("\n")

            if findings['test_routes']:
                has_findings = True
                file_section.append(f"### ⚠️ Test/Debug Routes ({len(findings['test_routes'])})\n")
                for line_num, line in findings['test_routes']:
                    file_section.append(f"- Line {line_num}: `{line}`\n")
                file_section.append("\n")

            if has_findings:
                report.extend(file_section)

        return ''.join(report)

    def run_scan(self):
        """Run the complete scan."""
        print("🔍 Scanning AskHole codebase for debug statements...")
        print(f"📁 Root: {self.root_path}\n")

        # Scan frontend
        print("Scanning frontend...")
        frontend_path = self.root_path / 'frontend' / 'src'
        frontend_results = self.scan_directory(frontend_path, ['.js', '.jsx'])

        # Scan backend
        print("Scanning backend...")
        backend_path = self.root_path / 'backend' / 'src'
        backend_results = self.scan_directory(backend_path, ['.py'])

        # Combine results
        all_results = {**frontend_results, **backend_results}

        # Generate report
        print("\n📊 Generating report...")
        report = self.generate_report(all_results)

        # Save report
        report_path = self.root_path / 'CLEANUP_SCAN_RESULTS.md'
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)

        print(f"✅ Report saved to: {report_path}")
        print(f"\n📈 Summary:")
        print(f"   - Files scanned: {self.stats['files_scanned']}")
        print(f"   - console.log found: {self.stats['console_log_found']}")
        print(f"   - print() found: {self.stats['print_found']}")
        print(f"   - logger.debug found: {self.stats['logger_debug_found']}")
        print(f"   - Test endpoints found: {self.stats['test_endpoints_found']}")

def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        root_path = sys.argv[1]
    else:
        root_path = os.getcwd()

    if not os.path.exists(root_path):
        print(f"❌ Error: Path '{root_path}' does not exist")
        sys.exit(1)

    cleanup = CodeCleanup(root_path)
    cleanup.run_scan()

if __name__ == '__main__':
    main()
