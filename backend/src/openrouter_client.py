import logging
import base64
import os
import mimetypes
import requests
import json
from typing import List, Tuple
from openai import OpenAI

class OpenRouterClient:
    """OpenRouter API client with PDF support"""

    def __init__(self, api_key: str):
        """Initialize OpenRouter client"""
        self.api_key = api_key
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1"
        )
        self.chat_sessions = {}  # Store conversation history
        logging.info("OpenRouter client initialized")

    def _prepare_file_content(self, files: List[str]) -> Tuple[List[dict], str]:
        """
        Prepare file content for OpenRouter API according to their specification
        Returns (file_contents, text_files_content)
        """
        file_contents = []
        text_files_content = ""

        for file_path in files:
            if not os.path.exists(file_path):
                logging.warning(f"File not found: {file_path}")
                continue

            file_extension = os.path.splitext(file_path)[1].lower()
            filename = os.path.basename(file_path)

            # Handle PDF files with base64 encoding
            if file_extension == '.pdf':
                try:
                    with open(file_path, 'rb') as f:
                        pdf_data = f.read()

                    # Encode PDF as base64 data URL
                    base64_pdf = base64.b64encode(pdf_data).decode('utf-8')
                    pdf_data_url = f"data:application/pdf;base64,{base64_pdf}"

                    # Use OpenRouter file format for PDFs
                    file_contents.append({
                        "type": "file",
                        "file": {
                            "filename": filename,
                            "file_data": pdf_data_url
                        }
                    })
                    logging.info(f"PDF file prepared for OpenRouter: {filename}")

                except Exception as e:
                    logging.error(f"Error preparing PDF {file_path}: {e}")
                    continue

            # Handle Excel files (.xls, .xlsx, .xlsm)
            elif file_extension in ['.xls', '.xlsx', '.xlsm']:
                try:
                    # Determine MIME type for Excel files
                    mime_types = {
                        '.xls': 'application/vnd.ms-excel',
                        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12'
                    }
                    mime_type = mime_types.get(file_extension, 'application/vnd.ms-excel')

                    with open(file_path, 'rb') as f:
                        excel_data = f.read()

                    # Encode Excel file as base64 data URL
                    base64_excel = base64.b64encode(excel_data).decode('utf-8')
                    excel_data_url = f"data:{mime_type};base64,{base64_excel}"

                    # Use OpenRouter file format for Excel files
                    file_contents.append({
                        "type": "file",
                        "file": {
                            "filename": filename,
                            "file_data": excel_data_url
                        }
                    })
                    logging.info(f"Excel file prepared for OpenRouter: {filename}")

                except Exception as e:
                    logging.error(f"Error preparing Excel file {file_path}: {e}")
                    continue

            # Handle image files
            elif file_extension.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                try:
                    # Determine MIME type
                    mime_types = {
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.png': 'image/png',
                        '.gif': 'image/gif',
                        '.webp': 'image/webp'
                    }
                    mime_type = mime_types.get(file_extension, 'image/jpeg')

                    with open(file_path, 'rb') as f:
                        image_data = f.read()

                    # Encode image as base64 data URL
                    base64_image = base64.b64encode(image_data).decode('utf-8')
                    image_data_url = f"data:{mime_type};base64,{base64_image}"

                    # Use image_url format for images
                    file_contents.append({
                        "type": "image_url",
                        "image_url": {
                            "url": image_data_url
                        }
                    })
                    logging.info(f"Image file prepared for OpenRouter: {filename}")

                except Exception as e:
                    logging.error(f"Error preparing image {file_path}: {e}")
                    continue

            # For other file types, include content as text if possible
            else:
                try:
                    # Try to read as text for supported text files
                    if file_extension in ['.txt', '.md', '.json', '.csv', '.py', '.js', '.html', '.css', '.xml', '.rtf', '.doc', '.docx']:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()

                        # Truncate if too long (limit to ~8000 chars to stay within token limits)
                        if len(content) > 8000:
                            content = content[:8000] + "... [content truncated]"

                        # Add as text content
                        file_note = f"\n\n--- Content of {filename} ---\n{content}\n--- End of {filename} ---"
                        text_files_content += file_note
                    else:
                        # For unsupported file types, just mention the file
                        file_note = f"\n\n[File attached: {filename} - This file type may not be fully processed by this model]"
                        text_files_content += file_note

                except Exception as e:
                    logging.error(f"Error reading file {file_path}: {e}")
                    continue

        return file_contents, text_files_content

    def chat_message(self, session_id: str, message: str, model: str = "deepseek/deepseek-r1:free",
                     files: List[str] = None, temperature: float = 1.0) -> str:
        """
        Send a chat message with conversation context and file support
        """
        try:
            # Get or create session history
            if session_id not in self.chat_sessions:
                self.chat_sessions[session_id] = []

            messages = self.chat_sessions[session_id].copy()

            # Prepare user message content
            content = []

            # Add text content
            text_content = message or ""

            # Handle file attachments
            if files:
                file_contents, text_files_content = self._prepare_file_content(files)

                # Add text files content to the main text
                if text_files_content:
                    text_content += text_files_content

                # Add binary files (PDFs, images) as separate content items
                content.extend(file_contents)

                # Add note about files if no text message
                if not message and not text_files_content and content:
                    text_content = "Please analyze the attached file(s)."

            # Always add text content (even if empty string)
            content.insert(0, {"type": "text", "text": text_content})

            # Create user message
            user_message = {"role": "user", "content": content}
            messages.append(user_message)

            # Check if we have PDF files to determine which API method to use
            has_pdf_files = any(
                content_item.get("type") == "file" for content_item in content if isinstance(content_item, dict))

            if has_pdf_files:
                # Use requests.post for PDF files
                response_content = self._send_request_with_pdf(model, messages, temperature)
                formatted_response = response_content  # No reasoning content available with direct requests
            else:
                # Use OpenAI SDK for non-PDF requests
                response = self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature
                )
                response_content = response.choices[0].message.content

                # Check if reasoning content is available (R1 specific feature)
                reasoning_content = getattr(response.choices[0].message, 'reasoning_content', None)
                if reasoning_content:
                    formatted_response = f"**Reasoning Process:**\n{reasoning_content}\n\n**Answer:**\n{response_content}"
                else:
                    formatted_response = response_content

            # Update session history with simplified content for storage
            messages.append({"role": "assistant", "content": response_content})
            self.chat_sessions[session_id] = messages

            logging.info(f"OpenRouter chat response generated for session {session_id}")
            return formatted_response

        except Exception as e:
            error_msg = f"OpenRouter API error: {str(e)}"
            logging.error(error_msg)
            raise Exception(error_msg)

    def generate_text(self, prompt: str, model: str = "deepseek/deepseek-r1:free",
                      files: List[str] = None, temperature: float = 1.0) -> str:
        """
        Generate text without conversation context but with file support
        """
        try:
            # Prepare content
            content = []

            # Add text content
            text_content = prompt or ""

            # Handle file attachments
            if files:
                file_contents, text_files_content = self._prepare_file_content(files)

                # Add text files content to the main text
                if text_files_content:
                    text_content += text_files_content

                # Add binary files (PDFs, images) as separate content items
                content.extend(file_contents)

                # Add note about files if no prompt
                if not prompt and not text_files_content and content:
                    text_content = "Please analyze the attached file(s)."

            # Always add text content (even if empty string)
            content.insert(0, {"type": "text", "text": text_content})

            messages = [{"role": "user", "content": content}]

            # Check if we have PDF files to determine which API method to use
            has_pdf_files = any(
                content_item.get("type") == "file" for content_item in content if isinstance(content_item, dict))

            if has_pdf_files:
                # Use requests.post for PDF files
                response_content = self._send_request_with_pdf(model, messages, temperature)
                formatted_response = response_content  # No reasoning content available with direct requests
            else:
                # Use OpenAI SDK for non-PDF requests
                response = self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature
                )
                response_content = response.choices[0].message.content

                # Check if reasoning content is available
                reasoning_content = getattr(response.choices[0].message, 'reasoning_content', None)
                if reasoning_content:
                    formatted_response = f"**Reasoning Process:**\n{reasoning_content}\n\n**Answer:**\n{response_content}"
                else:
                    formatted_response = response_content

            logging.info("OpenRouter text generation completed with files")
            return formatted_response

        except Exception as e:
            error_msg = f"OpenRouter API error: {str(e)}"
            logging.error(error_msg)
            raise Exception(error_msg)

    def _send_request_with_pdf(self, model: str, messages: list, temperature: float) -> str:
        """
        Send request with PDF files using requests.post directly
        """
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # Add PDF processing plugins
        plugins = [
            {
                "id": "file-parser",
                "pdf": {
                    "engine": "pdf-text"  # Use pdf-text engine for better text extraction
                }
            }
        ]

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "plugins": plugins
        }

        response = requests.post(url, headers=headers, json=payload)

        if response.status_code != 200:
            error_msg = f"HTTP {response.status_code}: {response.text}"
            raise Exception(error_msg)

        response_data = response.json()

        if 'choices' not in response_data or len(response_data['choices']) == 0:
            raise Exception("No response choices returned from OpenRouter API")

        return response_data['choices'][0]['message']['content']

    def clear_chat_session(self, session_id: str):
        """Clear chat session history"""
        if session_id in self.chat_sessions:
            del self.chat_sessions[session_id]
            logging.info(f"Cleared OpenRouter chat session: {session_id}")

    def get_available_models(self) -> List[str]:
        """Get list of available OpenRouter models"""
        return [
            "deepseek/deepseek-r1:free",
            "deepseek/deepseek-r1-0528:free",
            "tngtech/deepseek-r1t2-chimera:free",
            "tngtech/deepseek-r1t-chimera:free",
            "z-ai/glm-4.5-air:free",
            "openai/gpt-4o-mini:free",
            "openai/gpt-3.5-turbo:free",
            "meta-llama/llama-3.2-3b-instruct:free",
            "meta-llama/llama-3.2-1b-instruct:free",
            "qwen/qwen-2-7b-instruct:free"
        ]

    def test_connection(self) -> Tuple[bool, str]:
        """Test API connection"""
        try:
            response = self.client.chat.completions.create(
                model="deepseek/deepseek-r1:free",
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=10
            )
            return True, "OpenRouter connection successful"
        except Exception as e:
            return False, f"OpenRouter connection failed: {str(e)}"


class OpenRouterClientAsync:
    """Asynchronous wrapper for OpenRouter operations"""

    def __init__(self, openrouter_client: OpenRouterClient):
        self.client = openrouter_client

    def generate_audio_sync(self, text: str, callback):
        """Audio generation not supported by OpenRouter - return error"""
        callback(None, "Audio generation is not supported by OpenRouter. Please use Gemini for audio features.")

    def generate_image_sync(self, prompt: str, callback):
        """Image generation not supported by most OpenRouter models - return error"""
        callback(None, None,
                 "Image generation is not supported by most OpenRouter models. Please use Gemini for image features.")

    def edit_image_sync(self, image_path: str, prompt: str, callback):
        """Image editing not supported by most OpenRouter models - return error"""
        callback(None, None,
                 "Image editing is not supported by most OpenRouter models. Please use Gemini for image features.")