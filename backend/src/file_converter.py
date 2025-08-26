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

# PDF generation (ReportLab)
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logging.warning("ReportLab not available. Falling back to LibreOffice or HTML.")

# LibreOffice conversion (fallback method)
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
        if not os.path.exists(file_path):
            logging.error(f"File not found: {file_path}")
            return None
        
        file_ext = Path(file_path).suffix.lower()
        if file_ext == '.pdf':
            return file_path
        
        # Prefer dedicated python conversion + reportlab for Office and text
        if file_ext in ['.doc', '.docx']:
            pdf = FileConverter._convert_doc_docx_to_pdf_python(file_path, output_dir)
            if pdf:
                return pdf
            # fallback
            return FileConverter._convert_with_libreoffice(file_path, output_dir)
        
        if file_ext in ['.xls', '.xlsx']:
            pdf = FileConverter._convert_xls_xlsx_to_pdf_python(file_path, output_dir)
            if pdf:
                return pdf
            return FileConverter._convert_with_libreoffice(file_path, output_dir)
        
        if file_ext in ['.ppt', '.pptx']:
            pdf = FileConverter._convert_ppt_pptx_to_pdf_python(file_path, output_dir)
            if pdf:
                return pdf
            return FileConverter._convert_with_libreoffice(file_path, output_dir)
        
        if file_ext in ['.txt', '.md', '.py', '.js', '.html', '.css', '.xml', '.json', '.csv']:
            return FileConverter._convert_text_to_pdf(file_path, output_dir)
        
        if file_ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
            return FileConverter._convert_image_to_pdf(file_path, output_dir)
        
        logging.warning(f"Unsupported file type for conversion: {file_ext}")
        return None

    @staticmethod
    def _output_pdf_path(file_path: str, output_dir: Optional[str]) -> str:
        if output_dir is None:
            output_dir = os.path.dirname(file_path)
        base = os.path.splitext(os.path.basename(file_path))[0]
        return os.path.join(output_dir, f"{base}.pdf")

    @staticmethod
    def _convert_doc_docx_to_pdf_python(file_path: str, output_dir: Optional[str]) -> Optional[str]:
        if not (OFFICE_LIBS_AVAILABLE and REPORTLAB_AVAILABLE):
            return None
        try:
            pdf_path = FileConverter._output_pdf_path(file_path, output_dir)
            doc = Document(file_path)

            pdf_doc = SimpleDocTemplate(pdf_path, pagesize=letter)
            styles = getSampleStyleSheet()
            story = []

            title_style = ParagraphStyle(
                'ConvertedTitle', parent=styles['Heading1'], fontSize=16, spaceAfter=20
            )
            story.append(Paragraph(f"Converted from: {os.path.basename(file_path)}", title_style))
            story.append(Spacer(1, 12))

            for paragraph in doc.paragraphs:
                text = paragraph.text.strip()
                if text:
                    story.append(Paragraph(text, styles['Normal']))
                    story.append(Spacer(1, 6))

            pdf_doc.build(story)
            return pdf_path if os.path.exists(pdf_path) else None
        except Exception as e:
            logging.error(f"DOC/DOCX to PDF (python) error for {file_path}: {e}")
            return None

    @staticmethod
    def _convert_xls_xlsx_to_pdf_python(file_path: str, output_dir: Optional[str]) -> Optional[str]:
        if not (OFFICE_LIBS_AVAILABLE and REPORTLAB_AVAILABLE):
            return None
        try:
            pdf_path = FileConverter._output_pdf_path(file_path, output_dir)
            wb = load_workbook(file_path, read_only=True)

            pdf_doc = SimpleDocTemplate(pdf_path, pagesize=letter)
            styles = getSampleStyleSheet()
            story = []

            title_style = ParagraphStyle(
                'ConvertedTitle', parent=styles['Heading1'], fontSize=16, spaceAfter=20
            )
            story.append(Paragraph(f"Converted from: {os.path.basename(file_path)}", title_style))
            story.append(Spacer(1, 12))

            for sheet_name in wb.sheetnames:
                story.append(Paragraph(f"Sheet: {sheet_name}", styles['Heading2']))
                sheet = wb[sheet_name]
                for row in sheet.iter_rows(values_only=True):
                    if any(cell is not None for cell in row):
                        line = ' \u00b7 '.join(str(cell) if cell is not None else '' for cell in row)
                        story.append(Paragraph(line, styles['Normal']))
            wb.close()

            pdf_doc.build(story)
            return pdf_path if os.path.exists(pdf_path) else None
        except Exception as e:
            logging.error(f"XLS/XLSX to PDF (python) error for {file_path}: {e}")
            return None

    @staticmethod
    def _convert_ppt_pptx_to_pdf_python(file_path: str, output_dir: Optional[str]) -> Optional[str]:
        if not (OFFICE_LIBS_AVAILABLE and REPORTLAB_AVAILABLE):
            return None
        try:
            pdf_path = FileConverter._output_pdf_path(file_path, output_dir)
            prs = Presentation(file_path)

            pdf_doc = SimpleDocTemplate(pdf_path, pagesize=letter)
            styles = getSampleStyleSheet()
            story = []

            title_style = ParagraphStyle(
                'ConvertedTitle', parent=styles['Heading1'], fontSize=16, spaceAfter=20
            )
            story.append(Paragraph(f"Converted from: {os.path.basename(file_path)}", title_style))
            story.append(Spacer(1, 12))

            slide_num = 1
            for slide in prs.slides:
                story.append(Paragraph(f"Slide {slide_num}", styles['Heading2']))
                slide_num += 1
                for shape in slide.shapes:
                    if hasattr(shape, 'text'):
                        text = (shape.text or '').strip()
                        if text:
                            story.append(Paragraph(text, styles['Normal']))
                story.append(Spacer(1, 12))

            pdf_doc.build(story)
            return pdf_path if os.path.exists(pdf_path) else None
        except Exception as e:
            logging.error(f"PPT/PPTX to PDF (python) error for {file_path}: {e}")
            return None

    @staticmethod
    def _convert_with_libreoffice(file_path: str, output_dir: str = None) -> Optional[str]:
        if not LIBREOFFICE_AVAILABLE:
            return None
        try:
            if output_dir is None:
                output_dir = os.path.dirname(file_path)
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_file = os.path.join(temp_dir, os.path.basename(file_path))
                shutil.copy2(file_path, temp_file)
                cmd = ['libreoffice', '--headless', '--convert-to', 'pdf', '--outdir', temp_dir, temp_file]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                if result.returncode == 0:
                    pdf_name = os.path.splitext(os.path.basename(file_path))[0] + '.pdf'
                    temp_pdf = os.path.join(temp_dir, pdf_name)
                    if os.path.exists(temp_pdf):
                        output_pdf = os.path.join(output_dir, pdf_name)
                        shutil.move(temp_pdf, output_pdf)
                        logging.info(f"Successfully converted {file_path} to {output_pdf} via LibreOffice")
                        return output_pdf
                logging.error(f"LibreOffice conversion failed (code {result.returncode}): {result.stderr}")
                return None
        except subprocess.TimeoutExpired:
            logging.error(f"LibreOffice conversion timed out for {file_path}")
            return None
        except Exception as e:
            logging.error(f"LibreOffice conversion error for {file_path}: {e}")
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