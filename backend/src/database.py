from flask_sqlalchemy import SQLAlchemy
from cryptography.fernet import Fernet
import os

db = SQLAlchemy()

# Generate a key and store it securely (e.g., in an environment variable)
# For demonstration, we'll generate one here if not found. In production, load from a secure source.
encryption_key = os.environ.get("CHAT_ENCRYPTION_KEY")
if not encryption_key:
    print("WARNING: CHAT_ENCRYPTION_KEY not found. Generating a new key. This is NOT secure for production.")
    encryption_key = Fernet.generate_key().decode()
    os.environ["CHAT_ENCRYPTION_KEY"] = encryption_key # Store for current session
    print(f"Generated Key: {encryption_key}") # For debugging, remove in production

f = Fernet(encryption_key.encode())

def encrypt_message(message):
    return f.encrypt(message.encode()).decode()

def decrypt_message(encrypted_message):
    return f.decrypt(encrypted_message.encode()).decode()