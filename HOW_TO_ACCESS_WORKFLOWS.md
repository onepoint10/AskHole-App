# How to Access Workflow Features

## Current Status

✅ **Backend**: Fully implemented and ready  
✅ **Frontend Components**: Created but not integrated into UI  
❌ **UI Integration**: Components need to be added to the interface

## Quick Guide: Where to Find Features

The workflow features exist as **standalone components** that are ready to use, but they're not yet added to the main application navigation.

### Option 1: Access via Browser Console (Quick Test)

1. Start the backend and frontend:
   ```bash
   # Terminal 1 - Backend
   cd backend
   source ../.venv/bin/activate
   python src/main.py
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

2. Open browser console (F12) and run:
   ```javascript
   // Import the component
   import('/src/components/WorkflowSpaces.jsx').then(module => {
     console.log('WorkflowSpaces component:', module.default);
   });
   ```

### Option 2: Add to Sidebar (Recommended)

Edit `frontend/src/components/Sidebar.jsx` and add a new tab:

```jsx
// 1. Import at the top
import WorkflowSpaces from './WorkflowSpaces';
import { Folder } from 'lucide-react'; // Add icon

// 2. Add tab button (around line 100-150 where other tabs are)
<Button
  variant={activeTab === 'workflows' ? 'default' : 'ghost'}
  size="sm"
  onClick={() => setActiveTab('workflows')}
  className="w-full justify-start"
>
  <Folder className="h-4 w-4 mr-2" />
  Workflows
</Button>

// 3. Add tab content (where other tab contents are rendered)
{activeTab === 'workflows' && (
  <WorkflowSpaces />
)}
```

### Option 3: Add to Settings Dialog

Edit `frontend/src/components/SettingsDialog.jsx`:

```jsx
// 1. Import at the top
import WorkflowSpaces from './WorkflowSpaces';

// 2. Add a new tab
<TabsTrigger value="workflows">Workflows</TabsTrigger>

// 3. Add tab content
<TabsContent value="workflows">
  <WorkflowSpaces />
</TabsContent>
```

### Option 4: Add Top-Level Button (Easiest for Testing)

Edit `frontend/src/App.jsx`:

```jsx
// 1. Import at the top (around line 10)
import WorkflowSpaces from './components/WorkflowSpaces';
import { Folder } from 'lucide-react';

// 2. Add state for dialog
const [showWorkflows, setShowWorkflows] = useState(false);

// 3. Add button in the header (look for the header section with Settings button)
<Button
  variant="ghost"
  size="sm"
  onClick={() => setShowWorkflows(true)}
>
  <Folder className="h-4 w-4 mr-2" />
  Workflows
</Button>

// 4. Add dialog at the end of the component (before the closing </div>)
{showWorkflows && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
    <div className="bg-background rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Workflow Spaces</h2>
        <Button onClick={() => setShowWorkflows(false)}>Close</Button>
      </div>
      <WorkflowSpaces />
    </div>
  </div>
)}
```

## Testing the API Directly

You can also test the backend API directly without the UI:

### Create a Workspace
```bash
curl -X POST http://localhost:5000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -d '{"name": "My First Workspace", "description": "Test workspace", "is_public": false}'
```

### List Workspaces
```bash
curl http://localhost:5000/api/workspaces \
  -H "Authorization: Bearer YOUR_SESSION_ID"
```

### Get Your Session ID
1. Log in to the app
2. Open browser console (F12)
3. Type: `localStorage.getItem('session_id')`
4. Copy the value and use it in the curl commands above

## What Features Are Available?

### 1. Workflow Spaces (WorkflowSpaces.jsx)
- Create project workspaces
- Manage team members
- Organize prompts
- Public/private workspaces

### 2. Workflow Builder (WorkflowBuilder.jsx)
- Visual workflow editor
- Add/remove nodes
- Connect prompts in sequences
- Execute workflows

### 3. Prompt Version History (PromptVersionHistory.jsx)
- View all versions of a prompt
- Create version snapshots with commit messages
- Restore previous versions
- Git-style version control

## Database Tables

The workflow features use these tables (created automatically):
- `workflow_spaces` - Workspace definitions
- `workflow_space_members` - Team membership
- `workflow_prompt_associations` - Prompts in workspaces
- `prompt_versions` - Version history
- `workflows` - Workflow definitions
- `workflow_nodes` - Workflow graph nodes
- `workflow_edges` - Connections between nodes
- `workflow_executions` - Execution history

## Need Help?

If you can't see the features:
1. Make sure backend is running on port 5000
2. Make sure frontend is running on port 5173
3. Check browser console for errors
4. Verify you're logged in (session_id exists in localStorage)

## Architecture

```
Frontend                Backend              Database
┌──────────────┐       ┌──────────────┐    ┌──────────────┐
│ WorkflowSpaces│──────→│ /api/workspaces  │────→ workflow_
│              │       │              │    │    spaces
│              │       │ workflow.py  │    │
│ WorkflowBuilder──────→│ route        │────→ workflows
│              │       │              │    │  nodes, edges
│              │       │              │    │
│ PromptVersion│──────→│ /api/prompts/│────→ prompt_
│   History    │       │    versions  │    │  versions
└──────────────┘       └──────────────┘    └──────────────┘
```

## What's NOT Yet Implemented

The GitHub agent created the structure but these don't work yet:
- ❌ Actual workflow execution (endpoint exists but doesn't run workflows)
- ❌ Real-time updates between users
- ❌ Advanced DFG visualization (just basic list view)
- ❌ Git integration (uses database instead of actual Git)

The components are ready to use for managing workspaces and viewing/organizing prompts, but the execution engine needs to be built.
