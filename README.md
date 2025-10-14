# AskHole - AI Chat Assistant

A modern, full-stack AI chat application with Flask backend and React frontend. Features include chat history, tab-based sessions, prompt database, and support Gemini, OpenRouter and other OpenAI APIs (as custom providers).

## Features

### Core Features
- **Multi-AI Support**: Integrates with both Google Gemini and OpenRouter APIs
- **Custom Providers Support**: Add your custom providers and models
- **Chat History**: Persistent storage of all chat sessions
- **Tab-based Sessions**: Chrome-style tabs for managing multiple conversations
- **Prompt Database**: Save, organize, and reuse prompt templates
- **Public Prompt Library**: Share prompt, search, like and use prompt by other users
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
- **Workflow Spaces**: Organize prompts into projects/workspaces with team collaboration
- **Git-style Versioning**: Version control for prompt templates with commit history
- **DFG (Directed Flow Graph)**: Build and execute complex prompt workflows

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

## File Structure

### Backend (`askhole-backend/`)
```
src/
├── models/
│   ├── user.py          # User model (template)
│   └── chat.py          # Chat, message, prompt, and file models
├── routes/
│   ├── user.py          # User routes (template)
│   └── chat.py          # Main API routes
├── database/
│   └── app.db           # SQLite database
├── uploads/             # File upload directory
├── gemini_client.py     # Gemini API client
├── openrouter_client.py # OpenRouter API client
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
│   └── SettingsDialog.jsx # Settings configuration
├── services/
│   └── api.js           # API client and endpoints
├── hooks/
│   └── useLocalStorage.js # Local storage hook
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
- `PUT /api/prompts/{id}` - Update prompt
- `DELETE /api/prompts/{id}` - Delete prompt
- `POST /api/prompts/{id}/use` - Increment usage count

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

### Workflow Features
For details on Workflow Spaces, Git versioning, and DFG execution features, see [WORKFLOW_FEATURES.md](WORKFLOW_FEATURES.md).

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

