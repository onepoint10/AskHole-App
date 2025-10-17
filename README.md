# AskHole - AI Chat Assistant

A modern, full-stack AI chat application with Flask backend and React frontend. Features include chat history, tab-based sessions, prompt database, and support Gemini, OpenRouter and other OpenAI APIs (as custom providers).

## Features

### Core Features
- **Multi-AI Support**: Integrates with both Google Gemini and OpenRouter APIs
- **Custom Providers Support**: Add your custom providers and models
- **Chat History**: Persistent storage of all chat sessions
- **Tab-based Sessions**: Chrome-style tabs for managing multiple conversations
- **Prompt Database**: Save, organize, and reuse prompt templates
- **Public Prompt Library**: Share prompts, search, like and use prompts by other users
- **Workflow Spaces**: Organize prompts into collaborative workspaces with team management
- **Git Versioning for Prompts**: Full version control with history, diffs, and rollback
- **File Upload**: Support for various file types (PDF, images, text files)
- **Modern UI**: Beautiful, responsive interface with dark/light theme support
- **Syntax Highlighting**: Code blocks with proper syntax highlighting
- **Markdown Rendering**: Full markdown support for AI responses
- **Math Formula Rendering**: Support for inline and display TeX/LaTeX formulas using KaTeX

### Additional Features
- **Settings Management**: Configurable API keys, models, and preferences
- **Temperature Control**: Adjustable creativity/randomness for AI responses
- **Cross-platform**: Web-based interface that works on desktop and mobile
- **Real-time Updates**: Live chat interface with typing indicators
- **File Management**: Upload and manage files for AI analysis

## Architecture

### Backend (Flask)
- **API Layer**: RESTful API endpoints for all functionality
- **Database**: SQLite database for sessions, messages, prompts, and files
- **AI Clients**: Separate client modules for Gemini and OpenRouter
- **File Handling**: Secure file upload and management system
- **CORS Support**: Cross-origin requests enabled for frontend communication

### Frontend (React)
- **Modern React**: Functional components with hooks
- **UI Components**: shadcn/ui component library for consistent design
- **State Management**: React state with localStorage persistence
- **API Integration**: Axios-based API client with error handling
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Code Highlighting**: react-syntax-highlighter for code blocks

## Installation & Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- pnpm (recommended) or npm

### Backend Setup

1. Navigate to the backend directory:
```bash
cd askhole-backend
```

2. Create and activate virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the Flask server:
```bash
python src/main.py
```

The backend will be available at `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd askhole-frontend
```

2. Install dependencies:
```bash
pnpm install  # or npm install
```

3. Start the development server:
```bash
pnpm run dev --host  # or npm run dev -- --host
```

The frontend will be available at `http://localhost:5173`

## Configuration

### API Keys
1. Open the application in your browser
2. Click the Settings icon in the sidebar
3. Navigate to the "API Keys" tab
4. Enter your API keys:
   - **Gemini API Key**: Get from [Google AI Studio](https://aistudio.google.com/)
   - **OpenRouter API Key**: Get from [OpenRouter.ai](https://openrouter.ai/)

### Model Selection
- Choose your preferred default client (Gemini or OpenRouter)
- Select default models for each client
- Adjust temperature settings for response creativity

## Usage

### Basic Chat
1. Ensure API keys are configured
2. Type your message in the input field
3. Press Enter or click Send
4. View AI responses with full markdown and code highlighting

### Math Formulas
- AskHole supports TeX/LaTeX mathematical formulas
- Use `$...$` for inline math: `$x^2 + y^2 = z^2$`
- Use `$$...$$` for display math on separate lines
- See [MATH_FORMULAS.md](MATH_FORMULAS.md) for detailed examples and syntax

### File Upload
1. Click the paperclip icon in the message input
2. Select files (supports PDF, images, text files, code files)
3. Files will be analyzed by the AI along with your message

### Managing Sessions
- **New Session**: Click the "+" button in the tab bar
- **Switch Sessions**: Click on any tab to switch conversations
- **Close Session**: Click the "×" button on a tab (requires multiple sessions)
- **Delete Session**: Use the delete button in the sidebar history

### Prompt Templates
1. Navigate to the "Prompts" tab in the sidebar
2. Click "+" to create a new prompt template
3. Fill in title, category, tags, and content
4. Click on any prompt to use it in the current session
5. Manage prompts with edit and delete options

### Workflow Spaces
Organize your prompts into collaborative workspaces for better project management:

1. **Create a Workspace**:
   - Click the Workflow Spaces toggle button (folder icon) in the header
   - Click "Create New Workspace"
   - Enter name, description, and set visibility (public/private)
   - Click "Create"

2. **Manage Workspace Prompts**:
   - Open a workspace to see the "Prompts" tab
   - Click "Add Prompt" to select prompts to include
   - Drag and drop to reorder prompts
   - Add workspace-specific notes to each prompt
   - Remove prompts when no longer needed

3. **Manage Team Members**:
   - Navigate to the "Members" tab
   - Add members by user ID
   - Assign roles: Owner, Editor, or Viewer
   - Owners: Full control including deletion
   - Editors: Can modify workspace and manage prompts
   - Viewers: Read-only access

4. **Workspace Settings**:
   - Edit workspace name, description, and visibility
   - Delete workspace (owner only)
   - View creation and update timestamps

5. **Features**:
   - Drag-and-drop prompt reordering (@dnd-kit)
   - Role-based access control
   - Search and filter workspaces
   - Responsive sidebar design
   - Dark/light theme support

### Prompt Version Control
AskHole includes full Git-based version control for prompts:

1. **View Version History**:
   - Open any prompt in the dialog
   - Navigate to the "Version History" tab
   - See a timeline of all changes with commit messages
   - Each version shows author, date, and message

2. **View Previous Versions**:
   - Click "View" button on any version
   - See the prompt content at that point in time
   - Toast notification shows the content preview

3. **Compare Versions**:
   - Click "Compare" button on any version
   - View side-by-side or unified diff
   - See line-by-line changes (additions/deletions)
   - Works in both light and dark themes
   - Copy diff to clipboard

4. **Rollback to Previous Version**:
   - Click "Rollback" button on any version
   - Confirm the action
   - Creates a new commit (preserves history)
   - Automatically updates the prompt

5. **Features**:
   - Full UTF-8 support (works with Cyrillic/Russian text)
   - Cross-platform (Windows, macOS, Linux)
   - Responsive design for mobile
   - Theme-aware diff viewer

## File Structure

### Backend (`askhole-backend/`)
```
src/
├── models/
│   ├── user.py          # User model (template)
│   ├── chat.py          # Chat, message, prompt, and file models
│   └── workflow_space.py # Workflow spaces, members, and prompt associations
├── routes/
│   ├── user.py          # User routes (template)
│   ├── auth.py          # Authentication routes
│   ├── admin.py         # Admin dashboard routes
│   ├── chat.py          # Main API routes
│   └── workflow_spaces.py # Workflow spaces API
├── database/
│   └── app.db           # SQLite database
├── uploads/             # File upload directory
├── prompts_repo/        # Git repository for prompt versioning
├── gemini_client.py     # Gemini API client
├── openrouter_client.py # OpenRouter API client
├── custom_client.py     # Custom provider client
├── exa_client.py        # Exa search client
├── git_manager.py       # Git version control manager
├── file_converter.py    # File processing utilities
└── main.py              # Flask application entry point
```

### Frontend (`askhole-frontend/`)
```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── ChatTabs.jsx     # Tab management component
│   ├── MessageList.jsx  # Chat message display
│   ├── MessageInput.jsx # Message input with file upload
│   ├── Sidebar.jsx      # History and prompts sidebar
│   ├── SettingsDialog.jsx # Settings configuration
│   ├── PromptDialog.jsx # Prompt creation/editing with version history
│   ├── VersionHistoryPanel.jsx # Git version history timeline
│   ├── DiffViewerDialog.jsx # Side-by-side diff viewer
│   ├── RollbackConfirmationDialog.jsx # Rollback confirmation
│   ├── WorkflowSpacesSidebar.jsx # Workflow spaces right sidebar
│   ├── WorkspaceList.jsx # Workspace cards display
│   ├── WorkspaceDetail.jsx # Workspace detail view with tabs
│   ├── WorkspacePromptsTab.jsx # Prompts management with drag-and-drop
│   ├── WorkspaceMembersTab.jsx # Member management
│   ├── WorkspaceSettingsTab.jsx # Workspace settings
│   ├── WorkspaceForm.jsx # Create/edit workspace dialog
│   ├── WorkspacePromptSelector.jsx # Prompt selection dialog
│   ├── AdminDashboard.jsx # Admin interface
│   ├── PublicPromptsLibrary.jsx # Shared prompts
│   └── AppTour.jsx      # User onboarding
├── services/
│   └── api.js           # API client and endpoints
├── hooks/
│   ├── useLocalStorage.js # Local storage hook
│   ├── useAuthenticatedImage.js # Image loading with auth
│   └── use-mobile.js    # Mobile detection
├── styles/
│   └── diff-theme.css   # Theme-aware diff viewer styles
├── App.jsx              # Main application component
└── main.jsx             # React entry point
```

## API Endpoints

### Configuration
- `POST /api/config` - Set API keys
- `GET /api/models` - Get available models

### Sessions
- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/{id}` - Get session with messages
- `PUT /api/sessions/{id}` - Update session
- `DELETE /api/sessions/{id}` - Delete session
- `POST /api/sessions/{id}/clear` - Clear session messages
- `POST /api/sessions/{id}/messages` - Send message

### Prompts
- `GET /api/prompts` - List all prompts
- `POST /api/prompts` - Create new prompt
- `PUT /api/prompts/{id}` - Update prompt (creates Git commit)
- `DELETE /api/prompts/{id}` - Delete prompt
- `POST /api/prompts/{id}/use` - Increment usage count
- `GET /api/prompts/{id}/versions` - Get version history
- `GET /api/prompts/{id}/versions/{commit_hash}` - Get specific version content
- `GET /api/prompts/{id}/diff` - Get diff between two versions
- `POST /api/prompts/{id}/rollback` - Rollback to previous version

### Workflow Spaces
**Workspace Management:**
- `GET /api/workflow_spaces` - List user's workspaces
- `POST /api/workflow_spaces` - Create new workspace
- `GET /api/workflow_spaces/{id}` - Get workspace details
- `PUT /api/workflow_spaces/{id}` - Update workspace
- `DELETE /api/workflow_spaces/{id}` - Delete workspace

**Member Management:**
- `GET /api/workflow_spaces/{id}/members` - List workspace members
- `POST /api/workflow_spaces/{id}/members` - Add member to workspace
- `PUT /api/workflow_spaces/{id}/members/{user_id}` - Update member role
- `DELETE /api/workflow_spaces/{id}/members/{user_id}` - Remove member

**Prompt Management:**
- `GET /api/workflow_spaces/{id}/prompts` - List workspace prompts
- `POST /api/workflow_spaces/{id}/prompts` - Add prompt to workspace
- `PUT /api/workflow_spaces/{id}/prompts/{prompt_id}` - Update prompt association
- `DELETE /api/workflow_spaces/{id}/prompts/{prompt_id}` - Remove prompt
- `PUT /api/workflow_spaces/{id}/prompts/reorder` - Reorder prompts
- `GET /api/prompts/{id}/diff?from_commit=X&to_commit=Y` - Get diff between versions
- `POST /api/prompts/{id}/rollback` - Rollback to previous version

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files` - List uploaded files
- `DELETE /api/files/{id}` - Delete file

## Deployment

### Production Build
1. Build the frontend:
```bash
cd askhole-frontend
pnpm run build
```

2. Copy build files to backend static directory:
```bash
cp -r dist/* ../askhole-backend/src/static/
```

3. Use a production WSGI server like Gunicorn:
```bash
cd askhole-backend
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 src.main:app
```

### Environment Variables
Set these environment variables for production:
- `FLASK_ENV=production`
- `SECRET_KEY=your-secret-key`

## Troubleshooting

### Common Issues
1. **API Keys Not Working**: Verify keys are correct and have proper permissions
2. **File Upload Fails**: Check file size limits and supported formats
3. **Database Errors**: Ensure SQLite database is writable
4. **CORS Issues**: Verify CORS is enabled in Flask configuration

### Development Tips
- Use browser developer tools to debug API calls
- Check Flask logs for backend errors
- Verify database schema with SQLite browser
- Test API endpoints directly with curl or Postman

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review API documentation
3. Check browser console for errors
4. Verify backend logs for issues

---

**Note**: This application requires valid API keys from Google Gemini and/or OpenRouter to function. The application will work with either or both services configured.

For all questions please contact: one_point_0@icloud.com

Enjoy using this app! 🚀

