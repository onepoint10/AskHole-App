import logging
import base64
import os
import mimetypes
import requests
import json
from typing import List, Tuple
from datetime import datetime
from openai import OpenAI

class CustomClient:
    """Custom API client with configurable base URL and API key"""

    def __init__(self, provider_name: str, base_url: str, api_key: str):
        """Initialize Custom client"""
        self.provider_name = provider_name
        self.base_url = base_url
        self.api_key = api_key
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        self.chat_sessions = {}  # Store conversation history
        logging.info(f"Custom client initialized for {provider_name}")

    def get_available_models(self) -> List[str]:
        """Get available models from the custom provider"""
        try:
            # Try to get models from the provider's models endpoint
            response = self.client.models.list()
            models = [model.id for model in response.data]
            logging.info(f"Retrieved {len(models)} models from {self.provider_name}")
            return models
        except Exception as e:
            logging.warning(f"Could not retrieve models from {self.provider_name}: {e}")
            # Return empty list if we can't get models
            return []

    def send_message(self, session_id: str, message: str, model: str, files: List[str] = None, 
                    temperature: float = 1.0, max_tokens: int = 4096, stream: bool = False) -> dict:
        """Send a message to the custom provider"""
        try:
            # Prepare messages for the API
            messages = [{"role": "user", "content": message}]

            # Make the API call
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=stream
            )

            if stream:
                return response
            else:
                return {
                    'response': response.choices[0].message.content,
                    'model': model,
                    'provider': self.provider_name,
                    'usage': response.usage.dict() if response.usage else None
                }

        except Exception as e:
            logging.error(f"Error sending message to {self.provider_name}: {e}")
            raise Exception(f"Failed to send message to {self.provider_name}: {str(e)}")

    def get_session_history(self, session_id: str) -> List[dict]:
        """Get conversation history for a session"""
        return self.chat_sessions.get(session_id, [])

    def add_to_session_history(self, session_id: str, role: str, content: str):
        """Add a message to session history"""
        if session_id not in self.chat_sessions:
            self.chat_sessions[session_id] = []
        
        self.chat_sessions[session_id].append({
            'role': role,
            'content': content,
            'timestamp': datetime.now().isoformat()
        })

    def clear_session_history(self, session_id: str):
        """Clear conversation history for a session"""
        if session_id in self.chat_sessions:
            del self.chat_sessions[session_id]