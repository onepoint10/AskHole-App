"""
File Conversion Utility Module
Handles conversion of Office documents to PDF format for AI processing
"""

import os
import tempfile
import subprocess
import shutil
from pathlib import Path
import logging
from typing import Optional, Tuple

# Office document processing libraries
try:
    from docx import Document
    from openpyxl import load_workbook
    from pptx import Presentation
    OFFICE_LIBS_AVAILABLE = True
except ImportError:
    OFFICE_LIBS_AVAILABLE = False
    logging.warning("Office document libraries not available. Document conversion will be limited.")

# LibreOffice conversion (preferred method)
try:
    subprocess.run(['libreoffice', '--version'], capture_output=True, check=True)
    LIBREOFFICE_AVAILABLE = True
except (subprocess.CalledProcessError, FileNotFoundError):
    LIBREOFFICE_AVAILABLE = False
    logging.warning("LibreOffice not available. Using Python libraries for conversion.")

class FileConverter:
    """Handles conversion of various file formats to PDF"""
    
    @staticmethod
    def convert_to_pdf(file_path: str, output_dir: str = None) -> Optional[str]:
        """
        Convert a file to PDF format
        
        Args:
            file_path: Path to the input file
            output_dir: Directory to save the converted PDF (optional)
            
        Returns:
            Path to the converted PDF file, or None if conversion failed
        """
        if not os.path.exists(file_path):
            logging.error(f"File not found: {file_path}")
            return None
            
        file_ext = Path(file_path).suffix.lower()
        
        # If it's already a PDF, return the path
        if file_ext == '.pdf':
            return file_path
            
        # If it's a text file, convert to PDF
        if file_ext in ['.txt', '.md', '.py', '.js', '.html', '.css', '.xml', '.json', '.csv']:
            return FileConverter._convert_text_to_pdf(file_path, output_dir)
            
        # If it's an Office document, convert to PDF
        if file_ext in ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']:
            return FileConverter._convert_office_to_pdf(file_path, output_dir)
            
        # If it's an image, convert to PDF
        if file_ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
            return FileConverter._convert_image_to_pdf(file_path, output_dir)
            
        logging.warning(f"Unsupported file type for conversion: {file_ext}")
        return None
    
    @staticmethod
    def _convert_office_to_pdf(file_path: str, output_dir: str = None) -> Optional[str]:
        """Convert Office documents to PDF using LibreOffice or Python libraries"""
        
        # Try LibreOffice first (most reliable)
        if LIBREOFFICE_AVAILABLE:
            result = FileConverter._convert_with_libreoffice(file_path, output_dir)
            if result:
                return result
        
        # Fallback to Python libraries
        if OFFICE_LIBS_AVAILABLE:
            return FileConverter._convert_with_python_libs(file_path, output_dir)
        
        logging.error("No conversion method available for Office documents")
        return None
    
    @staticmethod
    def _convert_with_libreoffice(file_path: str, output_dir: str = None) -> Optional[str]:
        """Convert Office documents using LibreOffice"""
        try:
            if output_dir is None:
                output_dir = os.path.dirname(file_path)
            
            # Create temporary directory for conversion
            with tempfile.TemporaryDirectory() as temp_dir:
                # Copy file to temp directory
                temp_file = os.path.join(temp_dir, os.path.basename(file_path))
                shutil.copy2(file_path, temp_file)
                
                # Run LibreOffice conversion
                cmd = [
                    'libreoffice',
                    '--headless',
                    '--convert-to', 'pdf',
                    '--outdir', temp_dir,
                    temp_file
                ]
                
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=60  # 60 second timeout
                )
                
                if result.returncode == 0:
                    # Find the converted PDF
                    pdf_name = os.path.splitext(os.path.basename(file_path))[0] + '.pdf'
                    temp_pdf = os.path.join(temp_dir, pdf_name)
                    
                    if os.path.exists(temp_pdf):
                        # Move to output directory
                        output_pdf = os.path.join(output_dir, pdf_name)
                        shutil.move(temp_pdf, output_pdf)
                        logging.info(f"Successfully converted {file_path} to {output_pdf}")
                        return output_pdf
                
                logging.error(f"LibreOffice conversion failed: {result.stderr}")
                return None
                
        except subprocess.TimeoutExpired:
            logging.error(f"LibreOffice conversion timed out for {file_path}")
            return None
        except Exception as e:
            logging.error(f"LibreOffice conversion error for {file_path}: {e}")
            return None
    
    @staticmethod
    def _convert_with_python_libs(file_path: str, output_dir: str = None) -> Optional[str]:
        """Convert Office documents using Python libraries"""
        try:
            file_ext = Path(file_path).suffix.lower()
            
            if output_dir is None:
                output_dir = os.path.dirname(file_path)
            
            # Extract text content
            text_content = ""
            
            if file_ext in ['.docx']:
                doc = Document(file_path)
                text_content = '\n'.join([paragraph.text for paragraph in doc.paragraphs])
                
            elif file_ext in ['.xlsx']:
                wb = load_workbook(file_path, read_only=True)
                for sheet_name in wb.sheetnames:
                    sheet = wb[sheet_name]
                    text_content += f"\n=== {sheet_name} ===\n"
                    for row in sheet.iter_rows(values_only=True):
                        if any(cell is not None for cell in row):
                            text_content += '\t'.join(str(cell) if cell is not None else '' for cell in row) + '\n'
                wb.close()
                
            elif file_ext in ['.pptx']:
                prs = Presentation(file_path)
                for slide in prs.slides:
                    for shape in slide.shapes:
                        if hasattr(shape, "text"):
                            text_content += shape.text + '\n'
                    text_content += '\n'
            
            if text_content.strip():
                # Convert extracted text to PDF
                return FileConverter._convert_text_to_pdf_from_content(text_content, file_path, output_dir)
            
            return None
            
        except Exception as e:
            logging.error(f"Python library conversion error for {file_path}: {e}")
            return None
    
    @staticmethod
    def _convert_text_to_pdf(file_path: str, output_dir: str = None) -> Optional[str]:
        """Convert text files to PDF"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return FileConverter._convert_text_to_pdf_from_content(content, file_path, output_dir)
        except Exception as e:
            logging.error(f"Text file conversion error for {file_path}: {e}")
            return None
    
    @staticmethod
    def _convert_text_to_pdf_from_content(content: str, original_file: str, output_dir: str = None) -> Optional[str]:
        """Convert text content to PDF"""
        try:
            if output_dir is None:
                output_dir = os.path.dirname(original_file)
            
            # Create a simple HTML representation
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>{os.path.basename(original_file)}</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }}
                    pre {{ background-color: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }}
                    .filename {{ color: #666; font-size: 12px; margin-bottom: 20px; }}
                </style>
            </head>
            <body>
                <div class="filename">File: {os.path.basename(original_file)}</div>
                <pre>{content}</pre>
            </body>
            </html>
            """
            
            # Save HTML temporarily
            html_path = os.path.join(output_dir, f"{os.path.splitext(os.path.basename(original_file))[0]}.html")
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            # Convert HTML to PDF using wkhtmltopdf if available
            try:
                pdf_path = os.path.join(output_dir, f"{os.path.splitext(os.path.basename(original_file))[0]}.pdf")
                
                # Try wkhtmltopdf
                cmd = ['wkhtmltopdf', '--quiet', html_path, pdf_path]
                result = subprocess.run(cmd, capture_output=True, timeout=30)
                
                if result.returncode == 0 and os.path.exists(pdf_path):
                    # Clean up HTML file
                    os.remove(html_path)
                    return pdf_path
                    
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass
            
            # Fallback: return HTML file (can be processed as text)
            logging.warning(f"PDF conversion not available, returning HTML: {html_path}")
            return html_path
            
        except Exception as e:
            logging.error(f"Text to PDF conversion error: {e}")
            return None
    
    @staticmethod
    def _convert_image_to_pdf(file_path: str, output_dir: str = None) -> Optional[str]:
        """Convert images to PDF"""
        try:
            from PIL import Image
            
            if output_dir is None:
                output_dir = os.path.dirname(file_path)
            
            # Open image
            img = Image.open(file_path)
            
            # Convert to RGB if necessary
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Create PDF path
            pdf_path = os.path.join(output_dir, f"{os.path.splitext(os.path.basename(file_path))[0]}.pdf")
            
            # Save as PDF
            img.save(pdf_path, 'PDF', resolution=100.0)
            
            return pdf_path
            
        except Exception as e:
            logging.error(f"Image to PDF conversion error for {file_path}: {e}")
            return None
    
    @staticmethod
    def get_supported_formats() -> list:
        """Get list of supported input formats"""
        formats = ['.txt', '.md', '.py', '.js', '.html', '.css', '.xml', '.json', '.csv']
        
        if OFFICE_LIBS_AVAILABLE or LIBREOFFICE_AVAILABLE:
            formats.extend(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'])
        
        formats.extend(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'])
        
        return formats