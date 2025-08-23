from flask import Blueprint, request, jsonify, current_app
from src.database import db
from src.models.chat import ChatSession, ChatMessage, PromptTemplate, FileUpload
from src.routes.auth import get_current_user
from src.gemini_client import GeminiClient
from src.openrouter_client import OpenRouterClient
import uuid
import os
import json
from datetime import datetime
from werkzeug.utils import secure_filename
import mimetypes

def determine_client_from_model(model: str):
    """Determine client type based on model name"""
    gemini_models = [
        'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite-preview-06-17',
        'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro', 'gemini-pro-vision'
    ]

    if any(model.startswith(gm.split('-')[0] + '-') or model == gm for gm in gemini_models):
        return 'gemini'
    else:
        return 'openrouter'

chat_bp = Blueprint('chat', __name__)

# Global clients - will be initialized when API keys are provided
gemini_client = None
openrouter_client = None


@chat_bp.route('/config', methods=['POST'])
def set_config():
    """Set API keys and initialize clients"""
    global gemini_client, openrouter_client

    # Check authentication
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.get_json()
    gemini_key = data.get('gemini_api_key')
    openrouter_key = data.get('openrouter_api_key')

    try:
        if gemini_key:
            # Only (re)initialize if missing or API key has changed to preserve in-memory chat sessions
            if (gemini_client is None) or (getattr(gemini_client, 'api_key', None) != gemini_key):
                gemini_client = GeminiClient(gemini_key)
        if openrouter_key:
            if (openrouter_client is None) or (getattr(openrouter_client, 'api_key', None) != openrouter_key):
                openrouter_client = OpenRouterClient(openrouter_key)

        return jsonify({
            'success': True,
            'message': 'API keys configured successfully',
            'gemini_available': gemini_client is not None,
            'openrouter_available': openrouter_client is not None
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@chat_bp.route('/models', methods=['GET'])
def get_models():
    """Get available models from both clients"""
    # Check authentication
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    models = {
        'gemini': [],
        'openrouter': []
    }

    if gemini_client:
        models['gemini'] = gemini_client.get_available_models()

    if openrouter_client:
        models['openrouter'] = openrouter_client.get_available_models()

    return jsonify(models)


@chat_bp.route('/sessions', methods=['GET'])
def get_sessions():
    """Get all chat sessions for current user"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Only return open (not closed) sessions for tabs
    sessions = ChatSession.query.filter_by(
        user_id=current_user.id,
        is_closed=False
    ).order_by(ChatSession.updated_at.desc()).all()

    return jsonify([session.to_dict() for session in sessions])


@chat_bp.route('/sessions/history', methods=['GET'])
def get_session_history():
    """Get all chat sessions (including closed) for history view"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    sessions = ChatSession.query.filter_by(
        user_id=current_user.id
    ).order_by(ChatSession.updated_at.desc()).all()

    return jsonify([session.to_dict() for session in sessions])


@chat_bp.route('/sessions', methods=['POST'])
def create_session():
    """Create a new chat session"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.get_json()
    model = data.get('model', 'gemini-2.5-flash')

    # Auto-determine client type based on model
    client_type = determine_client_from_model(model)

    session_id = str(uuid.uuid4())
    session = ChatSession(
        id=session_id,
        user_id=current_user.id,
        title=data.get('title', 'New Chat'),
        model=model,
        client_type=client_type,  # Auto-determined
        temperature=data.get('temperature', 1.0),
        is_closed=False
    )

    db.session.add(session)
    db.session.commit()

    return jsonify(session.to_dict()), 201


@chat_bp.route('/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    """Get a specific session with messages"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    session = ChatSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()

    if not session:
        return jsonify({'error': 'Session not found or access denied'}), 404

    messages = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp).all()

    return jsonify({
        'session': session.to_dict(),
        'messages': [message.to_dict() for message in messages]
    })


@chat_bp.route('/sessions/<session_id>', methods=['PUT'])
def update_session(session_id):
    """Update session details"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    session = ChatSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()

    if not session:
        return jsonify({'error': 'Session not found or access denied'}), 404

    data = request.get_json()

    if 'title' in data:
        session.title = data['title']
    if 'model' in data:
        session.model = data['model']
        # Auto-update client type when model changes
        session.client_type = determine_client_from_model(data['model'])
    if 'temperature' in data:
        session.temperature = data['temperature']

    session.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(session.to_dict())


@chat_bp.route('/sessions/<session_id>/close', methods=['POST'])
def close_session_tab(session_id):
    """Close session tab (mark as closed, don't delete)"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    session = ChatSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()

    if not session:
        return jsonify({'error': 'Session not found or access denied'}), 404

    # Mark session as closed (hide from tabs, keep in history)
    session.is_closed = True
    session.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'success': True, 'message': 'Session tab closed'})


@chat_bp.route('/sessions/<session_id>/reopen', methods=['POST'])
def reopen_session(session_id):
    """Reopen a closed session"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    session = ChatSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()

    if not session:
        return jsonify({'error': 'Session not found or access denied'}), 404

    # Reopen session
    session.is_closed = False
    session.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(session.to_dict())


@chat_bp.route('/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a chat session permanently"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    session = ChatSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()

    if not session:
        return jsonify({'error': 'Session not found or access denied'}), 404

    db.session.delete(session)
    db.session.commit()

    return jsonify({'success': True})


@chat_bp.route('/sessions/<session_id>/messages', methods=['POST'])
def send_message(session_id):
    """Send a message in a chat session"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    session = ChatSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()

    if not session:
        return jsonify({'error': 'Session not found or access denied'}), 404

    data = request.get_json()

    message_content = data.get('message', '')
    file_ids = data.get('files', [])

    # Validate message content
    if not message_content or not message_content.strip():
        return jsonify({'error': 'Message content cannot be empty'}), 400

    # Convert file IDs to actual file paths (only user's files)
    file_paths = []
    if file_ids:
        for file_id in file_ids:
            # If file_id is actually a path (backward compatibility)
            if isinstance(file_id, str) and ('/' in file_id or '\\' in file_id):
                file_paths.append(file_id)
            else:
                # Look up file by ID (only user's files)
                file_upload = FileUpload.query.filter_by(
                    id=file_id,
                    user_id=current_user.id
                ).first()
                if file_upload:
                    file_paths.append(file_upload.file_path)

    # Save user message first
    user_message = ChatMessage(
        session_id=session_id,
        role='user',
        content=message_content.strip(),
        files=json.dumps(file_ids) if file_ids else None
    )

    # Use no_autoflush to prevent premature flushing
    with db.session.no_autoflush:
        db.session.add(user_message)

        try:
            # Get appropriate client and generate response
            response_content = None

            if session.client_type == 'gemini':
                if not gemini_client:
                    raise Exception("Gemini client not configured. Please check your API key in settings.")
                # Rehydrate Gemini chat session with DB history on first use if needed
                history_messages = None
                try:
                    # Only build history when GeminiClient does not have this session
                    if session_id not in getattr(gemini_client, 'chat_sessions', {}):
                        # Load prior messages from DB and convert to Gemini format
                        prior_messages = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp).all()
                        history_messages = []
                        for m in prior_messages:
                            role = 'user' if m.role == 'user' else 'model'
                            text = m.content or ''
                            # Minimal history element for Gemini SDK
                            history_messages.append({
                                'role': role,
                                'parts': [text]
                            })
                except Exception as hist_err:
                    print(f"History build error for session {session_id}: {hist_err}")
                response_content = gemini_client.chat_message(
                    session_id=session_id,
                    message=message_content,
                    model=session.model,
                    files=file_paths,
                    temperature=session.temperature,
                    history_messages=history_messages
                )
            elif session.client_type == 'openrouter':
                if not openrouter_client:
                    raise Exception("OpenRouter client not configured. Please check your API key in settings.")
                # Rehydrate OpenRouter conversation history if missing
                try:
                    if session_id not in getattr(openrouter_client, 'chat_sessions', {}):
                        prior_messages = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp).all()
                        history_messages = []
                        for m in prior_messages:
                            role = 'user' if m.role == 'user' else 'assistant'
                            text = m.content or ''
                            history_messages.append({
                                'role': role,
                                'content': [{ 'type': 'text', 'text': text }]
                            })
                        openrouter_client.chat_sessions[session_id] = history_messages
                except Exception as or_hist_err:
                    print(f"OpenRouter history build error for session {session_id}: {or_hist_err}")
                response_content = openrouter_client.chat_message(
                    session_id=session_id,
                    message=message_content,
                    model=session.model,
                    files=file_paths,
                    temperature=session.temperature
                )
            else:
                raise Exception(f"Unknown client type: {session.client_type}")

            # Validate response content
            if not response_content or not response_content.strip():
                response_content = "I apologize, but I couldn't generate a response. Please try again."

            # Save assistant response
            assistant_message = ChatMessage(
                session_id=session_id,
                role='assistant',
                content=response_content.strip()
            )
            db.session.add(assistant_message)

            # Update session timestamp and title
            session.updated_at = datetime.utcnow()

            # Auto-generate title if this is the first message
            if session.title == 'New Chat':
                # Count existing messages (excluding the ones we're adding)
                existing_message_count = ChatMessage.query.filter_by(session_id=session_id).count()
                if existing_message_count == 0:  # This is the first exchange
                    title_words = message_content.split()[:5]
                    session.title = ' '.join(title_words) + ('...' if len(title_words) == 5 else '')

            # Commit all changes
            db.session.commit()

            return jsonify({
                'user_message': user_message.to_dict(),
                'assistant_message': assistant_message.to_dict(),
                'session': session.to_dict()
            })

        except Exception as e:
            db.session.rollback()
            print(f"Error in send_message: {str(e)}")
            return jsonify({'error': str(e)}), 500


@chat_bp.route('/sessions/<session_id>/messages/<message_id>', methods=['DELETE'])
def delete_message(session_id, message_id):
    """Delete a specific message from a chat session"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    session = ChatSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()

    if not session:
        return jsonify({'error': 'Session not found or access denied'}), 404

    message = ChatMessage.query.filter_by(
        id=message_id,
        session_id=session_id
    ).first()

    if not message:
        return jsonify({'error': 'Message not found'}), 404

    # Delete the message
    db.session.delete(message)
    session.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'success': True})


@chat_bp.route('/sessions/<session_id>/clear', methods=['POST'])
def clear_session(session_id):
    """Clear all messages in a session"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    session = ChatSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()

    if not session:
        return jsonify({'error': 'Session not found or access denied'}), 404

    # Delete all messages
    ChatMessage.query.filter_by(session_id=session_id).delete()

    # Clear client session if exists
    if session.client_type == 'gemini' and gemini_client:
        gemini_client.clear_chat_session(session_id)
    elif session.client_type == 'openrouter' and openrouter_client:
        openrouter_client.clear_chat_session(session_id)

    session.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'success': True})


@chat_bp.route('/prompts', methods=['GET'])
def get_prompts():
    """Get all prompt templates for current user"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    prompts = PromptTemplate.query.filter_by(
        user_id=current_user.id
    ).order_by(PromptTemplate.updated_at.desc()).all()

    return jsonify([prompt.to_dict() for prompt in prompts])


@chat_bp.route('/prompts', methods=['POST'])
def create_prompt():
    """Create a new prompt template"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.get_json()

    prompt = PromptTemplate(
        user_id=current_user.id,
        title=data.get('title', 'Untitled Prompt'),
        content=data.get('content', ''),
        category=data.get('category', 'General'),
        tags=json.dumps(data.get('tags', []))
    )

    db.session.add(prompt)
    db.session.commit()

    return jsonify(prompt.to_dict()), 201


@chat_bp.route('/prompts/<int:prompt_id>', methods=['PUT'])
def update_prompt(prompt_id):
    """Update a prompt template"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    prompt = PromptTemplate.query.filter_by(
        id=prompt_id,
        user_id=current_user.id
    ).first()

    if not prompt:
        return jsonify({'error': 'Prompt not found or access denied'}), 404

    data = request.get_json()

    if 'title' in data:
        prompt.title = data['title']
    if 'content' in data:
        prompt.content = data['content']
    if 'category' in data:
        prompt.category = data['category']
    if 'tags' in data:
        prompt.tags = json.dumps(data['tags'])

    prompt.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(prompt.to_dict())


@chat_bp.route('/prompts/<int:prompt_id>', methods=['DELETE'])
def delete_prompt(prompt_id):
    """Delete a prompt template"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    prompt = PromptTemplate.query.filter_by(
        id=prompt_id,
        user_id=current_user.id
    ).first()

    if not prompt:
        return jsonify({'error': 'Prompt not found or access denied'}), 404

    db.session.delete(prompt)
    db.session.commit()

    return jsonify({'success': True})


@chat_bp.route('/prompts/<int:prompt_id>/use', methods=['POST'])
def use_prompt(prompt_id):
    """Increment usage count for a prompt"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    prompt = PromptTemplate.query.filter_by(
        id=prompt_id,
        user_id=current_user.id
    ).first()

    if not prompt:
        return jsonify({'error': 'Prompt not found or access denied'}), 404

    prompt.usage_count += 1
    db.session.commit()

    return jsonify(prompt.to_dict())


@chat_bp.route('/files/upload', methods=['POST'])
def upload_file():
    """Upload a file with better Cyrillic filename support"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Create uploads directory if it doesn't exist
    upload_dir = os.path.join(current_app.root_path, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)

    # Handle Cyrillic and special characters in filename
    original_filename = file.filename
    try:
        # Ensure filename is properly encoded
        if isinstance(original_filename, bytes):
            original_filename = original_filename.decode('utf-8')

        # Create a safe ASCII filename while preserving the original
        safe_filename = secure_filename(original_filename)
        if not safe_filename:  # If secure_filename returns empty (all non-ASCII)
            # Fallback: use file extension with timestamp
            file_ext = os.path.splitext(original_filename)[1] if '.' in original_filename else ''
            safe_filename = f"uploaded_file_{int(datetime.now().timestamp())}{file_ext}"

        # Generate unique filename
        unique_filename = f"{uuid.uuid4()}_{safe_filename}"
        file_path = os.path.join(upload_dir, unique_filename)

        # Save the file first
        file.save(file_path)

        # Get file info after saving
        file_size = os.path.getsize(file_path)

        # Improved MIME type detection
        mime_type = None

        # Try multiple methods to determine MIME type
        # 1. Try mimetypes based on file extension
        mime_type, _ = mimetypes.guess_type(safe_filename)

        if not mime_type:
            # 2. Try with original filename (might work better for some extensions)
            mime_type, _ = mimetypes.guess_type(original_filename.lower())

        if not mime_type:
            # 3. Determine by file extension manually for common types
            file_ext = os.path.splitext(original_filename.lower())[1]
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
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.mp4': 'video/mp4',
                '.avi': 'video/x-msvideo',
                '.mov': 'video/quicktime',
                '.csv': 'text/csv',
                '.json': 'application/json',
                '.xml': 'application/xml',
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'text/javascript',
                '.py': 'text/x-python',
                '.java': 'text/x-java-source',
                '.cpp': 'text/x-c++src',
                '.c': 'text/x-csrc',
                '.h': 'text/x-chdr',
                '.md': 'text/markdown',
                '.rtf': 'application/rtf',
                '.zip': 'application/zip',
                '.tar': 'application/x-tar',
                '.gz': 'application/gzip'
            }
            mime_type = ext_to_mime.get(file_ext, 'application/octet-stream')

        # Validate file size (20MB limit)
        max_size = 20 * 1024 * 1024  # 20MB
        if file_size > max_size:
            # Remove the uploaded file if it's too large
            os.remove(file_path)
            return jsonify({'error': f'File size ({file_size / (1024 * 1024):.1f}MB) exceeds 20MB limit'}), 400

        # Save to database with original filename preserved
        file_upload = FileUpload(
            user_id=current_user.id,
            filename=unique_filename,
            original_filename=original_filename,  # Preserve original Cyrillic name
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type
        )

        db.session.add(file_upload)
        db.session.commit()

        return jsonify(file_upload.to_dict()), 201

    except UnicodeDecodeError as e:
        return jsonify({'error': f'Filename encoding error: {str(e)}'}), 400
    except Exception as e:
        # Clean up file if database save fails
        if 'file_path' in locals() and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500


@chat_bp.route('/files', methods=['GET'])
def get_files():
    """Get all uploaded files for current user"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    files = FileUpload.query.filter_by(
        user_id=current_user.id
    ).order_by(FileUpload.uploaded_at.desc()).all()

    return jsonify([file.to_dict() for file in files])


@chat_bp.route('/files/<int:file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete an uploaded file"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    file_upload = FileUpload.query.filter_by(
        id=file_id,
        user_id=current_user.id
    ).first()

    if not file_upload:
        return jsonify({'error': 'File not found or access denied'}), 404

    # Delete physical file
    if os.path.exists(file_upload.file_path):
        os.remove(file_upload.file_path)

    # Delete from database
    db.session.delete(file_upload)
    db.session.commit()

    return jsonify({'success': True})