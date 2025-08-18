import os
import sys

# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, session
from flask_cors import CORS
from src.database import db
from src.models.chat import ChatSession, ChatMessage, PromptTemplate, FileUpload
from src.models.user import User, UserSession
from src.routes.user import user_bp
from src.routes.chat import chat_bp
from src.routes.auth import auth_bp
from datetime import timedelta

def create_app():
    app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
    app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
    
    # Session configuration
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
    app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
    app.config['SESSION_COOKIE_HTTPONLY'] = False  # Allow JavaScript access
    app.config['SESSION_COOKIE_SAMESITE'] = None  # Required for cross-origin cookies
    app.config['SESSION_COOKIE_DOMAIN'] = None  # Allow cross-domain cookies
    app.config['SESSION_COOKIE_NAME'] = 'session'  # Explicit session cookie name
    app.config['SESSION_COOKIE_PATH'] = '/'

    # Database configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Initialize extensions
    db.init_app(app)

    # Enable CORS for all routes with more specific configuration
    CORS(app,
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Cookie", "Set-Cookie", "X-Session-ID"],
         supports_credentials=True,
         expose_headers=["Set-Cookie", "X-Session-ID"],
         intercept_exceptions=False,
         # FIXED: Add origin validation function for network IPs
         )

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(user_bp, url_prefix='/api')
    app.register_blueprint(chat_bp, url_prefix='/api')

    # Create database tables
    with app.app_context():
        # Ensure database directory exists
        db_dir = os.path.join(os.path.dirname(__file__), 'database')
        os.makedirs(db_dir, exist_ok=True)
        
        # Create all tables
        db.create_all()
        
        # Migration: Add new columns to existing tables if they don't exist
        try:
            # Check if we need to add user_id columns to existing tables
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)

            # Check if tables exist first
            tables = inspector.get_table_names()
            print(f"Existing tables: {tables}")

            # Create a default user if none exists
            with db.engine.connect() as connection:
                default_user = User.query.first()
                if not default_user:
                    print("Creating default admin user")
                    default_user = User(
                        username='admin',
                        email='admin@example.com'
                    )
                    default_user.set_password('admin123')
                    db.session.add(default_user)
                    db.session.commit()
                    print(f"Created default user with ID: {default_user.id}")

                # Check and add missing columns
                if 'chat_sessions' in tables:
                    chat_columns = [col['name'] for col in inspector.get_columns('chat_sessions')]
                    print(f"Chat sessions columns: {chat_columns}")

                    if 'user_id' not in chat_columns:
                        print("Adding user_id column to chat_sessions")
                        connection.execute(text('ALTER TABLE chat_sessions ADD COLUMN user_id INTEGER'))
                        connection.execute(
                            text(f'UPDATE chat_sessions SET user_id = {default_user.id} WHERE user_id IS NULL'))

                    if 'is_closed' not in chat_columns:
                        print("Adding is_closed column to chat_sessions")
                        connection.execute(text('ALTER TABLE chat_sessions ADD COLUMN is_closed BOOLEAN DEFAULT 0'))

                if 'prompt_templates' in tables:
                    prompt_columns = [col['name'] for col in inspector.get_columns('prompt_templates')]
                    print(f"Prompt templates columns: {prompt_columns}")

                    if 'user_id' not in prompt_columns:
                        print("Adding user_id column to prompt_templates")
                        connection.execute(text('ALTER TABLE prompt_templates ADD COLUMN user_id INTEGER'))
                        connection.execute(
                            text(f'UPDATE prompt_templates SET user_id = {default_user.id} WHERE user_id IS NULL'))

                if 'file_uploads' in tables:
                    file_columns = [col['name'] for col in inspector.get_columns('file_uploads')]
                    print(f"File uploads columns: {file_columns}")

                    if 'user_id' not in file_columns:
                        print("Adding user_id column to file_uploads")
                        connection.execute(text('ALTER TABLE file_uploads ADD COLUMN user_id INTEGER'))
                        connection.execute(
                            text(f'UPDATE file_uploads SET user_id = {default_user.id} WHERE user_id IS NULL'))

                # Commit the connection
                connection.commit()

            print("Database migration completed successfully")

        except Exception as e:
            print(f"Migration error: {e}")
            # Database was already recreated, so we're good to go

            # Just ensure we have a default user
            try:
                default_user = User.query.first()
                if not default_user:
                    print("Creating default admin user after recreation")
                    default_user = User(
                        username='admin',
                        email='admin@example.com'
                    )
                    default_user.set_password('admin123')
                    db.session.add(default_user)
                    db.session.commit()
                    print(f"Created default user with ID: {default_user.id}")
            except Exception as user_error:
                print(f"Error creating default user: {user_error}")

        except Exception as e:
            print(f"Migration error: {e}")
            db.session.rollback()
            # If migration fails completely, recreate the database
            print("Migration failed, recreating database...")
            try:
                db.drop_all()
                db.create_all()
                print("Database recreated successfully")
            except Exception as recreate_error:
                print(f"Database recreation failed: {recreate_error}")

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
    app.run(host='0.0.0.0', port=5000, debug=True)