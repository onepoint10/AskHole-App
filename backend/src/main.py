import os
import sys
import logging

# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Configure logging early
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Set environment variables for timeouts
os.environ['FLASK_REQUEST_TIMEOUT'] = '120'
os.environ['WERKZEUG_TIMEOUT'] = '120'

from flask import Flask, send_from_directory, session, jsonify, request
from flask_cors import CORS, cross_origin
from src.database import db
from src.models.chat import ChatSession, ChatMessage, PromptTemplate, FileUpload, PromptLike
from src.models.user import User, UserSession
from src.models.workflow import (
    WorkflowSpace, WorkflowSpaceMember, WorkflowPromptAssociation,
    PromptVersion, Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution
)
from src.routes.user import user_bp
from src.routes.chat import chat_bp
from src.routes.auth import auth_bp
from src.routes.admin import admin_bp
from src.routes.workflow import workflow_bp
from src.exa_client import ExaClient
from datetime import timedelta

def create_app():
    """Create and configure Flask application."""
    app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
    app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

    # Timeout configurations for file uploads
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
    app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
    app.config['SESSION_COOKIE_HTTPONLY'] = False  # Allow JavaScript access
    app.config['SESSION_COOKIE_SAMESITE'] = None  # Required for cross-origin cookies
    app.config['SESSION_COOKIE_DOMAIN'] = None  # Allow cross-domain cookies
    app.config['SESSION_COOKIE_NAME'] = 'session'  # Explicit session cookie name
    app.config['SESSION_COOKIE_PATH'] = '/'

    # Increase timeout for file operations
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')

    # Flask timeout configurations
    app.config['REQUEST_TIMEOUT'] = 150  # 120 seconds for request timeout
    app.config['UPLOAD_TIMEOUT'] = 150   # 120 seconds for upload timeout

    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Database configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Initialize extensions
    db.init_app(app)

    # Configure Werkzeug for better file handling
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

    # Set Werkzeug timeout for file operations
    import werkzeug
    werkzeug.serving.WSGIRequestHandler.protocol_version = "HTTP/1.1"

    # Enable CORS for all routes with more specific configuration
    allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://192.168.1.138:5173",
                       "https://app.askhole.ru", "https://www.app.askhole.ru"]
    CORS(app,
         origins=allowed_origins,
         resources={r"/api/*": {"origins": allowed_origins, "supports_credentials": True}},
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Cookie", "Set-Cookie", "X-Session-ID", "Accept-Language"],
         expose_headers=["Set-Cookie", "X-Session-ID"],
         intercept_exceptions=False
         )

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(user_bp, url_prefix='/api')
    app.register_blueprint(chat_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(workflow_bp, url_prefix='/api')

    # Exa routes
    # These are defined directly on the app, so no blueprint registration needed for them

    @app.route('/api/exa/search', methods=['POST'])
    def exa_search():
        data = request.json
        query = data.get('query')
        api_key = data.get('api_key')
        num_results = data.get('num_results', 10)
        search_type = data.get('type', 'auto')
        category = data.get('category')
        include_domains = data.get('include_domains')
        exclude_domains = data.get('exclude_domains')

        if not query or not api_key:
            return jsonify({'error': 'Query and API key are required.'}), 400

        exa_client = ExaClient(api_key)
        results = exa_client.search(
            query=query,
            num_results=num_results,
            type=search_type,
            category=category,
            include_domains=include_domains,
            exclude_domains=exclude_domains
        )
        return jsonify(results)

    @app.route('/api/exa/contents', methods=['POST'])
    def exa_get_contents():
        data = request.json
        ids = data.get('ids')
        api_key = data.get('api_key')

        if not ids or not api_key:
            return jsonify({'error': 'IDs and API key are required.'}), 400

        exa_client = ExaClient(api_key)
        contents = exa_client.get_contents(ids)
        return jsonify(contents)

    @app.route('/api/exa/search_and_contents', methods=['POST', 'OPTIONS'])
    @cross_origin(origins=allowed_origins, methods=['POST', 'OPTIONS'], headers=['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie', 'Set-Cookie', 'X-Session-ID', 'Accept-Language'], supports_credentials=True)
    def exa_search_and_contents():
        data = request.json
        query = data.get('query')
        api_key = data.get('api_key')
        num_results = data.get('num_results', 10)
        search_type = data.get('type', 'auto')
        category = data.get('category')
        include_domains = data.get('include_domains')
        exclude_domains = data.get('exclude_domains')
        text = data.get('text', False)

        if not query or not api_key:
            return jsonify({'error': 'Query and API key are required.'}), 400

        exa_client = ExaClient(api_key)
        results = exa_client.search_and_contents(
            query=query,
            num_results=num_results,
            type=search_type,
            category=category,
            include_domains=include_domains,
            exclude_domains=exclude_domains,
            text=text
        )
        return jsonify(results)

    # Create database tables
    with app.app_context():
        # Ensure database directory exists
        db_dir = os.path.join(os.path.dirname(__file__), 'database')
        os.makedirs(db_dir, exist_ok=True)

        # Create all tables
        db.create_all()

        # Migration: Add new columns to existing tables if they don't exist
        try:
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)

            tables = inspector.get_table_names()
            logger.info(f"Existing tables: {tables}")

            # Create a default user if none exists
            with db.engine.connect() as connection:
                default_user = User.query.first()
                if not default_user:
                    logger.info("Creating default admin user")
                    default_user = User(
                        username='admin',
                        email='admin@example.com'
                    )
                    default_user.set_password('admin123')
                    db.session.add(default_user)
                    db.session.commit()
                    logger.info(f"Created default user with ID: {default_user.id}")

            logger.info("Database migration completed successfully")

        except Exception as e:
            logger.exception(f"Migration error: {e}")
            db.session.rollback()
            try:
                db.drop_all()
                db.create_all()
                logger.info("Database recreated successfully")
            except Exception as recreate_error:
                logger.exception(f"Database recreation failed: {recreate_error}")

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({'error': 'File too large. Maximum size is 100MB.'}), 413

    @app.errorhandler(408)
    def timeout(e):
        return jsonify({'error': 'Request timeout. Please try again with a smaller file or check your connection.'}), 408

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({'error': 'Internal server error. Please try again later.'}), 500

    logger.info("Database initialization completed successfully")

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        static_folder_path = app.static_folder
        if static_folder_path is None:
            return "Static folder not configured", 404

        if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
            return send_from_directory(static_folder_path, path)
        else:
            index_path = os.path.join(static_folder_path, 'index.html')
            if os.path.exists(index_path):
                return send_from_directory(static_folder_path, 'index.html')
            else:
                return "index.html not found", 404

    return app


app = create_app()

if __name__ == '__main__':
    app = create_app()

    logger.info("Starting Flask app with 150-second timeout for file operations...")
    logger.info("File upload timeout: 150 seconds; Max file size: 100MB")

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,
        threaded=True,
        use_reloader=False
    )