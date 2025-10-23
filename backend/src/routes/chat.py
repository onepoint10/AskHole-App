from flask import Blueprint, request, jsonify, current_app, send_from_directory
from src.database import db
from src.models.chat import ChatSession, ChatMessage, PromptTemplate, FileUpload, PromptLike
from src.models.user import User
from src.routes.auth import get_current_user
from src.gemini_client import GeminiClient
from src.openrouter_client import OpenRouterClient
from src.custom_client import CustomClient
from src.exa_client import ExaClient # Import ExaClient
from src.file_converter import FileConverter
from src.git_manager import PromptGitManager  # Import Git manager
import uuid
import os
import json
from datetime import datetime
from werkzeug.utils import secure_filename
import mimetypes
import logging

logger = logging.getLogger(__name__)

def _get_localized_default_title(language: str) -> str:
    """Returns the localized default title for a new chat session."""
    # Using a simple dictionary for localization based on language prefix
    localization_map = {
        'ru': 'Новый чат',
        'en': 'New Chat',
        # Add more languages as needed
    }
    # Extract the primary language tag (e.g., 'ru' from 'ru-RU')
    primary_language = language.split('-')[0].lower()
    return localization_map.get(primary_language, 'New Chat')

def _generate_session_title_from_message(message_content: str, language: str) -> str:
    """Generates a session title from the message content, considering language."""
    # For Russian, a simple split might still work for common phrases,
    # but for more robust handling, a proper NLP tokenizer would be needed.
    # For now, we'll keep the simple split but ensure it's applied to the message.
    title_words = message_content.split()[:5]
    return ' '.join(title_words) + ('...' if len(title_words) == 5 else '')

def _guess_mime_type(safe_filename: str, original_filename: str) -> str:
    """Guess MIME type using multiple strategies, with a manual fallback map."""
    # 1) Standard guess based on safe filename
    mime_type, _ = mimetypes.guess_type(safe_filename)
    if mime_type:
        return mime_type
    # 2) Try the original filename
    mime_type, _ = mimetypes.guess_type(original_filename.lower())
    if mime_type:
        return mime_type
    # 3) Manual fallback by extension
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
    return ext_to_mime.get(file_ext, 'application/octet-stream')


def determine_client_from_model(model: str):
    """Determine client type based on model name"""
    gemini_models = [
        'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite-preview-09-25',
        'gemini-2.5-flash-preview-09-2025', 'gemini-2.5-flash-lite', 'gemini-embedding-001', 'gemini-2.0-flash'
    ]

    if any(model.startswith(gm.split('-')[0] + '-') or model == gm for gm in gemini_models):
        return 'gemini'

    # Check if it's a custom model by looking through custom clients
    for client in custom_clients.values():
        try:
            if model in client.get_available_models():
                return 'custom'
        except:
            continue

    return 'openrouter'

chat_bp = Blueprint('chat', __name__)

# Global clients - will be initialized when API keys are provided
gemini_client = None
openrouter_client = None
exa_client = None # Add ExaClient
custom_clients = {}  # Dictionary to store custom clients by provider name
prompt_git_manager = None  # Git manager for prompt versioning


def get_git_author_info(user):
    """Get Git author information from user object"""
    author_name = user.username
    author_email = user.email if hasattr(user, 'email') and user.email else f"{user.username}@askhole.local"
    return author_name, author_email


def initialize_git_manager():
    """Initialize Git manager for prompt versioning"""
    global prompt_git_manager
    try:
        if prompt_git_manager is None:
            repo_path = os.getenv('PROMPTS_REPO_PATH',
                                os.path.join(current_app.root_path, 'prompts_repo'))
            prompt_git_manager = PromptGitManager(repo_path=repo_path)
            logger.info(f"Initialized Git manager at {repo_path}")
    except Exception as e:
        logger.error(f"Failed to initialize Git manager: {e}")
        # Don't raise - Git is optional feature, allow app to continue


@chat_bp.route('/config', methods=['POST'])
def set_config():
    """Set API keys and initialize clients"""
    global gemini_client, openrouter_client, custom_clients, exa_client # Add exa_client

    # Check authentication
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.get_json()
    gemini_key = data.get('gemini_api_key')
    openrouter_key = data.get('openrouter_api_key')
    exa_key = data.get('exa_api_key') # Get Exa API key
    custom_providers = data.get('custom_providers', [])

    try:
        if gemini_key:
            # Only (re)initialize if missing or API key has changed to preserve in-memory chat sessions
            if (gemini_client is None) or (getattr(gemini_client, 'api_key', None) != gemini_key):
                gemini_client = GeminiClient(gemini_key)
        if openrouter_key:
            if (openrouter_client is None) or (getattr(openrouter_client, 'api_key', None) != openrouter_key):
                openrouter_client = OpenRouterClient(openrouter_key)
        if exa_key: # Initialize ExaClient
            if (exa_client is None) or (getattr(exa_client, 'api_key', None) != exa_key):
                exa_client = ExaClient(exa_key)

        # Handle custom providers
        custom_clients.clear()  # Clear existing custom clients
        for provider in custom_providers:
            try:
                custom_client = CustomClient(
                    provider_name=provider['name'],
                    base_url=provider['base_url'],
                    api_key=provider['api_key']
                )
                custom_clients[provider['name']] = custom_client
            except Exception as e:
                logger.error(f"Failed to initialize custom client for {provider['name']}: {e}")

        return jsonify({
            'success': True,
            'message': 'API keys configured successfully',
            'gemini_available': gemini_client is not None,
            'openrouter_available': openrouter_client is not None,
            'exa_available': exa_client is not None, # Add Exa availability
            'custom_providers_available': list(custom_clients.keys())
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
        'openrouter': [],
        'custom': []
    }

    if gemini_client:
        models['gemini'] = gemini_client.get_available_models()

    if openrouter_client:
        models['openrouter'] = openrouter_client.get_available_models()

    # Add models from custom providers
    for client in custom_clients.values():
        try:
            custom_models = client.get_available_models()
            models['custom'].extend(custom_models)
        except Exception as e:
            logger.error(f"Failed to get models from custom client: {e}")

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

    # Get language from request header
    accept_language = request.headers.get('Accept-Language', 'en')
    default_title = _get_localized_default_title(accept_language)

    # Auto-determine client type based on model
    client_type = determine_client_from_model(model)

    session_id = str(uuid.uuid4())
    session = ChatSession(
        id=session_id,
        user_id=current_user.id,
        title=data.get('title', default_title), # Use localized default title
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
    """Send a message in a chat session.

    - Validates session and user
    - Auto-creates session if it doesn't exist (handles first login case)
    - Resolves attached files, preferring converted PDFs
    - For Gemini/OpenRouter, rehydrates session history if needed
    - Persists user and assistant messages
    """
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Get the request data first to access model info if needed
    data = request.get_json()

    session = ChatSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()

    # Auto-create session if it doesn't exist (e.g., first login, session ID mismatch)
    if not session:
        logger.info(f"Session {session_id} not found, auto-creating new session for user {current_user.id}")

        # Get language from request header
        accept_language = request.headers.get('Accept-Language', 'en')
        default_title = _get_localized_default_title(accept_language)

        # Get model from request data or use default
        model = data.get('model', 'gemini-2.5-flash')
        temperature = data.get('temperature', 1.0)

        # Auto-determine client type based on model
        client_type = determine_client_from_model(model)

        # Create the session with the provided session_id
        session = ChatSession(
            id=session_id,
            user_id=current_user.id,
            title=default_title,
            model=model,
            client_type=client_type,
            temperature=temperature,
            is_closed=False
        )

        db.session.add(session)
        db.session.commit()
        logger.info(f"Auto-created session {session_id} with model {model} for user {current_user.id}")

    message_content = data.get('message', '')
    file_ids = data.get('files', [])
    search_mode = data.get('search_mode', False) # Get search_mode flag

    # Validate message content
    if not message_content or not message_content.strip():
        return jsonify({'error': 'Message content cannot be empty'}), 400

    # Get language from request header
    accept_language = request.headers.get('Accept-Language', 'en')
    localized_default_title = _get_localized_default_title(accept_language)

    # Convert file IDs to actual file paths (batch lookup for performance)
    file_paths = []
    passthrough_paths = []
    id_candidates = []
    if file_ids:
        for fid in file_ids:
            if isinstance(fid, str) and ('/' in fid or '\\' in fid):
                passthrough_paths.append(fid)
            else:
                id_candidates.append(fid)

        if id_candidates:
            try:
                records = FileUpload.query.filter(
                    FileUpload.id.in_(id_candidates),
                    FileUpload.user_id == current_user.id
                ).all()
                by_id = {r.id: r for r in records}
                for fid in id_candidates:
                    rec = by_id.get(fid)
                    if rec:
                        exists = os.path.exists(rec.file_path)
                        logger.debug(f"Resolved file id={fid} path={rec.file_path} exists={exists}")
                        if exists:
                            file_paths.append(rec.file_path)
                        else:
                            # Try alternative known extensions
                            base = os.path.splitext(rec.file_path)[0]
                            for ext in ('.pdf', '.html', '.txt'):
                                alt = base + ext
                                if os.path.exists(alt):
                                    logger.debug(f"Found alternative file for id={fid}: {alt}")
                                    file_paths.append(alt)
                                    break
                    else:
                        logger.warning(f"FileUpload missing for id={fid} user={current_user.id}")
            except Exception as e:
                logger.exception(f"Batch file lookup failed: {e}")

        # Append passthrough at end to preserve relative order roughly
        file_paths.extend(passthrough_paths)

    # Save user message first
    user_message = ChatMessage(
        session_id=session_id,
        role='user',
        content=message_content.strip(),
        files=json.dumps(file_ids) if file_ids else None
    )

    # Check if this is the first message in the session for auto-naming
    is_first_message = False
    if session.title == localized_default_title:
        existing_message_count = ChatMessage.query.filter_by(session_id=session_id).count()
        if existing_message_count == 0:
            is_first_message = True
            logger.debug(f"Session {session_id} is a new chat, will attempt to auto-name.")

    # Use no_autoflush to prevent premature flushing
    with (db.session.no_autoflush):
        db.session.add(user_message)

        try:
            # Get appropriate client and generate response
            response_content = None

            if search_mode: # Handle search mode
                if not exa_client:
                    raise Exception("Exa client not configured. Please check your API key in settings.")

                # 1. Send user's request to Exa
                exa_response = exa_client.search_and_contents(query=message_content,type="auto", text=True)

                # Check if exa_response is an error dictionary
                if isinstance(exa_response, dict) and "error" in exa_response:
                    raise Exception(f"Exa search failed: {exa_response['error']}")

                # Extract content from Exa response (now we are sure it's an Exa SearchResponse object)
                # Iterate over exa_response.results to get individual Result objects
                exa_contents_list = [r.text for r in exa_response.results if r.text]
                exa_contents = "\n\n".join(exa_contents_list)

                if not exa_contents:
                    response_content = "I couldn't find any relevant information using Exa search."
                else:
                # 2. Send Exa response and user's original request to the currently selected model
                # for summarization and formatted presentation.
                    model_query = (f"1. System Instruction (SI)\n"
                                   f"                        You are an expert data structuring and formatting engine. Your primary goal is to transform highly unstructured, mixed-text data from an Exa search result into a clear, professional, and reader-friendly format. The output must adhere strictly to the following two-part structure: 1) A summary of the main extracted information, and 2) a list of all useful web links presented as search engine snippets.\n"
                                   f"    \n"
                                   f"                        2. Role Instruction (RI)\n"
                                   f"                        Assume the role of a meticulous editorial assistant who specializes in synthesizing complex search results. You must identify key topics, extract all relevant URLs, and generate a concise, descriptive summary for each link that is distinct from its title. The output must be free of extraneous commentary, markdown formatting errors, or incomplete sections.\n"
                                   f"    \n"
                                   f"                        3. Query Instruction (QI)\n"
                                   f"                        **User's original question**: '{message_content}'\n"
                                   f"    \n"
                                   f"                        **Search Results**:\n"
                                   f"                        {exa_contents}\n"
                                   f"    \n"
                                   f"                        **Task Steps & Output Format:** \n"
                                   f"                        1. **Main Content Synthesis:** Analyze the entire input text and generate a concise, single paragraph summary of the primary findings, key concepts, or main content of the search results. \n"
                                   f"                        2. **Link Extraction and Snippet Formatting:** \n"
                                   f"                            * Scan the text to find every useful URL. \n"
                                   f"                            * For each URL, identify its associated title or a relevant phrase to use as a title. \n"
                                   f"                            * Write a **Brief description of the linked content** (max 2-3 sentences) by synthesizing information found near the link or within the broader search result text. This description must clearly convey what the user will find on the page. \n"
                                   f"                            * Present the final list of links using the following template for each entry: \n"
                                   f"                            **Template for Links:** \n"
                                   f"                            **[Clickable link as a title](URL)**\n"
                                   f"                            Brief description of the linked content. \n"
                                   f"                            *Example:* **[Best Practices for Prompt Engineering with Gemini 2.5 Pro](https://medium.com/example-url)**\n"
                                   f"                            This article details essential techniques for optimizing prompts, such as defining a clear role for the model, setting specific goals, and providing guidance instead of direct orders to improve accuracy and reduce costs.\n"
                                   f"    \n"
                                   f"                        **Final Output Structure (Must be in this exact order and format):** \n"
                                   f"                        # Synthesis of Exa Search Results \n"
                                   f"                        [The concise, single paragraph summary goes here.] \n"
                                   f"                        # Useful Links & Snippets \n"
                                   f"                        [List all extracted links in the specified snippet format here.]")
                    # Determine which client to use for the model query
                    if session.client_type == 'gemini':
                        if not gemini_client:
                            raise Exception("Gemini client not configured. Please check your API key in settings.")
                        response_content = gemini_client.chat_message(
                            session_id=session_id,
                            message=model_query,
                            model=session.model,
                            temperature=session.temperature
                        )
                    elif session.client_type == 'openrouter':
                        if not openrouter_client:
                            raise Exception("OpenRouter client not configured. Please check your API key in settings.")
                        response_content = openrouter_client.chat_message(
                            session_id=session_id,
                            message=model_query,
                            model=session.model,
                            temperature=session.temperature
                        )
                    elif session.client_type == 'custom':
                        custom_client = None
                        for client in custom_clients.values():
                            try:
                                if session.model in client.get_available_models():
                                    custom_client = client
                                    break
                            except:
                                continue
                        if not custom_client:
                            raise Exception(f"Custom client not found for model: {session.model}. Please check your custom provider configuration.")
                        response = custom_client.send_message(
                            session_id=session_id,
                            message=model_query,
                            model=session.model,
                            temperature=session.temperature
                        )
                        response_content = response.get('response', '')
                    else:
                        raise Exception(f"Unknown client type for summarization: {session.client_type}")

                    if not response_content or not response_content.strip():
                        response_content = "I apologize, but I couldn't generate a summary from the search results. Please try again."

                # 3. Place the received response (along with Exa's original response) from the model in the MessageList
                # For now, we'll just combine them. Frontend can separate if needed.
                full_response_content = f"**Exa Search Results:**\n\n{exa_contents}\n\n**Summary from {session.model}:**\n\n{response_content}"
                response_content = full_response_content

            else: # Original chat mode logic
                if session.client_type == 'gemini':
                    if not gemini_client:
                        raise Exception("Gemini client not configured. Please check your API key in settings.")
                    # Rehydrate Gemini chat session with DB history on first use if needed
                    history_messages = None
                    try:
                        if session_id not in getattr(gemini_client, 'chat_sessions', {}):
                            from google.genai import types
                            prior_messages = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp).all()
                            history_messages = []
                            for m in prior_messages:
                                role = 'user' if m.role == 'user' else 'model'
                                text = m.content or ''
                                # Create proper Part objects for Gemini API
                                history_messages.append({
                                    'role': role,
                                    'parts': [types.Part.from_text(text=text)]
                                })
                    except Exception as hist_err:
                        logger.warning(f"History build error for session {session_id}: {hist_err}")
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
                    try:
                        if session_id not in getattr(openrouter_client, 'chat_sessions', {}):
                            prior_messages = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp).all()
                            history_messages = []
                            for m in prior_messages:
                                role = 'user' if m.role == 'user' else 'assistant'
                                text = m.content or ''
                                history_messages.append({'role': role, 'content': [{ 'type': 'text', 'text': text }]})
                            openrouter_client.chat_sessions[session_id] = history_messages
                    except Exception as or_hist_err:
                        logger.warning(f"OpenRouter history build error for session {session_id}: {or_hist_err}")
                    response_content = openrouter_client.chat_message(
                        session_id=session_id,
                        message=message_content,
                        model=session.model,
                        files=file_paths,
                        temperature=session.temperature
                    )
                elif session.client_type == 'custom':
                    # Find the appropriate custom client for this model
                    custom_client = None
                    for client in custom_clients.values():
                        try:
                            if session.model in client.get_available_models():
                                custom_client = client
                                break
                        except:
                            continue

                    if not custom_client:
                        raise Exception(f"Custom client not found for model: {session.model}. Please check your custom provider configuration.")

                    try:
                        if session_id not in getattr(custom_client, 'chat_sessions', {}):
                            prior_messages = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp).all()
                            history_messages = []
                            for m in prior_messages:
                                role = 'user' if m.role == 'user' else 'assistant'
                                text = m.content or ''
                                history_messages.append({'role': role, 'content': text})
                            custom_client.chat_sessions[session_id] = history_messages
                    except Exception as custom_hist_err:
                        logger.warning(f"Custom client history build error for session {session_id}: {custom_hist_err}")

                    response = custom_client.send_message(
                        session_id=session_id,
                        message=message_content,
                        model=session.model,
                        files=file_paths,
                        temperature=session.temperature
                    )
                    response_content = response.get('response', '')
                else:
                    raise Exception(f"Unknown client type: {session.client_type}")

            if not response_content or not response_content.strip():
                response_content = "I apologize, but I couldn't generate a response. Please try again."

            assistant_message = ChatMessage(
                session_id=session_id,
                role='assistant',
                content=response_content.strip()
            )
            db.session.add(assistant_message)

            session.updated_at = datetime.utcnow()

            # Auto-name the session if it's the first message and title is still default
            if is_first_message:
                new_title = _generate_session_title_from_message(message_content, accept_language)
                session.title = new_title
                logger.info(f"Auto-named session {session_id} to: '{new_title}' (Language: {accept_language})")

            db.session.commit()

            return jsonify({
                'user_message': user_message.to_dict(),
                'assistant_message': assistant_message.to_dict(),
                'session': session.to_dict()
            })

        except Exception as e:
            db.session.rollback()
            logger.exception(f"Error in send_message: {str(e)}")
            return jsonify({'error': str(e)}), 500


@chat_bp.route('/sessions/<session_id>/generate-image', methods=['POST'])
def generate_image_route(session_id):
    """Generate an image based on a text prompt and add to chat session."""
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
    prompt = data.get('prompt', '')

    if not prompt or not prompt.strip():
        return jsonify({'error': 'Image generation prompt cannot be empty'}), 400

    if not gemini_client:
        return jsonify({'error': 'Gemini client not configured for image generation.'}), 500

    # Save user's image generation prompt
    user_message = ChatMessage(
        session_id=session_id,
        role='user',
        content=f"Generate image: \"" + prompt.strip() + "\"",
        is_image_generation=True
    )
    db.session.add(user_message)
    db.session.flush() # Flush to get user_message.id for potential rollback

    try:
        # Generate image using Gemini client
        images, description = gemini_client.generate_image(prompt=prompt.strip())

        # Save generated images as FileUploads and link to assistant message
        image_file_ids = []
        for i, img in enumerate(images):
            # Save image to disk
            upload_dir = os.path.join(current_app.root_path, 'uploads')
            os.makedirs(upload_dir, exist_ok=True)

            # Sanitize prompt for filename
            sanitized_prompt = secure_filename(prompt.strip()[:50]) # Take first 50 chars and sanitize
            if not sanitized_prompt:
                sanitized_prompt = "generated_image"

            # Generate a unique filename for the image using sanitized prompt and timestamp
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_filename = f"{sanitized_prompt}_{timestamp_str}_{uuid.uuid4().hex[:6]}.png"
            file_path = os.path.join(upload_dir, unique_filename)
            img.save(file_path)

            # Create FileUpload record
            file_upload = FileUpload(
                user_id=current_user.id,
                filename=unique_filename,
                original_filename=f"{sanitized_prompt}_{i+1}.png", # More meaningful original filename
                file_path=file_path,
                file_size=os.path.getsize(file_path),
                mime_type='image/png'
            )
            db.session.add(file_upload)
            db.session.flush() # Flush to get file_upload.id
            image_file_ids.append(file_upload.id)

        # Create assistant message with description and linked images
        assistant_message_content = description if description else "Here are the images I generated based on your prompt."
        assistant_message = ChatMessage(
            session_id=session_id,
            role='assistant',
            content=assistant_message_content.strip(),
            files=json.dumps(image_file_ids) if image_file_ids else None
        )
        db.session.add(assistant_message)

        session.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'user_message': user_message.to_dict(),
            'assistant_message': assistant_message.to_dict(),
            'session': session.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error in generate_image_route: {str(e)}")
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
    """Create a new prompt template with Git versioning"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.get_json()

    # Validate required fields
    if not data.get('title', '').strip():
        return jsonify({'error': 'Title is required'}), 400
    if not data.get('content', '').strip():
        return jsonify({'error': 'Content is required'}), 400

    try:
        # Initialize Git manager if needed
        initialize_git_manager()

        # Create prompt object
        prompt = PromptTemplate(
            user_id=current_user.id,
            title=data['title'].strip(),
            content=data['content'].strip(),
            category=data.get('category', 'General').strip(),
            tags=json.dumps(data.get('tags', [])),
            is_public=bool(data.get('is_public', False))
        )

        # Add to session and flush to get ID
        db.session.add(prompt)
        db.session.flush()

        # Save to Git if available
        if prompt_git_manager:
            try:
                author_name, author_email = get_git_author_info(current_user)
                commit_message = data.get('commit_message', f"Created prompt: {prompt.title}")

                commit_hash = prompt_git_manager.save_prompt(
                    prompt_id=prompt.id,
                    content=prompt.content,
                    commit_message=commit_message,
                    author_name=author_name,
                    author_email=author_email
                )

                # Store Git metadata
                prompt.file_path = f"prompts/{prompt.id}.md"
                prompt.current_commit = commit_hash
                logger.info(f"Saved prompt {prompt.id} to Git: {commit_hash[:7]}")

            except Exception as git_error:
                logger.error(f"Git save failed for prompt {prompt.id}: {git_error}")
                # Continue without Git - not a fatal error

        db.session.commit()
        logger.info(f"Created prompt {prompt.id} for user {current_user.id} - public: {prompt.is_public}")
        return jsonify(prompt.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating prompt: {e}")
        return jsonify({'error': 'Failed to create prompt'}), 500


@chat_bp.route('/prompts/<int:prompt_id>', methods=['PUT'])
def update_prompt(prompt_id):
    """Update a prompt template with Git versioning"""
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

    # Validate if title or content are being updated
    if 'title' in data and not data['title'].strip():
        return jsonify({'error': 'Title cannot be empty'}), 400
    if 'content' in data and not data['content'].strip():
        return jsonify({'error': 'Content cannot be empty'}), 400

    try:
        # Initialize Git manager if needed
        initialize_git_manager()

        # Track if content changed (for Git)
        content_changed = 'content' in data and data['content'].strip() != prompt.content

        # Update fields
        if 'title' in data:
            prompt.title = data['title'].strip()
        if 'content' in data:
            prompt.content = data['content'].strip()
        if 'category' in data:
            prompt.category = data['category'].strip()
        if 'tags' in data:
            prompt.tags = json.dumps(data['tags'])
        if 'is_public' in data:
            old_public = prompt.is_public
            prompt.is_public = bool(data['is_public'])
            if old_public != prompt.is_public:
                logger.info(f"Prompt {prompt_id} public status changed: {old_public} -> {prompt.is_public}")

        prompt.updated_at = datetime.utcnow()

        # Save to Git if content changed and Git is available
        if content_changed and prompt_git_manager:
            try:
                author_name, author_email = get_git_author_info(current_user)
                commit_message = data.get('commit_message', f"Updated prompt: {prompt.title}")

                commit_hash = prompt_git_manager.save_prompt(
                    prompt_id=prompt.id,
                    content=prompt.content,
                    commit_message=commit_message,
                    author_name=author_name,
                    author_email=author_email
                )

                # Update Git metadata
                prompt.file_path = f"prompts/{prompt.id}.md"
                prompt.current_commit = commit_hash
                logger.info(f"Updated prompt {prompt_id} in Git: {commit_hash[:7]}")

            except Exception as git_error:
                logger.error(f"Git update failed for prompt {prompt_id}: {git_error}")
                # Continue without Git - not a fatal error

        db.session.commit()
        logger.info(f"Updated prompt {prompt_id} for user {current_user.id}")
        return jsonify(prompt.to_dict())

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating prompt {prompt_id}: {e}")
        return jsonify({'error': 'Failed to update prompt'}), 500


@chat_bp.route('/prompts/<int:prompt_id>', methods=['DELETE'])
def delete_prompt(prompt_id):
    """Delete a prompt template with Git versioning"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    prompt = PromptTemplate.query.filter_by(
        id=prompt_id,
        user_id=current_user.id
    ).first()

    if not prompt:
        return jsonify({'error': 'Prompt not found'}), 404

    try:
        # Initialize Git manager if needed
        initialize_git_manager()

        # Delete from Git if available
        if prompt_git_manager and prompt.file_path:
            try:
                author_name, author_email = get_git_author_info(current_user)
                commit_message = f"Deleted prompt: {prompt.title}"

                prompt_git_manager.delete_prompt_file(
                    prompt_id=prompt.id,
                    commit_message=commit_message,
                    author_name=author_name,
                    author_email=author_email
                )
                logger.info(f"Deleted prompt {prompt_id} from Git")

            except Exception as git_error:
                logger.error(f"Git deletion failed for prompt {prompt_id}: {git_error}")
                # Continue with DB deletion even if Git fails

        # Delete from database
        db.session.delete(prompt)
        db.session.commit()

        logger.info(f"Deleted prompt {prompt_id} for user {current_user.id}")
        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting prompt {prompt_id}: {e}")
        return jsonify({'error': 'Failed to delete prompt'}), 500


@chat_bp.route('/prompts/<int:prompt_id>/use', methods=['POST'])
def use_prompt(prompt_id):
    """Increment usage count for a prompt"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Allow usage of both user's own prompts and public prompts
    prompt = PromptTemplate.query.filter(
        PromptTemplate.id == prompt_id,
        db.or_(
            PromptTemplate.user_id == current_user.id,
            PromptTemplate.is_public == True
        )
    ).first()

    if not prompt:
        return jsonify({'error': 'Prompt not found or access denied'}), 404

    try:
        prompt.usage_count = (prompt.usage_count or 0) + 1
        prompt.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify(prompt.to_dict())

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating usage count for prompt {prompt_id}: {e}")
        return jsonify({'error': 'Failed to update usage count'}), 500


# ============================================================================
# Version Control Endpoints
# ============================================================================

@chat_bp.route('/prompts/<int:prompt_id>/versions', methods=['GET'])
def get_prompt_versions(prompt_id):
    """Get version history for a prompt"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Check access to prompt
    prompt = PromptTemplate.query.filter(
        PromptTemplate.id == prompt_id,
        db.or_(
            PromptTemplate.user_id == current_user.id,
            PromptTemplate.is_public == True
        )
    ).first()

    if not prompt:
        return jsonify({'error': 'Prompt not found or access denied'}), 404

    # Initialize Git manager if needed
    initialize_git_manager()

    if not prompt_git_manager:
        return jsonify({'error': 'Git versioning not available'}), 503

    try:
        # Get version history from Git
        history = prompt_git_manager.get_version_history(prompt_id)

        # Mark current version
        for version in history:
            version['is_current'] = (version['commit_hash'] == prompt.current_commit)

        return jsonify({
            'prompt_id': prompt_id,
            'prompt_title': prompt.title,
            'current_commit': prompt.current_commit,
            'versions': history
        })

    except Exception as e:
        logger.error(f"Error getting version history for prompt {prompt_id}: {e}")
        return jsonify({'error': 'Failed to get version history'}), 500


@chat_bp.route('/prompts/<int:prompt_id>/versions/<commit_hash>', methods=['GET'])
def get_prompt_version_content(prompt_id, commit_hash):
    """Get content of a specific version of a prompt"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Check access to prompt
    prompt = PromptTemplate.query.filter(
        PromptTemplate.id == prompt_id,
        db.or_(
            PromptTemplate.user_id == current_user.id,
            PromptTemplate.is_public == True
        )
    ).first()

    if not prompt:
        return jsonify({'error': 'Prompt not found or access denied'}), 404

    # Initialize Git manager if needed
    initialize_git_manager()

    if not prompt_git_manager:
        return jsonify({'error': 'Git versioning not available'}), 503

    try:
        # Get content from specific commit
        content = prompt_git_manager.get_prompt_content(prompt_id, commit_hash)

        if content is None:
            return jsonify({'error': 'Version not found'}), 404

        return jsonify({
            'prompt_id': prompt_id,
            'commit_hash': commit_hash,
            'content': content,
            'is_current': (commit_hash == prompt.current_commit)
        })

    except Exception as e:
        logger.error(f"Error getting version content for prompt {prompt_id} at {commit_hash}: {e}")
        return jsonify({'error': 'Failed to get version content'}), 500


@chat_bp.route('/prompts/<int:prompt_id>/diff', methods=['GET'])
def get_prompt_diff(prompt_id):
    """Get diff between two versions of a prompt"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Check access to prompt
    prompt = PromptTemplate.query.filter(
        PromptTemplate.id == prompt_id,
        db.or_(
            PromptTemplate.user_id == current_user.id,
            PromptTemplate.is_public == True
        )
    ).first()

    if not prompt:
        return jsonify({'error': 'Prompt not found or access denied'}), 404

    # Get query parameters
    from_commit = request.args.get('from_commit')
    to_commit = request.args.get('to_commit')

    if not from_commit or not to_commit:
        return jsonify({'error': 'Both from_commit and to_commit parameters are required'}), 400

    # Initialize Git manager if needed
    initialize_git_manager()

    if not prompt_git_manager:
        return jsonify({'error': 'Git versioning not available'}), 503

    try:
        # Get diff between commits
        diff = prompt_git_manager.get_diff(prompt_id, from_commit, to_commit)

        return jsonify({
            'prompt_id': prompt_id,
            'from_commit': from_commit,
            'to_commit': to_commit,
            'diff': diff
        })

    except Exception as e:
        logger.error(f"Error getting diff for prompt {prompt_id} ({from_commit}..{to_commit}): {e}")
        return jsonify({'error': 'Failed to get diff'}), 500


@chat_bp.route('/prompts/<int:prompt_id>/rollback', methods=['POST'])
def rollback_prompt(prompt_id):
    """Rollback a prompt to a previous version"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Check ownership (only owner can rollback)
    prompt = PromptTemplate.query.filter_by(
        id=prompt_id,
        user_id=current_user.id
    ).first()

    if not prompt:
        return jsonify({'error': 'Prompt not found or access denied'}), 404

    data = request.get_json()
    target_commit = data.get('target_commit')
    commit_message = data.get('commit_message')

    if not target_commit:
        return jsonify({'error': 'target_commit is required'}), 400

    if not commit_message:
        commit_message = f"Rolled back to version {target_commit[:7]}"

    # Initialize Git manager if needed
    initialize_git_manager()

    if not prompt_git_manager:
        return jsonify({'error': 'Git versioning not available'}), 503

    try:
        # Perform rollback in Git
        author_name, author_email = get_git_author_info(current_user)

        new_commit_hash = prompt_git_manager.rollback_prompt(
            prompt_id=prompt.id,
            target_commit=target_commit,
            commit_message=commit_message,
            author_name=author_name,
            author_email=author_email
        )

        # Get the rolled-back content
        rolled_back_content = prompt_git_manager.get_prompt_content(prompt_id)

        # Update database
        prompt.content = rolled_back_content
        prompt.current_commit = new_commit_hash
        prompt.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Rolled back prompt {prompt_id} to {target_commit[:7]}, new commit: {new_commit_hash[:7]}")

        return jsonify({
            'success': True,
            'prompt': prompt.to_dict(),
            'new_commit': new_commit_hash,
            'target_commit': target_commit,
            'message': 'Prompt rolled back successfully'
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error rolling back prompt {prompt_id}: {e}")
        return jsonify({'error': 'Failed to rollback prompt'}), 500


@chat_bp.route('/public-prompts', methods=['GET'])
def get_public_prompts():
    """Get public prompt templates with search, filtering, and pagination"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Get query parameters
    search_query = request.args.get('search', '').strip()
    category_filter = request.args.get('category', '').strip()
    tag_filter = request.args.get('tag', '').strip() # Retrieve tag filter
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(100, max(1, int(request.args.get('per_page', 20))))  # Limit per_page to prevent abuse

    try:
        # Build base query for public prompts
        query = PromptTemplate.query.filter_by(is_public=True)

        # Apply search filter
        if search_query:
            search_pattern = f'%{search_query}%'
            query = query.filter(
                db.or_(
                    PromptTemplate.title.ilike(search_pattern),
                    PromptTemplate.content.ilike(search_pattern),
                    PromptTemplate.tags.ilike(search_pattern),
                    PromptTemplate.category.ilike(search_pattern)
                )
            )

        # Apply category filter
        if category_filter:
            query = query.filter(PromptTemplate.category.ilike(f'%{category_filter}%'))

        # Apply tag filter
        if tag_filter:
            # Use JSON array containment pattern for exact tag match
            # Handle both quoted and unquoted array elements
            tag_pattern = f'%"{tag_filter}"%'  # For double-quoted strings
            alt_pattern = f"%'{tag_filter}'%"  # For single-quoted strings
            query = query.filter(
                db.or_(
                    PromptTemplate.tags.ilike(tag_pattern),
                    PromptTemplate.tags.ilike(alt_pattern)
                )
            )

        # Order by popularity and recency
        query = query.order_by(
            PromptTemplate.likes_count.desc().nullslast(),
            PromptTemplate.usage_count.desc().nullslast(),
            PromptTemplate.created_at.desc()
        )

        # Apply pagination
        paginated_prompts = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )

        # Get author information efficiently
        user_ids = list(set(prompt.user_id for prompt in paginated_prompts.items))
        users_dict = {
            user.id: user.username
            for user in User.query.filter(User.id.in_(user_ids)).all()
        } if user_ids else {}

        # Build response with author info
        prompts_with_authors = []
        for prompt in paginated_prompts.items:
            prompt_dict = prompt.to_dict()
            prompt_dict['author'] = users_dict.get(prompt.user_id, 'Unknown')
            prompts_with_authors.append(prompt_dict)

        return jsonify({
            'prompts': prompts_with_authors,
            'pagination': {
                'page': paginated_prompts.page,
                'per_page': paginated_prompts.per_page,
                'total': paginated_prompts.total,
                'pages': paginated_prompts.pages,
                'has_next': paginated_prompts.has_next,
                'has_prev': paginated_prompts.has_prev
            }
        })

    except Exception as e:
        logger.error(f"Error getting public prompts: {e}")
        return jsonify({'error': 'Failed to load public prompts'}), 500


@chat_bp.route('/prompts/<int:prompt_id>/like', methods=['POST'])
def like_prompt(prompt_id):
    """Like or unlike a public prompt"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    prompt = PromptTemplate.query.get(prompt_id)
    if not prompt:
        return jsonify({'error': 'Prompt not found'}), 404

    # Check if prompt is public
    if not prompt.is_public:
        return jsonify({'error': 'Cannot like private prompts'}), 403

    try:
        # Check if user already liked this prompt
        existing_like = PromptLike.query.filter_by(
            user_id=current_user.id,
            prompt_id=prompt_id
        ).first()

        if existing_like:
            # Unlike: remove the like
            db.session.delete(existing_like)
            prompt.likes_count = max(0, (prompt.likes_count or 0) - 1)
            liked = False
            action = 'unliked'
        else:
            # Like: add the like
            new_like = PromptLike(
                user_id=current_user.id,
                prompt_id=prompt_id
            )
            db.session.add(new_like)
            prompt.likes_count = (prompt.likes_count or 0) + 1
            liked = True
            action = 'liked'

        prompt.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"User {current_user.id} {action} prompt {prompt_id}")

        return jsonify({
            'liked': liked,
            'likes_count': prompt.likes_count,
            'action': action
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error toggling like for prompt {prompt_id}: {e}")
        return jsonify({'error': 'Failed to toggle like'}), 500


@chat_bp.route('/prompts/<int:prompt_id>/like-status', methods=['GET'])
def get_prompt_like_status(prompt_id):
    """Get like status for a prompt"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    prompt = PromptTemplate.query.get(prompt_id)
    if not prompt:
        return jsonify({'error': 'Prompt not found'}), 404

    try:
        # Check if user has liked this prompt
        existing_like = PromptLike.query.filter_by(
            user_id=current_user.id,
            prompt_id=prompt_id
        ).first()

        return jsonify({
            'liked': existing_like is not None,
            'likes_count': prompt.likes_count or 0
        })

    except Exception as e:
        logger.error(f"Error getting like status for prompt {prompt_id}: {e}")
        return jsonify({'error': 'Failed to get like status'}), 500


@chat_bp.route('/files/upload', methods=['POST'])
def upload_file():
    """Upload a file with better Cyrillic filename support and timeout handling"""
    try:
        logger.info(f"File upload request received. Headers: {dict(request.headers)}")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Request files: {list(request.files.keys()) if request.files else 'No files'}")
        logger.info(f"Authorization header: {request.headers.get('Authorization', 'Not present')}")
        logger.info(f"Cookies: {dict(request.cookies)}")

        current_user = get_current_user()
        logger.info(f"Current user result: {current_user}")
        if not current_user:
            logger.warning("Authentication failed - no current user")
            return jsonify({'error': 'Authentication required'}), 401

        if 'file' not in request.files:
            logger.warning("No file in request.files")
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            logger.warning("Empty filename")
            return jsonify({'error': 'No file selected'}), 400

        logger.info(f"Processing file: {file.filename}")

        # Create uploads directory if it doesn't exist
        logger.debug(f"Current app root path: {current_app.root_path}")
        upload_dir = os.path.join(current_app.root_path, 'uploads')
        logger.debug(f"Upload directory path: {upload_dir}")
        os.makedirs(upload_dir, exist_ok=True)
        logger.debug(f"Upload directory exists: {os.path.exists(upload_dir)}; writable: {os.access(upload_dir, os.W_OK)}")

        # Handle Cyrillic and special characters in filename
        original_filename = file.filename

        # Ensure filename is properly encoded
        if isinstance(original_filename, bytes):
            original_filename = original_filename.decode('utf-8')

        # Create a safe ASCII filename while preserving the original
        safe_filename = secure_filename(original_filename)
        if not safe_filename:  # If secure_filename returns empty (all non-ASCII)
            # Fallback: use file extension with timestamp
            file_ext = os.path.splitext(original_filename)[1] if '.' in original_filename else ''
            safe_filename = f"uploaded_file_{int(datetime.now().timestamp())}{file_ext}"

        # Ensure the safe filename has an extension; secure_filename may strip non-ascii basename
        base, ext = os.path.splitext(safe_filename)
        if not ext:
            # Recover extension from original filename
            orig_ext = os.path.splitext(original_filename)[1]
            if orig_ext:
                ext = orig_ext if orig_ext.startswith('.') else f".{orig_ext}"
            else:
                ext = ''
        # Normalize extension to lower-case
        ext = ext.lower()

        # Generate unique filename with proper extension
        unique_filename = f"{uuid.uuid4()}_{base}{ext}"
        file_path = os.path.join(upload_dir, unique_filename)
        logger.debug(f"File will be saved as: {file_path}")

        # Save the file first with timeout handling
        try:
            file.save(file_path)
            logger.info(f"File saved successfully: {file_path}")
        except Exception as save_error:
            logger.exception(f"File save error: {save_error}")
            return jsonify({'error': f'Failed to save file: {str(save_error)}'}), 500

        # Convert file to PDF if it's a supported format
        converted_file_path = file_path
        original_file_path = file_path
        file_was_converted = False
        try:
            file_ext = os.path.splitext(original_filename.lower())[1]
            logger.debug(f"File extension detected: {file_ext}")
            logger.debug(f"Original file_path: {file_path}")

            if file_ext in ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.py', '.js', '.html', '.css', '.xml', '.json', '.csv']:
                logger.info(f"Converting {file_ext} file to PDF...")
                logger.debug(f"Calling FileConverter.convert_to_pdf({file_path}, {upload_dir})")
                converted_file_path = FileConverter.convert_to_pdf(file_path, upload_dir)
                logger.debug(f"FileConverter.convert_to_pdf returned: {converted_file_path}")

                if converted_file_path and converted_file_path != file_path:
                    logger.info(f"File converted successfully to: {converted_file_path}")
                    # Update file info for the converted file
                    file_size = os.path.getsize(converted_file_path)
                    mime_type = 'application/pdf'
                    # Update the file_path to use the converted version
                    old_file_path = file_path
                    file_path = converted_file_path
                    file_was_converted = True
                    logger.debug(f"Updated file_path from {old_file_path} to converted version: {file_path}")
                    logger.debug(f"New file size: {file_size} bytes")
                    logger.debug(f"New MIME type: {mime_type}")
                else:
                    logger.warning("File conversion failed or returned same path; using original file")
                    logger.debug(f"converted_file_path={converted_file_path}, file_path={file_path}")
            else:
                logger.debug(f"File type {file_ext} doesn't require conversion")
        except Exception as conv_error:
            logger.exception(f"File conversion error: {conv_error}")
            # Continue with original file if conversion fails
            converted_file_path = file_path

        # Get file info after saving (and conversion if applicable)
        if not file_was_converted:
            file_size = os.path.getsize(file_path)
            logger.debug(f"File size (no conversion): {file_size} bytes")

        # Determine MIME type (converted files keep application/pdf)
        if not file_was_converted:
            mime_type = _guess_mime_type(safe_filename, original_filename)
        else:
            logger.debug(f"Using converted file MIME type: {mime_type}")

        logger.debug(f"Final file_path before database save: {file_path}")
        logger.debug(f"Final filename: {os.path.basename(file_path)}")
        logger.debug(f"Final MIME type: {mime_type}")
        logger.debug(f"File exists: {os.path.exists(file_path)}")

        # Normalize the file path for the current operating system
        file_path = os.path.normpath(file_path)
        logger.debug(f"Normalized file_path: {file_path}; exists={os.path.exists(file_path)}")

        # Validate file size (20MB limit)
        max_size = 20 * 1024 * 1024  # 20MB
        if file_size > max_size:
            # Remove the uploaded file if it's too large
            try:
                os.remove(file_path)
            except:
                pass
            return jsonify({
                'error': f'File size ({file_size / (1024 * 1024):.1f}MB) exceeds 20MB limit',
                'file_size': file_size,
                'max_size': max_size
            }), 400

        # Validate file content (basic check)
        if file_size == 0:
            try:
                os.remove(file_path)
            except:
                pass
            return jsonify({'error': 'File appears to be empty or corrupted'}), 400

        # Save to database with original filename preserved
        logger.info(f"About to save file to database. User ID: {current_user.id}")
        logger.debug(f"Storing file_path={file_path}, filename={os.path.basename(file_path)}, mime_type={mime_type}")

        file_upload = FileUpload(
            user_id=current_user.id,
            filename=os.path.basename(file_path),  # Use converted filename if available
            original_filename=original_filename,  # Preserve original Cyrillic name
            file_path=file_path,  # Use converted file path if available
            file_size=file_size,
            mime_type=mime_type
        )

        logger.info(f"FileUpload object created: {file_upload}")
        db.session.add(file_upload)
        logger.info(f"FileUpload added to session")
        db.session.commit()
        logger.info(f"File uploaded successfully to database with ID: {file_upload.id}")

        # Clean up original file if it was converted and is different
        if file_was_converted and converted_file_path and (converted_file_path != original_file_path):
            if os.path.exists(original_file_path):
                try:
                    os.remove(original_file_path)
                    logger.warning(f"Cleaned up original file: {original_file_path}")
                except Exception as cleanup_error:
                    logger.warning(f"Warning: Could not clean up original file: {cleanup_error}")

        return jsonify(file_upload.to_dict()), 201

    except UnicodeDecodeError as e:
        logger.exception(f"Unicode decode error: {e}")
        return jsonify({'error': f'Filename encoding error: {str(e)}'}), 400
    except Exception as e:
        logger.exception(f"Unexpected error in upload_file: {e}")
        logger.debug(f"Error type: {type(e).__name__}")
        import traceback
        logger.debug(f"Traceback: {traceback.format_exc()}")

        # Clean up file if database save fails
        if 'file_path' in locals() and os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.debug(f"Cleaned up file: {file_path}")
            except:
                pass
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500


@chat_bp.route('/files/<int:file_id>/download', methods=['GET'])
def download_file(file_id):
    """Download/serve an uploaded file"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    file_upload = FileUpload.query.filter_by(
        id=file_id,
        user_id=current_user.id
    ).first()

    if not file_upload:
        return jsonify({'error': 'File not found or access denied'}), 404

    if not os.path.exists(file_upload.file_path):
        return jsonify({'error': 'File not found on disk'}), 404

    # Serve the file
    return send_from_directory(
        os.path.dirname(file_upload.file_path),
        os.path.basename(file_upload.file_path),
        as_attachment=False, # Change to False to allow inline display
        download_name=file_upload.original_filename, # Use original filename for download
        mimetype=file_upload.mime_type or 'application/octet-stream'
    )


@chat_bp.route('/search', methods=['GET'])
def search_content():
    """Search through sessions and prompts content"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'sessions': [], 'prompts': []})

    query_lower = query.lower()

    # Search in sessions (including message content)
    sessions_results = []
    sessions = ChatSession.query.filter_by(user_id=current_user.id).all()

    for session in sessions:
        # Check if query matches session title
        if query_lower in session.title.lower():
            sessions_results.append({
                'id': session.id,
                'title': session.title,
                'model': session.model,
                'client_type': session.client_type,
                'created_at': session.created_at.isoformat() if session.created_at else None,
                'updated_at': session.updated_at.isoformat() if session.updated_at else None,
                'message_count': len(session.messages),
                'match_type': 'title',
                'match_content': session.title
            })
            continue

        # Check if query matches any message content
        for message in session.messages:
            if query_lower in message.content.lower():
                sessions_results.append({
                    'id': session.id,
                    'title': session.title,
                    'model': session.model,
                    'client_type': session.client_type,
                    'created_at': session.created_at.isoformat() if session.created_at else None,
                    'updated_at': session.updated_at.isoformat() if session.updated_at else None,
                    'message_count': len(session.messages),
                    'match_type': 'message',
                    'match_content': message.content[:200] + '...' if len(message.content) > 200 else message.content,
                    'message_role': message.role,
                    'message_timestamp': message.timestamp.isoformat() if message.timestamp else None
                })
                break  # Only add session once even if multiple messages match

    # Search in prompts
    prompts_results = []
    prompts = PromptTemplate.query.filter_by(user_id=current_user.id).all()

    print(f"DEBUG: Found {len(prompts)} prompts to search through")
    print(f"DEBUG: Search query: '{query}'")

    for prompt in prompts:
        # Debug: Print prompt details
        # print(f"DEBUG: Checking prompt '{prompt.title}' - content length: {len(prompt.content) if prompt.content else 0}")

        # Check if query matches prompt title, content, or category
        title_match = query_lower in prompt.title.lower()
        content_match = query_lower in prompt.content.lower() if prompt.content else False
        category_match = query_lower in prompt.category.lower() if prompt.category else False

        if title_match or content_match or category_match:
            print(f"DEBUG: Prompt '{prompt.title}' matches - title: {title_match}, content: {content_match}, category: {category_match}")

            # Determine match type and content with priority: content > title > category
            if content_match:
                match_type = 'content'
                match_content = prompt.content[:200] + '...' if len(prompt.content) > 200 else prompt.content
            elif title_match:
                match_type = 'title'
                match_content = prompt.title
            elif category_match:
                match_type = 'category'
                # For category matches, show the actual prompt content as the match content
                match_content = prompt.content[:200] + '...' if len(prompt.content) > 200 else prompt.content
            else:
                # Fallback (shouldn't happen with the if condition above)
                match_type = 'title'
                match_content = prompt.title

            # Safely handle tags
            try:
                tags = json.loads(prompt.tags) if prompt.tags and prompt.tags.strip() else []
            except (json.JSONDecodeError, ValueError):
                tags = []

            prompts_results.append({
                'id': prompt.id,
                'title': prompt.title,
                'content': prompt.content,
                'category': prompt.category,
                'tags': tags,
                'created_at': prompt.created_at.isoformat() if prompt.created_at else None,
                'updated_at': prompt.updated_at.isoformat() if prompt.updated_at else None,
                'match_type': match_type,
                'match_content': match_content
            })

    # Sort results by relevance (title matches first, then by recency)
    sessions_results.sort(key=lambda x: (x['match_type'] != 'title', x['updated_at'] or ''), reverse=True)
    prompts_results.sort(key=lambda x: (x['match_type'] != 'title', x['updated_at'] or ''), reverse=True)

    print(f"DEBUG: Final results - sessions: {len(sessions_results)}, prompts: {len(prompts_results)}")

    return jsonify({
        'sessions': sessions_results,
        'prompts': prompts_results,
        'query': query
    })


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


@chat_bp.route('/files/<int:file_id>/status', methods=['GET'])
def get_file_status(file_id):
    """Get file upload status and processing information"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    file_upload = FileUpload.query.filter_by(
        id=file_id,
        user_id=current_user.id
    ).first()

    if not file_upload:
        return jsonify({'error': 'File not found'}), 404

    # Check if file exists on disk
    file_exists = os.path.exists(file_upload.file_path)
    file_size = os.path.getsize(file_upload.file_path) if file_exists else 0

    # Get file modification time
    file_modified = None
    if file_exists:
        try:
            file_modified = datetime.fromtimestamp(os.path.getmtime(file_upload.file_path))
        except:
            pass

    status_info = {
        'id': file_upload.id,
        'filename': file_upload.filename,
        'original_filename': file_upload.original_filename,
        'file_size': file_size,
        'mime_type': file_upload.mime_type,
        'uploaded_at': file_upload.uploaded_at.isoformat() if file_upload.uploaded_at else None,
        'file_exists': file_exists,
        'file_modified': file_modified.isoformat() if file_modified else None,
        'status': 'ready' if file_exists and file_size > 0 else 'missing',
        'processing_status': 'completed' if file_exists and file_size > 0 else 'failed'
    }

    return jsonify(status_info)