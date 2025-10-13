# AskHole - AI Chat Assistant Codebase Instructions for AI Agents

This document provides essential knowledge for AI coding agents to be immediately productive in the AskHole codebase.

## 1. Big Picture Architecture

AskHole is a full-stack AI chat application with a Flask backend and a React frontend.

- **Backend (Flask)**:
    - Provides a RESTful API running on `http://localhost:5000`.
    - Manages data persistence using SQLite (`backend/src/database/app.db`).
    - Integrates with multiple AI services:
        - Google Gemini via `backend/src/gemini_client.py`
        - OpenRouter via `backend/src/openrouter_client.py`
        - Custom providers via `backend/src/custom_client.py`
        - Exa search integration via `backend/src/exa_client.py`
    - Handles file uploads to `backend/src/uploads/` directory.
    - Supports various file types: PDF, DOCX, PPTX, XLSX, images, audio, and code files.
    - Key components:
        - `backend/src/main.py`: Flask application entry point with CORS configuration.
        - `backend/src/routes/`: Contains API route definitions:
            - `chat.py`: Chat sessions, messages, prompts, files
            - `user.py`: User management (template)
            - `auth.py`: Authentication endpoints
            - `admin.py`: Admin dashboard functionality
        - `backend/src/models/`: Defines database models:
            - `chat.py`: Session, Message, Prompt, File, Like models
            - `user.py`: User model (template)
        - `backend/src/file_converter.py`: Handles file processing for AI analysis.

- **Frontend (React)**:
    - Consumes the backend API from `http://localhost:5173` (dev).
    - Built with modern React 19, functional components, and hooks.
    - Uses `shadcn/ui` for UI components and Tailwind CSS 4 for styling.
    - Uses Vite as the build tool and development server.
    - Manages state with React's built-in state management and `localStorage` persistence.
    - Supports internationalization (i18n) with English, French, and Russian locales.
    - Key components:
        - `frontend/src/App.jsx`: Main application component with routing.
        - `frontend/src/main.jsx`: React entry point with i18n setup.
        - `frontend/src/components/`: Various UI components:
            - `ChatTabs.jsx`: Chrome-style tab management
            - `MessageInput.jsx`: Input with file upload and model selection
            - `MessageList.jsx`: Chat messages with markdown and code highlighting
            - `Sidebar.jsx`: History and prompts sidebar
            - `SettingsDialog.jsx`: API keys, models, and preferences
            - `ModelSelector.jsx`: AI model selection dropdown
            - `PromptCard.jsx`, `PromptDialog.jsx`: Prompt management
            - `PublicPromptsLibrary.jsx`: Shared prompt library
            - `AdminDashboard.jsx`: Admin interface
            - `AppTour.jsx`: User onboarding tour
        - `frontend/src/services/api.js`: Handles API integration with axios.
        - `frontend/src/hooks/`: Custom hooks for localStorage, images, mobile detection, swipe gestures.

## 2. Project-Specific Conventions and Patterns

### Package Management
- **Frontend**: This project uses **npm** for package management (NOT pnpm or yarn).
    - Install dependencies: `npm install`
    - Run dev server: `npm run dev`
    - Build production: `npm run build`
    - Note: The `package.json` may reference pnpm in packageManager field, but **always use npm** for this project.

- **Backend**: Uses pip with virtual environment.
    - Create venv: `python -m venv .venv`
    - Activate: `source .venv/bin/activate` (macOS/Linux)
    - Install: `pip install -r requirements.txt`

### Code Style and Patterns
- **React Components**: Functional components with hooks (no class components).
- **State Management**: React useState/useEffect with custom hooks for localStorage persistence.
- **API Calls**: Centralized in `frontend/src/services/api.js` using axios.
- **Error Handling**: Try-catch blocks with user-friendly error messages.
- **File Structure**: Feature-based organization with separate files for each component.

### API and Data Patterns
- **API Key Management**: API keys configured via frontend settings UI and stored in localStorage. Backend receives keys in request headers for AI API calls.
- **File Uploads**:
    - Files uploaded to `backend/src/uploads/` with UUID prefixes.
    - Processed by `backend/src/file_converter.py` before being sent to AI.
    - Supports PDF, DOCX, PPTX, XLSX, images (PNG, JPG, WEBP), audio, and code files.
- **Custom Providers**:
    - Supports adding custom OpenAI-compatible API providers.
    - Managed through settings UI.
    - Custom client logic in `backend/src/custom_client.py`.
    - See `CUSTOM_PROVIDERS_README.md` for details.
- **Session Management**:
    - Sessions are chat conversations stored in SQLite.
    - Each session has messages, settings (model, temperature), and title.
    - Tab-based UI for managing multiple active sessions.
- **Prompt Library**:
    - Personal prompts: Saved templates for reuse.
    - Public prompts: Shareable prompts with likes and search functionality.

### Special Features
- **Math Rendering**: KaTeX for inline (`$...$`) and display (`$$...$$`) math formulas.
- **Code Highlighting**: react-syntax-highlighter with multiple themes.
- **Markdown**: Full GFM support with breaks, tables, and raw HTML.
- **Internationalization**: i18next with language detection and switching.
- **Theme Support**: Dark/light themes with next-themes.
- **Responsive Design**: Mobile-first with swipe gestures for mobile navigation.

## 3. Integration Points and External Dependencies

### AI Services
- **Google Gemini**: Primary AI service (gemini-2.5-flash-2.0, gemini-2.0-flash-exp, etc.).
- **OpenRouter**: Alternative AI service with multiple models.
- **Custom Providers**: Any OpenAI-compatible API.
- **Exa Search**: Enhanced search capabilities for AI responses.

### Backend Dependencies
- **Flask 3.1**: Web framework.
- **SQLAlchemy 2.0**: ORM for database management.
- **Flask-CORS**: Cross-origin request handling.
- **google-genai**: Google Gemini SDK.
- **openai**: OpenAI SDK (used for OpenRouter and custom providers).
- **librosa, soundfile**: Audio file processing.
- **python-docx, openpyxl, python-pptx, reportlab**: Document processing.
- **Pillow**: Image processing.
- **exa_py**: Exa search integration.

### Frontend Dependencies
- **React 19**: UI framework.
- **Vite 6**: Build tool and dev server.
- **Tailwind CSS 4**: Utility-first CSS framework.
- **shadcn/ui**: Component library based on Radix UI.
- **axios**: HTTP client for API calls.
- **react-markdown**: Markdown rendering with plugins (GFM, math, breaks).
- **rehype-katex, remark-math**: Math formula rendering.
- **react-syntax-highlighter**: Code block syntax highlighting.
- **i18next, react-i18next**: Internationalization.
- **next-themes**: Theme switching.
- **lucide-react**: Icon library.
- **framer-motion**: Animation library.
- **react-joyride**: User onboarding tours.

## 4. Key Files and Directories

### Backend Structure
```
backend/
├── src/
│   ├── main.py                    # Flask app entry point, CORS, routes
│   ├── database.py                # SQLAlchemy setup, session management
│   ├── gemini_client.py           # Google Gemini API client
│   ├── openrouter_client.py       # OpenRouter API client
│   ├── custom_client.py           # Custom provider client
│   ├── exa_client.py              # Exa search client
│   ├── file_converter.py          # File processing (PDF, DOCX, images, audio)
│   ├── models/
│   │   ├── chat.py                # Session, Message, Prompt, File, Like models
│   │   └── user.py                # User model (template)
│   ├── routes/
│   │   ├── chat.py                # Chat API endpoints (sessions, messages, prompts, files)
│   │   ├── user.py                # User API endpoints (template)
│   │   ├── auth.py                # Authentication endpoints
│   │   └── admin.py               # Admin dashboard endpoints
│   ├── database/
│   │   └── app.db                 # SQLite database file
│   ├── uploads/                   # File upload storage
│   └── static/                    # Production build output
├── requirements.txt               # Python dependencies
├── migrate_database.py            # Database migration script
└── tests/                         # Backend tests
```

### Frontend Structure
```
frontend/
├── src/
│   ├── main.jsx                   # React entry point, i18n setup
│   ├── App.jsx                    # Main app component, routing
│   ├── App.css                    # Global styles
│   ├── index.css                  # Tailwind directives
│   ├── i18n.js                    # i18next configuration
│   ├── components/
│   │   ├── ChatTabs.jsx           # Tab management
│   │   ├── MessageList.jsx        # Message display with markdown
│   │   ├── MessageInput.jsx       # Input with file upload
│   │   ├── Sidebar.jsx            # History and prompts
│   │   ├── SettingsDialog.jsx     # Settings and configuration
│   │   ├── ModelSelector.jsx      # Model selection dropdown
│   │   ├── PromptCard.jsx         # Prompt display
│   │   ├── PromptDialog.jsx       # Prompt editing
│   │   ├── PublicPromptsLibrary.jsx # Shared prompts
│   │   ├── AdminDashboard.jsx     # Admin interface
│   │   ├── AppTour.jsx            # Onboarding tour
│   │   ├── AddModelDialog.jsx     # Add custom model
│   │   ├── AddProviderDialog.jsx  # Add custom provider
│   │   ├── ExaSettings.jsx        # Exa search settings
│   │   ├── ErrorBoundary.jsx      # Error handling
│   │   └── ui/                    # shadcn/ui components
│   ├── services/
│   │   └── api.js                 # API client, axios config
│   ├── hooks/
│   │   ├── useLocalStorage.js     # localStorage persistence
│   │   ├── useAuthenticatedImage.js # Image loading with auth
│   │   ├── use-mobile.js          # Mobile detection
│   │   └── useSwipeGesture.js     # Swipe gesture handling
│   ├── lib/
│   │   └── utils.js               # Utility functions (cn, etc.)
│   └── locales/
│       ├── en/                    # English translations
│       ├── fr/                    # French translations
│       └── ru/                    # Russian translations
├── public/                        # Static assets
├── vite.config.js                 # Vite configuration
├── package.json                   # npm dependencies and scripts
├── components.json                # shadcn/ui config
└── jsconfig.json                  # JavaScript config for imports
```

### Root Files
- `README.md`: Main project documentation
- `CUSTOM_PROVIDERS_README.md`: Custom provider feature documentation
- `LICENSE`: MIT license
- `package.json`: Root-level i18n dependencies
- `review.md`: Code review notes

## 5. Development Workflow

### Starting the Application
1. **Backend**:
   ```bash
   cd backend
   source .venv/bin/activate  # or .venv\Scripts\activate on Windows
   python src/main.py
   ```
   Runs on `http://localhost:5000`

2. **Frontend**:
   ```bash
   cd frontend
   npm install  # if first time
   npm run dev
   ```
   Runs on `http://localhost:5173`

### Making Changes
1. **Backend Changes**: Edit Python files in `backend/src/`. Flask auto-reloads in development.
2. **Frontend Changes**: Edit JSX files in `frontend/src/`. Vite hot-reloads automatically.
3. **Database Changes**:
   - Modify models in `backend/src/models/`
   - Use `migrate_database.py` for schema migrations
4. **New API Endpoints**:
   - Add route functions in `backend/src/routes/`
   - Register blueprint in `backend/src/main.py`
   - Add client methods in `frontend/src/services/api.js`

### Testing
- **Backend**: Test files in `backend/tests/`
- **Frontend**: No formal test suite currently
- **Manual Testing**: Use browser DevTools and Flask logs

## 6. AI Agent Guidelines

### When to Use Context7
Always use Context7 MCP tools to resolve library IDs and get library docs when:
- Generating code that uses external libraries
- Setting up or configuring frameworks
- Looking up API documentation
- Understanding library-specific patterns
- Troubleshooting library-related issues

**Do NOT** ask the user to explicitly request Context7 - use it automatically when needed.

### Code Generation Best Practices
1. **Follow existing patterns**: Match the style and structure of existing code.
2. **Use functional components**: No class components in React code.
3. **Proper imports**: Use existing import patterns from the codebase.
4. **Error handling**: Always include try-catch blocks for async operations.
5. **Type safety**: Use JSDoc comments for complex functions.
6. **Accessibility**: Include ARIA labels and semantic HTML.
7. **Responsive design**: Use Tailwind breakpoints (sm:, md:, lg:, xl:).
8. **Internationalization**: Use i18next for user-facing strings when adding new features.

### Common Tasks
- **Add new component**: Create in `frontend/src/components/`, follow naming conventions.
- **Add new API endpoint**: Backend route + frontend api.js method + update types.
- **Add new model**: Database model + migration + API endpoints + frontend integration.
- **Fix bugs**: Check browser console, Flask logs, and database state.
- **Add AI provider**: Create client module, update route logic, add to settings UI.

### Important Notes
- **Package Manager**: Always use `npm` for frontend, never pnpm or yarn.
- **Python Version**: Requires Python 3.11+
- **Node Version**: Requires Node.js 20+
- **Database**: SQLite - check `backend/src/database/app.db` for data inspection.
- **CORS**: Backend has CORS enabled for frontend origin.
- **File Size Limits**: Check backend configuration for upload limits.
- **API Keys**: Never hardcode - always use settings UI and localStorage.