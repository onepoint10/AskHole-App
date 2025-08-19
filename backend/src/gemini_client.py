"""
Gemini API Client Module
Handles all interactions with Google's Gemini AI models
"""

from google import genai
from google.genai import types
from google.genai.types import (
    GenerateContentConfig,
    GoogleSearch,
    Tool, UrlContext,
)
import io
import tempfile
import os
import asyncio
import wave
import soundfile as sf
import librosa
from PIL import Image
import mimetypes
from datetime import datetime
import threading


class GeminiClient:
    """Main client for interacting with Gemini AI models"""

    def __init__(self, api_key: str):
        """Initialize the Gemini client with API key"""
        self.client = genai.Client(api_key=api_key)
        # Store API key so callers can detect changes and avoid unnecessary reinitialization
        self.api_key = api_key
        self.chat_sessions = {}  # Store chat sessions by session_id

    def get_available_models(self):
        """Get list of available Gemini models"""
        return [
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-2.5-flash-lite-preview-06-17"
        ]

    def create_chat_session(self, session_id: str, model: str):
        """Create a new chat session with specified model"""
        chat = self.client.chats.create(model=model)
        self.chat_sessions[session_id] = {
            'chat': chat,
            'model': model,
            'message_count': 0
        }
        print(f"Created new chat session {session_id} with model {model}")
        return chat

    def create_chat_session_with_history(self, session_id: str, model: str, history_messages=None):
        """Create a new chat session and optionally preload history.

        history_messages format: list of dicts like {"role": "user"|"model", "parts": ["text"]}
        """
        if history_messages and isinstance(history_messages, list) and len(history_messages) > 0:
            try:
                chat = self.client.chats.create(model=model, history=history_messages)
            except Exception as e:
                print(f"Failed to create chat with history, falling back without history: {e}")
                chat = self.client.chats.create(model=model)
        else:
            chat = self.client.chats.create(model=model)

        self.chat_sessions[session_id] = {
            'chat': chat,
            'model': model,
            'message_count': 0
        }
        print(f"Created new chat session {session_id} with model {model} (with_history={bool(history_messages)})")
        return chat

    def get_chat_session(self, session_id: str, model: str = None, history_messages=None):
        """Get existing chat session; if absent, create it (optionally with history)."""
        if session_id not in self.chat_sessions:
            # If no model specified for new session, this shouldn't happen
            if not model:
                raise Exception(f"Session {session_id} not found and no model specified for creation")
            return self.create_chat_session_with_history(session_id, model, history_messages)

        session_data = self.chat_sessions[session_id]

        # Log if someone tries to change model (but don't allow it)
        if model and session_data['model'] != model:
            print(
                f"WARNING: Attempt to change model from {session_data['model']} to {model} for session {session_id}. Ignoring - session will continue with {session_data['model']}")

        return session_data['chat']

    def get_session_model(self, session_id: str):
        """Get the model used by a specific session"""
        if session_id not in self.chat_sessions:
            return None
        return self.chat_sessions[session_id]['model']

    def clear_chat_session(self, session_id: str):
        """Clear chat session"""
        if session_id in self.chat_sessions:
            print(f"Clearing chat session {session_id}")
            del self.chat_sessions[session_id]

    def get_chat_history(self, session_id: str):
        """Get chat history for session"""
        if session_id not in self.chat_sessions:
            return []

        try:
            chat = self.chat_sessions[session_id]['chat']
            return chat.get_history()
        except Exception as e:
            print(f"Error getting chat history for session {session_id}: {e}")
            return []

    def generate_text(self, prompt: str, model: str, files=None, temperature: float = 1.0):
        """Generate text response (one-off, not part of chat session)"""
        content_parts = [prompt]

        if files:
            for file_path in files:
                uploaded_file = self._upload_file(file_path)
                if uploaded_file:
                    content_parts.append(uploaded_file)

        try:
            response = self.client.models.generate_content(
                model=model,
                contents=content_parts,
                config=GenerateContentConfig(
                    tools=[Tool(google_search=GoogleSearch()), Tool(url_context=UrlContext)],
                    temperature=temperature,
                )
            )
            return response.text
        except Exception as e:
            raise Exception(f"Text generation error: {str(e)}")

    def chat_message(self, session_id: str, message: str, model: str = None, files=None, temperature: float = 1.0, history_messages=None):
        """Send message in chat mode - session keeps its original model.

        history_messages: optional list used only when creating a new chat session.
        """
        # Get or create chat session (model only used for creation)
        chat = self.get_chat_session(session_id, model, history_messages)

        # Get the actual model this session is using
        session_model = self.chat_sessions[session_id]['model']

        content_parts = [message]

        if files:
            for file_path in files:
                uploaded_file = self._upload_file(file_path)
                if uploaded_file:
                    content_parts.append(uploaded_file)

        try:
            # Send message with session's original model and configuration
            response = chat.send_message(
                content_parts,
                config=GenerateContentConfig(
                    tools=[Tool(google_search=GoogleSearch()), Tool(url_context=UrlContext)],
                    temperature=temperature,
                )
            )

            # Update message count
            self.chat_sessions[session_id]['message_count'] += 1

            print(f"Sent message to session {session_id} using model {session_model}")
            return response.text

        except Exception as e:
            print(f"Error in chat_message for session {session_id}: {str(e)}")
            raise Exception(f"Chat message error: {str(e)}")

    def generate_image(self, prompt: str):
        """Generate image from text prompt"""
        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash-preview-image-generation",
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_modalities=['TEXT', 'IMAGE']
                )
            )

            images = []
            description = ""

            for part in response.candidates[0].content.parts:
                if part.text is not None:
                    description = part.text
                elif part.inline_data is not None:
                    # Convert to PIL Image
                    image = Image.open(io.BytesIO(part.inline_data.data))
                    images.append(image)

            return images, description
        except Exception as e:
            raise Exception(f"Image generation error: {str(e)}")

    def edit_image(self, image_path: str, instruction: str):
        """Edit image based on instruction"""
        try:
            uploaded_file = self._upload_file(image_path)
            if not uploaded_file:
                raise Exception("Failed to upload image")

            response = self.client.models.generate_content(
                model="gemini-2.0-flash-preview-image-generation",
                contents=[instruction, uploaded_file],
                config=types.GenerateContentConfig(
                    response_modalities=['TEXT', 'IMAGE']
                )
            )

            images = []
            description = ""

            for part in response.candidates[0].content.parts:
                if part.text is not None:
                    description = part.text
                elif part.inline_data is not None:
                    image = Image.open(io.BytesIO(part.inline_data.data))
                    images.append(image)

            return images, description
        except Exception as e:
            raise Exception(f"Image editing error: {str(e)}")

    async def generate_audio(self, prompt: str):
        """Generate audio from text prompt"""
        try:
            config = {
                "response_modalities": ["AUDIO"],
                "system_instruction": "You are a helpful assistant and answer in a friendly tone.",
            }

            audio_data = io.BytesIO()

            async with self.client.aio.live.connect(
                    model="gemini-2.5-flash-preview-native-audio-dialog",
                    config=config
            ) as session:
                await session.send_realtime_input(text=prompt)

                wf = wave.open(audio_data, "wb")
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)

                async for response in session.receive():
                    if response.data is not None:
                        wf.writeframes(response.data)

                wf.close()
                audio_data.seek(0)

            return audio_data
        except Exception as e:
            raise Exception(f"Audio generation error: {str(e)}")

    async def process_audio_input(self, audio_path: str):
        """Process audio input and return audio response"""
        try:
            # Convert audio to required format
            y, sr = librosa.load(audio_path, sr=16000)

            buffer = io.BytesIO()
            sf.write(buffer, y, sr, format='RAW', subtype='PCM_16')
            buffer.seek(0)
            audio_bytes = buffer.read()

            config = {
                "response_modalities": ["AUDIO"],
                "system_instruction": "Listen to the audio input and respond appropriately in a friendly tone.",
            }

            output_buffer = io.BytesIO()

            async with self.client.aio.live.connect(
                    model="gemini-2.5-flash-preview-native-audio-dialog",
                    config=config
            ) as session:
                await session.send_realtime_input(
                    audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
                )

                wf = wave.open(output_buffer, "wb")
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)

                async for response in session.receive():
                    if response.data is not None:
                        wf.writeframes(response.data)

                wf.close()
                output_buffer.seek(0)

            return output_buffer
        except Exception as e:
            raise Exception(f"Audio processing error: {str(e)}")

    def _upload_file(self, file_path: str):
        """Upload file to Gemini API with better file handling"""
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return None

        try:
            # Check if file needs preprocessing
            temp_file_path = None
            upload_path = file_path

            # Get file info similar to file_manager.py
            file_info = self._get_file_info(file_path)

            # Check if file has proper extension for Gemini
            if not self._has_gemini_compatible_extension(file_path):
                # Create a temporary file with proper extension
                proper_extension = self._determine_proper_extension(file_path, file_info['mime_type'])
                if proper_extension:
                    import tempfile
                    temp_dir = tempfile.gettempdir()
                    base_name = os.path.splitext(os.path.basename(file_path))[0]
                    temp_file_path = os.path.join(temp_dir, f"gemini_upload_{base_name}{proper_extension}")

                    # Copy file to temp location with proper extension
                    import shutil
                    shutil.copy2(file_path, temp_file_path)
                    upload_path = temp_file_path

            print(f"Uploading file: {upload_path} (original: {file_path})")

            # Upload file to Gemini
            uploaded_file = self.client.files.upload(file=upload_path)

            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except:
                    pass

            # Wait for processing
            max_wait = 60
            wait_time = 0
            check_interval = 2

            while wait_time < max_wait:
                try:
                    current_file = self.client.files.get(uploaded_file.name)
                    if current_file.state.name == "ACTIVE":
                        print(f"File upload successful: {file_path}")
                        return current_file
                    elif current_file.state.name == "FAILED":
                        print(f"File upload failed: {file_path}")
                        return None
                    else:
                        import time
                        time.sleep(check_interval)
                        wait_time += check_interval
                except Exception as e:
                    print(f"Error checking file status: {e}")
                    import time
                    time.sleep(check_interval)
                    wait_time += check_interval

            print(f"File upload timeout: {file_path}")
            return uploaded_file

        except Exception as e:
            print(f"Error uploading file {file_path}: {e}")
            # Clean up temporary file on error
            if 'temp_file_path' in locals() and temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except:
                    pass
            return None

    def _get_file_info(self, file_path: str):
        """Get file information similar to file_manager.py"""
        if not os.path.exists(file_path):
            return {}

        stat = os.stat(file_path)
        mime_type, _ = mimetypes.guess_type(file_path)

        # Enhanced MIME type detection
        if not mime_type:
            file_ext = os.path.splitext(file_path.lower())[1]
            ext_to_mime = {
                '.pdf': 'application/pdf',
                '.txt': 'text/plain',
                '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.xls': 'application/vnd.ms-excel',
                '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                '.ppt': 'application/vnd.ms-powerpoint',
                '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.bmp': 'image/bmp',
                '.svg': 'image/svg+xml',
                '.heic': 'image/heic',
                '.heif': 'image/heif',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.csv': 'text/csv',
                '.json': 'application/json',
                '.xml': 'application/xml',
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'text/javascript',
                '.py': 'text/x-python',
                '.md': 'text/markdown',
                '.rtf': 'application/rtf'
            }
            mime_type = ext_to_mime.get(file_ext, 'application/octet-stream')

        return {
            "path": file_path,
            "name": os.path.basename(file_path),
            "size": stat.st_size,
            "mime_type": mime_type,
            "modified": datetime.fromtimestamp(stat.st_mtime),
        }

    def _has_gemini_compatible_extension(self, file_path: str) -> bool:
        """Check if file has extension that Gemini recognizes"""
        file_ext = os.path.splitext(file_path.lower())[1]
        gemini_extensions = [
            '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.csv', '.json', '.xml', '.html', '.css', '.js', '.py', '.md', '.rtf',
            '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'
        ]
        return file_ext in gemini_extensions

    def _determine_proper_extension(self, file_path: str, mime_type: str) -> str:
        """Determine proper file extension based on MIME type and content"""
        # First try MIME type mapping
        mime_to_ext = {
            'application/pdf': '.pdf',
            'text/plain': '.txt',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'application/vnd.ms-excel': '.xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
            'application/vnd.ms-powerpoint': '.ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/heic': '.heic',
            'image/heif': '.heif',
            'audio/mpeg': '.mp3',
            'audio/wav': '.wav',
            'audio/ogg': '.ogg',
            'text/csv': '.csv',
            'application/json': '.json',
            'application/xml': '.xml',
            'text/html': '.html',
            'text/css': '.css',
            'text/javascript': '.js',
            'text/x-python': '.py',
            'text/markdown': '.md',
            'application/rtf': '.rtf'
        }

        if mime_type in mime_to_ext:
            return mime_to_ext[mime_type]

        # Try magic number detection
        try:
            with open(file_path, 'rb') as f:
                header = f.read(16)

            if header.startswith(b'%PDF'):
                return '.pdf'
            elif header.startswith(b'\xff\xd8\xff'):
                return '.jpg'
            elif header.startswith(b'\x89PNG\r\n\x1a\n'):
                return '.png'
            elif header.startswith(b'GIF8'):
                return '.gif'
            elif header.startswith(b'RIFF') and len(header) > 8 and header[8:12] == b'WEBP':
                return '.webp'
            elif header.startswith(b'PK\x03\x04'):
                return '.docx'  # Could be various Office formats, default to docx
            else:
                # Try to read as text
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read(100).strip()
                        if content.startswith('{') or content.startswith('['):
                            return '.json'
                        elif '<html' in content.lower() or '<!doctype' in content.lower():
                            return '.html'
                        else:
                            return '.txt'
                except:
                    return '.txt'
        except Exception as e:
            print(f"Could not determine extension for {file_path}: {e}")
            return '.txt'  # Safe fallback

    def is_supported_file(self, file_path: str):
        """Check if file type is supported with better detection"""
        file_info = self._get_file_info(file_path)
        mime_type = file_info.get('mime_type')

        supported_types = [
            'application/pdf',
            'text/plain',
            'text/csv',
            'text/html',
            'text/css',
            'text/javascript',
            'application/x-javascript',
            'text/x-typescript',
            'application/json',
            'text/xml',
            'application/rtf',
            'text/rtf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/msword',
            'application/vnd.ms-excel',
            'application/vnd.ms-powerpoint',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/heic',
            'image/heif',
            'text/markdown'
        ]

        return mime_type in supported_types if mime_type else False


class GeminiClientAsync:
    """Wrapper for async operations in sync context"""

    def __init__(self, gemini_client: GeminiClient):
        self.client = gemini_client

    def generate_audio_sync(self, prompt: str, callback=None):
        """Generate audio synchronously with callback"""

        def run_async():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                result = loop.run_until_complete(self.client.generate_audio(prompt))
                if callback:
                    callback(result, None)
            except Exception as e:
                if callback:
                    callback(None, e)

        thread = threading.Thread(target=run_async)
        thread.daemon = True
        thread.start()

    def process_audio_sync(self, audio_path: str, callback=None):
        """Process audio synchronously with callback"""

        def run_async():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                result = loop.run_until_complete(self.client.process_audio_input(audio_path))
                if callback:
                    callback(result, None)
            except Exception as e:
                if callback:
                    callback(None, e)

        thread = threading.Thread(target=run_async)
        thread.daemon = True
        thread.start()