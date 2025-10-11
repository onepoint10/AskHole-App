# AskHole - AI Chat Assistant Codebase Instructions for AI Agents

This document provides essential knowledge for AI coding agents to be immediately productive in the AskHole codebase.

## 1. Big Picture Architecture

AskHole is a full-stack AI chat application with a Flask backend and a React frontend.

- **Backend (Flask)**:
    - Provides a RESTful API.
    - Manages data persistence using SQLite (`backend/src/database/app.db`).
    - Integrates with AI services (Google Gemini via `backend/src/gemini_client.py` and OpenRouter via `backend/src/openrouter_client.py`).
    - Handles file uploads (`backend/src/uploads/`).
    - Key components:
        - `backend/src/main.py`: Flask application entry point.
        - `backend/src/routes/`: Contains API route definitions (e.g., `chat.py`, `user.py`).
        - `backend/src/models/`: Defines database models (e.g., `chat.py`, `user.py`).
        - `backend/src/file_converter.py`: Handles file processing for AI analysis.

- **Frontend (React)**:
    - Consumes the backend API.
    - Built with modern React, functional components, and hooks.
    - Uses `shadcn/ui` for UI components and Tailwind CSS for styling.
    - Manages state with React's built-in state management and `localStorage` persistence.
    - Key components:
        - `frontend/src/App.jsx`: Main application component.
        - `frontend/src/main.jsx`: React entry point.
        - `frontend/src/components/`: Contains various UI components (e.g., `ChatTabs.jsx`, `MessageInput.jsx`).
        - `frontend/src/services/api.js`: Handles API integration.

## 2. Project-Specific Conventions and Patterns

- **API Key Management**: API keys for Gemini and OpenRouter are configured via the frontend settings UI and stored client-side. The backend uses these keys for API calls.
- **File Uploads**: Files are uploaded to the `backend/src/uploads/` directory and processed by `backend/src/file_converter.py` before being sent to the AI.
- **Custom Providers**: The application supports adding custom AI providers, which would typically involve creating a new client module similar to `gemini_client.py` or `openrouter_client.py` and integrating it into the backend's AI client selection logic.

## 3. Integration Points and External Dependencies

- **AI Services**: Google Gemini and OpenRouter are the primary external AI dependencies.
- **Database**: SQLite is used for local data storage.
- **Frontend UI**: `shadcn/ui` and Tailwind CSS are used for styling and components.
- **HTTP Communication**: `axios` is used on the frontend for API calls.

## 4. Key Files and Directories

- `backend/src/main.py`: Backend entry point.
- `backend/src/database.py`: Database initialization and session management.
- `backend/src/models/`: Database model definitions.
- `backend/src/routes/`: API endpoint definitions.
- `backend/src/gemini_client.py`: Google Gemini API integration.
- `backend/src/openrouter_client.py`: OpenRouter API integration.
- `backend/src/file_converter.py`: File processing logic.
- `frontend/src/App.jsx`: Main React application component.
- `frontend/src/services/api.js`: Frontend API client.
- `frontend/src/components/`: Reusable React UI components.
- `frontend/vite.config.js`: Frontend build configuration.

Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.