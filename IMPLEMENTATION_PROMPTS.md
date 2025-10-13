# Workflow Spaces & Git Versioning - Implementation Prompts

This document contains a series of prompts to implement the Workflow Spaces, Git Versioning, and DFG features for AskHole. Each prompt is designed to be used in a new context window and includes complete context.

---

## 📋 Prompt 1: Database Models & Migration for Workflow Spaces

### Context
**Project**: AskHole - AI Chat Assistant with Flask backend and React frontend
**Current State**: Application has `PromptTemplate`, `ChatSession`, `ChatMessage`, `User`, `FileUpload`, and `PromptLike` models in SQLite database
**Goal**: Add database models for "Workflow Spaces" feature - a project management system that allows users to organize prompts into collaborative workspaces

### Task
Create the following database models in `backend/src/models/` and implement migration:

1. **WorkflowSpace Model** (`backend/src/models/workflow_space.py`):
   - `id` (Integer, Primary Key)
   - `name` (String(200), required)
   - `description` (Text, optional)
   - `owner_id` (Integer, Foreign Key to users.id)
   - `is_public` (Boolean, default False)
   - `prompt_sequence` (Text, JSON array of prompt IDs for DFG execution)
   - `created_at` (DateTime)
   - `updated_at` (DateTime)
   - `to_dict()` method

2. **WorkflowSpaceMember Model** (same file):
   - `id` (Integer, Primary Key)
   - `workflow_space_id` (Integer, Foreign Key)
   - `user_id` (Integer, Foreign Key to users.id)
   - `role` (String(20), default='member') - values: 'owner', 'editor', 'viewer'
   - `created_at` (DateTime)
   - Unique constraint on (workflow_space_id, user_id)
   - `to_dict()` method

3. **WorkflowPromptAssociation Model** (same file):
   - `id` (Integer, Primary Key)
   - `workflow_space_id` (Integer, Foreign Key)
   - `prompt_id` (Integer, Foreign Key to prompt_templates.id)
   - `notes` (Text, optional - workflow-specific notes about the prompt)
   - `order_index` (Integer, default 0 - for ordering prompts)
   - `added_at` (DateTime)
   - `added_by` (Integer, Foreign Key to users.id)
   - Unique constraint on (workflow_space_id, prompt_id)
   - `to_dict()` method

4. **Create migration script** (`backend/migrate_workflow_spaces.py`):
   - Check if tables exist
   - Create tables if they don't exist
   - Preserve existing data
   - Log migration steps

5. **Update imports** in `backend/src/models/__init__.py` to include new models

### Technical Requirements
- Follow existing patterns from `backend/src/models/chat.py`
- Use SQLAlchemy 2.0 syntax
- Include proper relationships (backref where appropriate)
- Add proper indexes for foreign keys
- All datetime fields should default to `datetime.utcnow`
- Include docstrings for each model

### Files to Reference
- `backend/src/models/chat.py` - existing model patterns
- `backend/src/database.py` - database setup
- `backend/migrate_database.py` - existing migration pattern

### Acceptance Criteria
- [ ] All three models created with proper fields and relationships
- [ ] Migration script runs successfully
- [ ] Models can be imported and used in routes
- [ ] No breaking changes to existing models

---

## 📋 Prompt 2: Workflow Spaces REST API (Backend)

### Context
**Project**: AskHole - AI Chat Assistant with Flask backend and React frontend
**Previous Step**: Database models for WorkflowSpace, WorkflowSpaceMember, and WorkflowPromptAssociation have been created
**Current State**: Backend has REST API routes in `backend/src/routes/chat.py` for sessions, messages, prompts, and files
**Goal**: Implement complete REST API for Workflow Spaces with proper authentication and authorization

### Task
Create a new route file `backend/src/routes/workflow_spaces.py` with the following endpoints:

#### Workspace Management
1. **GET /api/workflow_spaces** - List user's workspaces
   - Return workspaces where user is owner or member
   - Include member count and prompt count
   - Support pagination (optional)

2. **POST /api/workflow_spaces** - Create workspace
   - Body: `{name, description, is_public}`
   - Auto-add creator as owner in WorkflowSpaceMember
   - Return created workspace with full details

3. **GET /api/workflow_spaces/{id}** - Get workspace details
   - Check user has access (owner, member, or is_public)
   - Include full member list and associated prompts
   - Return 404 if not found, 403 if no access

4. **PUT /api/workflow_spaces/{id}** - Update workspace
   - Body: `{name?, description?, is_public?}`
   - Only owner or editors can update
   - Return updated workspace

5. **DELETE /api/workflow_spaces/{id}** - Delete workspace
   - Only owner can delete
   - Cascade delete members and associations
   - Return success message

#### Member Management
6. **GET /api/workflow_spaces/{id}/members** - List members
   - Include user details (username, role)
   - Check user has access to workspace

7. **POST /api/workflow_spaces/{id}/members** - Add member
   - Body: `{user_id, role}`
   - Only owner can add members
   - Validate user exists and isn't already a member

8. **PUT /api/workflow_spaces/{id}/members/{user_id}** - Update member role
   - Body: `{role}`
   - Only owner can change roles
   - Cannot change owner's role

9. **DELETE /api/workflow_spaces/{id}/members/{user_id}** - Remove member
   - Only owner can remove members
   - Cannot remove owner

#### Prompt Management
10. **GET /api/workflow_spaces/{id}/prompts** - List workspace prompts
    - Return prompts with association metadata (notes, order_index)
    - Ordered by order_index

11. **POST /api/workflow_spaces/{id}/prompts** - Add prompt to workspace
    - Body: `{prompt_id, notes?, order_index?}`
    - Check prompt exists and user has access
    - Check user is owner or editor

12. **PUT /api/workflow_spaces/{id}/prompts/{prompt_id}** - Update prompt association
    - Body: `{notes?, order_index?}`
    - Update association metadata

13. **DELETE /api/workflow_spaces/{id}/prompts/{prompt_id}** - Remove prompt
    - Only owner or editor can remove

14. **PUT /api/workflow_spaces/{id}/prompts/reorder** - Reorder prompts
    - Body: `{prompt_ids: [id1, id2, id3]}` - ordered array
    - Update order_index for all associations
    - For DFG sequence management

### Technical Requirements
- Use Blueprint pattern like existing `chat_bp`
- All endpoints require authentication via `get_current_user()`
- Implement helper function `check_workspace_access(workspace_id, user_id, required_role='viewer')` for authorization
- Use proper HTTP status codes (200, 201, 400, 403, 404, 500)
- Include error handling with try-catch blocks
- Add logging for important operations
- Follow patterns from `backend/src/routes/chat.py`

### Register Blueprint
Update `backend/src/main.py` to register the new blueprint:
```python
from src.routes.workflow_spaces import workflow_spaces_bp
app.register_blueprint(workflow_spaces_bp, url_prefix='/api/workflow_spaces')
```

### Files to Reference
- `backend/src/routes/chat.py` - existing route patterns
- `backend/src/routes/auth.py` - authentication patterns
- `backend/src/models/workflow_space.py` - the models you created

### Acceptance Criteria
- [ ] All 14 endpoints implemented with proper logic
- [ ] Authorization checks on all endpoints
- [ ] Error handling with appropriate status codes
- [ ] Blueprint registered in main.py
- [ ] Can test all CRUD operations via Postman/curl

---

## 📋 Prompt 3: Workflow Spaces Frontend UI (React Components)

### Context
**Project**: AskHole - AI Chat Assistant with React 19 frontend using shadcn/ui and Tailwind CSS
**Previous Steps**: Backend models and REST API for Workflow Spaces are complete
**Current State**: Frontend has Sidebar (history/prompts), ChatTabs, SettingsDialog, and PromptDialog components
**Goal**: Create a new right sidebar for managing Workflow Spaces with complete UI

### Task
Create the following React components for Workflow Spaces:

#### 1. Main Component: `frontend/src/components/WorkflowSpacesSidebar.jsx`
**Purpose**: Right sidebar that slides in from the right, similar to existing Sidebar but for workspaces

**Features**:
- Toggle button in top-right corner of main app (icon: Folders or LayoutGrid)
- Slide-in animation (use Framer Motion or CSS transitions)
- Three main views: List, Detail, Create/Edit
- Responsive: drawer on mobile, sidebar on desktop
- Dark/light theme support

**State Management**:
- `activeView` - 'list' | 'detail' | 'create' | 'edit'
- `selectedWorkspace` - current workspace object
- `workspaces` - array of user's workspaces
- `isOpen` - sidebar visibility

**Structure**:
```jsx
<Sheet> {/* or custom sidebar component */}
  <SheetContent side="right" className="w-[400px]">
    {activeView === 'list' && <WorkspaceList />}
    {activeView === 'detail' && <WorkspaceDetail />}
    {activeView === 'create' && <WorkspaceForm mode="create" />}
    {activeView === 'edit' && <WorkspaceForm mode="edit" />}
  </SheetContent>
</Sheet>
```

#### 2. `WorkspaceList.jsx` (sub-component)
**Features**:
- Display user's workspaces as cards
- Search/filter functionality
- "Create New Workspace" button
- Show workspace name, description (truncated), prompt count, member count
- Click to view details
- Sort by: recent, name, prompt count

#### 3. `WorkspaceDetail.jsx` (sub-component)
**Features**:
- Display workspace header (name, description, owner, visibility)
- Tabs: "Prompts", "Members", "Settings"
- **Prompts Tab**:
  - List of prompts with drag-and-drop reordering (use @dnd-kit/core)
  - "Add Prompt" button (opens prompt selection dialog)
  - Each prompt shows: title, notes field (inline edit), remove button
  - "Run Workflow" button at bottom (for DFG execution)
- **Members Tab**:
  - List of members with role badges
  - "Add Member" button (only for owner)
  - Role dropdown for each member (only owner can change)
  - Remove member button
- **Settings Tab**:
  - Edit workspace name, description, is_public
  - Delete workspace button (only owner, with confirmation)

#### 4. `WorkspaceForm.jsx` (dialog component)
**Purpose**: Create/edit workspace

**Fields**:
- Name (required)
- Description (textarea)
- Is Public (checkbox)

**Modes**: 'create' | 'edit'

**Actions**: Save, Cancel

#### 5. `WorkspacePromptSelector.jsx` (dialog component)
**Purpose**: Select prompts to add to workspace

**Features**:
- Display user's prompts in a grid
- Search functionality
- Multi-select (checkbox)
- Filter by category
- "Add Selected" button

#### 6. `WorkflowExecutionDialog.jsx` (dialog component)
**Purpose**: Execute prompt sequence (DFG)

**Features**:
- Show prompt sequence as steps
- Execute button
- Progress indicator showing current step
- Display results for each step
- Error handling with retry option
- Copy results button

### API Integration
Create or update `frontend/src/services/api.js` to add:

```javascript
export const workflowSpacesAPI = {
  getWorkspaces: () => api.get('/workflow_spaces'),
  getWorkspace: (id) => api.get(`/workflow_spaces/${id}`),
  createWorkspace: (data) => api.post('/workflow_spaces', data),
  updateWorkspace: (id, data) => api.put(`/workflow_spaces/${id}`, data),
  deleteWorkspace: (id) => api.delete(`/workflow_spaces/${id}`),

  getMembers: (id) => api.get(`/workflow_spaces/${id}/members`),
  addMember: (id, data) => api.post(`/workflow_spaces/${id}/members`, data),
  updateMemberRole: (id, userId, data) => api.put(`/workflow_spaces/${id}/members/${userId}`, data),
  removeMember: (id, userId) => api.delete(`/workflow_spaces/${id}/members/${userId}`),

  getPrompts: (id) => api.get(`/workflow_spaces/${id}/prompts`),
  addPrompt: (id, data) => api.post(`/workflow_spaces/${id}/prompts`, data),
  updatePromptAssociation: (id, promptId, data) => api.put(`/workflow_spaces/${id}/prompts/${promptId}`, data),
  removePrompt: (id, promptId) => api.delete(`/workflow_spaces/${id}/prompts/${promptId}`),
  reorderPrompts: (id, promptIds) => api.put(`/workflow_spaces/${id}/prompts/reorder`, { prompt_ids: promptIds }),

  runWorkflow: (id) => api.post(`/workflow_spaces/${id}/run_sequence`),
};
```

### Integration with Main App
Update `frontend/src/App.jsx`:
- Add toggle button in header/toolbar
- Import and render WorkflowSpacesSidebar
- Manage sidebar open/close state

### Technical Requirements
- Use shadcn/ui components (Sheet, Dialog, Card, Button, Badge, Tabs)
- Use Framer Motion for animations
- Implement drag-and-drop with @dnd-kit/core
- Add loading states for all async operations
- Include error handling and user feedback (toast notifications)
- Follow existing component patterns from Sidebar.jsx and PromptDialog.jsx
- Support i18n (use react-i18next for strings)
- Responsive design with mobile-first approach

### Files to Reference
- `frontend/src/components/Sidebar.jsx` - sidebar pattern
- `frontend/src/components/PromptDialog.jsx` - form pattern
- `frontend/src/components/SettingsDialog.jsx` - dialog pattern
- `frontend/src/App.jsx` - app structure
- `frontend/src/services/api.js` - API client

### Acceptance Criteria
- [ ] Right sidebar toggles open/closed smoothly
- [ ] Can create, view, edit, and delete workspaces
- [ ] Can add/remove prompts to/from workspaces
- [ ] Drag-and-drop reordering works
- [ ] Member management works (if you have multiple users to test)
- [ ] All UI is responsive and themed correctly
- [ ] No console errors

---

## 📋 Prompt 4: Git Versioning for Prompts - Backend Infrastructure

### Context
**Project**: AskHole - AI Chat Assistant with Flask backend
**Previous Steps**: Workflow Spaces feature is complete with UI and API
**Current State**: Prompts are stored in database with `content` field as TEXT. The `PromptTemplate` model has: id, user_id, title, content, category, tags, usage_count, is_public, likes_count, created_at, updated_at
**Goal**: Migrate prompt storage from database TEXT field to individual files in a Git repository with full version control

### Architecture Decision Needed First
Before implementation, clarify with user:
1. **Repository structure**: Single repo at `/backend/src/prompts_repo/` with structure:
   - `/prompts_repo/users/{user_id}/{prompt_id}.md` OR
   - `/prompts_repo/prompts/{prompt_id}.md` with user_id in commit metadata?

2. **Commit messages**: Auto-generated (`"Updated prompt #{id}"`) or user-provided?

3. **Database field**: Keep `content` field synced (redundant) or replace with `file_path`?

**Recommended**: Single repo, user-provided commit messages, replace `content` with `file_path`

### Task
Implement Git versioning for prompts:

#### 1. Install and Configure GitPython
```bash
# In backend directory
pip install GitPython
# Update requirements.txt
```

#### 2. Create Git Repository Manager: `backend/src/git_manager.py`
**Purpose**: Centralized Git operations for prompts

**Key Methods**:
```python
class PromptGitManager:
    def __init__(self, repo_path='/backend/src/prompts_repo'):
        # Initialize or open Git repo
        # Create repo if doesn't exist

    def save_prompt(self, prompt_id, content, commit_message, author_name, author_email):
        # Save content to file: prompts/{prompt_id}.md
        # Git add
        # Git commit with author info
        # Return commit hash

    def get_prompt_content(self, prompt_id, commit_hash=None):
        # Read file at specific commit (or HEAD if None)
        # Return content string

    def get_version_history(self, prompt_id):
        # Git log for specific file
        # Return list of commits: [{hash, author, date, message}, ...]

    def get_diff(self, prompt_id, from_commit, to_commit):
        # Git diff between two commits for file
        # Return diff string

    def rollback_prompt(self, prompt_id, target_commit, commit_message, author_name, author_email):
        # Checkout file from target_commit
        # Create new commit (don't actually rewind history)
        # Return new commit hash

    def delete_prompt_file(self, prompt_id):
        # Remove file and commit deletion
```

**Error Handling**:
- Handle repository not initialized
- Handle merge conflicts (shouldn't happen with single-file edits)
- Handle file not found
- Handle invalid commit hashes

#### 3. Update PromptTemplate Model: `backend/src/models/chat.py`
**Changes**:
```python
class PromptTemplate(db.Model):
    # ... existing fields ...

    # REPLACE:
    # content = db.Column(db.Text, nullable=False)

    # WITH:
    file_path = db.Column(db.String(500), nullable=True)  # Relative path in Git repo
    current_commit = db.Column(db.String(40), nullable=True)  # Current Git commit hash

    def to_dict(self):
        # Add current_commit to dict
        # Don't include file_path (internal)
```

#### 4. Create Migration Script: `backend/migrate_prompts_to_git.py`
**Purpose**: One-time migration of existing prompts to Git

**Steps**:
1. Initialize Git repo if doesn't exist
2. For each existing prompt in database:
   - Create file: `prompts/{prompt_id}.md` with content
   - Git add and commit with message: `"Initial commit for prompt #{id}: {title}"`
   - Update database: set `file_path` and `current_commit`
3. Log progress and errors
4. Create backup of database before migration

#### 5. Update Prompt Routes: `backend/src/routes/chat.py`
Modify these endpoints:

**POST /api/prompts** (create):
```python
# Get commit_message from request body (optional, default: "Created prompt")
# Call git_manager.save_prompt(content, message, user.username, user.email)
# Save PromptTemplate with file_path and current_commit
```

**PUT /api/prompts/{id}** (update):
```python
# Get commit_message from request body (optional, default: "Updated prompt")
# Call git_manager.save_prompt()
# Update current_commit in database
```

**GET /api/prompts/{id}** (read):
```python
# Get content from git_manager.get_prompt_content(id, commit_hash=None)
# Return in to_dict() response
```

**DELETE /api/prompts/{id}**:
```python
# Call git_manager.delete_prompt_file()
# Delete from database
```

#### 6. Add New Version Control Endpoints: `backend/src/routes/chat.py`

**GET /api/prompts/{id}/versions**:
```python
# Return git_manager.get_version_history(id)
# Format: [{commit_hash, author, date, message}, ...]
```

**GET /api/prompts/{id}/versions/{commit_hash}**:
```python
# Return git_manager.get_prompt_content(id, commit_hash)
# Return specific version content
```

**GET /api/prompts/{id}/diff**:
```python
# Query params: from_commit, to_commit
# Return git_manager.get_diff(id, from_commit, to_commit)
```

**POST /api/prompts/{id}/rollback**:
```python
# Body: {target_commit, commit_message}
# Call git_manager.rollback_prompt()
# Update current_commit in database
# Return updated prompt
```

### Technical Requirements
- Use GitPython 3.1+ library
- Git author info: use user's username and a default email (e.g., `{username}@askhole.local`)
- File format: Markdown (.md) for prompts
- Repository location: `backend/src/prompts_repo/` (add to .gitignore of main repo!)
- Handle Git errors gracefully with try-except blocks
- Add comprehensive logging
- Ensure atomic operations: if Git fails, rollback database changes
- Add file locking if needed (use `fcntl` on Unix, `msvcrt` on Windows)

### Files to Reference
- `backend/src/models/chat.py` - PromptTemplate model
- `backend/src/routes/chat.py` - existing prompt routes
- `backend/src/database.py` - database patterns

### Testing Checklist
- [ ] Git repo initializes correctly
- [ ] Creating prompt creates file and commits
- [ ] Updating prompt creates new commit
- [ ] Can retrieve version history
- [ ] Can view specific version content
- [ ] Diff between versions works
- [ ] Rollback creates new commit without breaking history
- [ ] Migration script works on test data
- [ ] Handle edge cases (empty content, special characters in filenames)

### Important Notes
⚠️ **Before running migration**: Backup database!
⚠️ **Add to .gitignore**: `backend/src/prompts_repo/`
⚠️ **Git repo initialization**: Should happen automatically on first use or in migration script

---

## 📋 Prompt 5: Git Versioning UI - Version History & Diff Viewer (Frontend)

### Context
**Project**: AskHole - AI Chat Assistant with React 19 frontend
**Previous Steps**: Backend now stores prompts in Git repo with full versioning API
**Current State**: PromptDialog.jsx shows prompt details but no version history. PromptCard.jsx displays prompts
**Goal**: Add version history, diff viewer, and rollback functionality to prompt UI

### Task
Enhance prompt components with version control features:

#### 1. Install Required Libraries
```bash
cd frontend
npm install react-diff-view diff
npm install date-fns  # For date formatting if not already installed
```

#### 2. Update `frontend/src/services/api.js`
Add to `promptsAPI` object:
```javascript
export const promptsAPI = {
  // ... existing methods ...

  // Version control methods
  getVersionHistory: (id) => api.get(`/prompts/${id}/versions`),
  getVersionContent: (id, commitHash) => api.get(`/prompts/${id}/versions/${commitHash}`),
  getDiff: (id, fromCommit, toCommit) => api.get(`/prompts/${id}/diff`, {
    params: { from_commit: fromCommit, to_commit: toCommit }
  }),
  rollbackPrompt: (id, targetCommit, commitMessage) => api.post(`/prompts/${id}/rollback`, {
    target_commit: targetCommit,
    commit_message: commitMessage
  }),
};
```

#### 3. Create `VersionHistoryPanel.jsx` Component
**Location**: `frontend/src/components/VersionHistoryPanel.jsx`

**Purpose**: Display version history timeline for a prompt

**Props**:
- `promptId` - the prompt ID
- `currentCommit` - current commit hash
- `onVersionSelect` - callback when user wants to view/compare a version

**Features**:
- Fetch and display commit history
- Timeline-style layout with:
  - Commit hash (short, first 7 chars)
  - Author name
  - Commit date (formatted: "2 days ago" or "Jan 15, 2025")
  - Commit message
  - "Current" badge on active version
- Actions per commit:
  - "View" button - shows content at that version
  - "Compare with current" button - opens diff viewer
  - "Rollback to this version" button - with confirmation
- Loading state while fetching
- Empty state if no history

**UI Structure**:
```jsx
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Version History</h3>
  <ScrollArea className="h-[400px]">
    {versions.map(version => (
      <div key={version.commit_hash} className="border-l-2 pl-4 pb-4">
        {/* Timeline dot */}
        <div className="flex items-start gap-3">
          <Badge variant={version.is_current ? "default" : "outline"}>
            {version.commit_hash.substring(0, 7)}
          </Badge>
          <div className="flex-1">
            <p className="font-medium">{version.message}</p>
            <p className="text-sm text-muted-foreground">
              by {version.author} • {formatDate(version.date)}
            </p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="ghost" onClick={() => onViewVersion(version)}>
                <Eye className="h-4 w-4 mr-1" /> View
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onCompare(version)}>
                <GitCompare className="h-4 w-4 mr-1" /> Compare
              </Button>
              {!version.is_current && (
                <Button size="sm" variant="ghost" onClick={() => onRollback(version)}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Rollback
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    ))}
  </ScrollArea>
</div>
```

#### 4. Create `DiffViewerDialog.jsx` Component
**Location**: `frontend/src/components/DiffViewerDialog.jsx`

**Purpose**: Display side-by-side diff between two prompt versions

**Props**:
- `promptId`
- `fromCommit` - { hash, content, date, author }
- `toCommit` - { hash, content, date, author }
- `isOpen`
- `onClose`

**Features**:
- Fetch diff from API
- Display using `react-diff-view`:
  - Side-by-side view (split view)
  - Unified view (toggle option)
  - Syntax highlighting for markdown
  - Line numbers
- Header showing: "Comparing {fromCommit.hash} → {toCommit.hash}"
- Stats: lines added, lines removed
- Copy diff to clipboard button
- Close button

**Implementation**:
```jsx
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import 'react-diff-view/style/index.css';

const DiffViewerDialog = ({ promptId, fromCommit, toCommit, isOpen, onClose }) => {
  const [diffText, setDiffText] = useState('');
  const [viewType, setViewType] = useState('split'); // 'split' or 'unified'

  useEffect(() => {
    if (isOpen && promptId && fromCommit && toCommit) {
      fetchDiff();
    }
  }, [isOpen, promptId, fromCommit, toCommit]);

  const fetchDiff = async () => {
    try {
      const response = await promptsAPI.getDiff(promptId, fromCommit.hash, toCommit.hash);
      setDiffText(response.data);
    } catch (error) {
      console.error('Error fetching diff:', error);
      toast.error('Failed to load diff');
    }
  };

  const parsedDiff = parseDiff(diffText);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {fromCommit.hash.substring(0, 7)} → {toCommit.hash.substring(0, 7)}
          </p>
        </DialogHeader>

        <div className="flex justify-between items-center mb-4">
          <Tabs value={viewType} onValueChange={setViewType}>
            <TabsList>
              <TabsTrigger value="split">Split View</TabsTrigger>
              <TabsTrigger value="unified">Unified View</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => copyToClipboard(diffText)}>
            <Copy className="h-4 w-4 mr-1" /> Copy
          </Button>
        </div>

        <ScrollArea className="h-[500px]">
          {parsedDiff.map((file, idx) => (
            <Diff key={idx} viewType={viewType} diffType={file.type} hunks={file.hunks}>
              {hunks => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
            </Diff>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
```

#### 5. Create `RollbackConfirmationDialog.jsx` Component
**Purpose**: Confirm rollback action and get commit message

**Props**:
- `isOpen`
- `onClose`
- `onConfirm` - (commitMessage) => {}
- `targetVersion` - { hash, author, date, message }

**Features**:
- Show warning about rollback action
- Display target version info
- Input field for commit message (with default: "Rolled back to version {hash}")
- Confirm and Cancel buttons
- Explain that this creates a new commit (doesn't delete history)

#### 6. Update `PromptDialog.jsx`
**Changes**:
- Add new tab: "Version History" (alongside Details, Test)
- In Version History tab:
  - Render `<VersionHistoryPanel />`
  - Handle version selection for viewing content
  - Open DiffViewerDialog when compare is clicked
  - Handle rollback with confirmation dialog
- Add "Current Version" badge next to prompt title
- Show last updated date and author if available

**New Props to Fetch**:
- `currentCommit` - from prompt object
- `versionHistory` - fetch on tab open

**Tab Structure**:
```jsx
<Tabs defaultValue="details">
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="history">
      Version History
      <Badge variant="secondary" className="ml-2">{versionCount}</Badge>
    </TabsTrigger>
    <TabsTrigger value="test">Test Prompt</TabsTrigger>
  </TabsList>

  <TabsContent value="details">
    {/* Existing form */}
  </TabsContent>

  <TabsContent value="history">
    <VersionHistoryPanel
      promptId={prompt.id}
      currentCommit={prompt.current_commit}
      onVersionSelect={handleVersionSelect}
    />
  </TabsContent>

  <TabsContent value="test">
    {/* Existing test interface */}
  </TabsContent>
</Tabs>
```

#### 7. Add Version Testing Feature
**Enhancement**: In Test Prompt tab, add dropdown to select version to test

**Features**:
- Dropdown showing version history
- Default: "Current version"
- Fetch content of selected version
- Test interface uses that version's content
- Note: "Testing version {hash} from {date}"

#### 8. Update `PromptCard.jsx`
**Minor Changes**:
- Add small version badge if prompt has multiple versions
- Show last updated date more prominently
- Tooltip on hover: "X versions available"

### Technical Requirements
- Use shadcn/ui components (Dialog, Tabs, ScrollArea, Badge)
- Use lucide-react icons (GitBranch, GitCompare, RotateCcw, Eye, Copy)
- Add loading skeletons for async operations
- Implement error handling with toast notifications
- Format dates with date-fns (e.g., `formatDistanceToNow`)
- Ensure diff viewer has proper syntax highlighting
- Mobile-responsive diff viewer (stack on mobile)
- Support dark/light theme in diff viewer

### CSS for react-diff-view
Create `frontend/src/styles/diff-viewer.css`:
```css
/* Custom styling for react-diff-view to match app theme */
.diff-view {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.diff-gutter {
  background-color: var(--sidebar-background);
}

.diff-line-insert {
  background-color: rgba(34, 197, 94, 0.1);
}

.diff-line-delete {
  background-color: rgba(239, 68, 68, 0.1);
}

/* Dark theme overrides */
.dark .diff-view {
  /* Add dark theme specific styles */
}
```

Import in App.jsx or main.jsx:
```javascript
import './styles/diff-viewer.css';
```

### Files to Reference
- `frontend/src/components/PromptDialog.jsx` - existing prompt dialog
- `frontend/src/components/PromptCard.jsx` - existing prompt card
- `frontend/src/services/api.js` - API client patterns
- `frontend/src/components/ui/*` - shadcn/ui components

### Acceptance Criteria
- [ ] Version history displays correctly with timeline
- [ ] Can view content of any previous version
- [ ] Diff viewer shows changes clearly (side-by-side and unified)
- [ ] Rollback works with confirmation and creates new commit
- [ ] Can test any version of a prompt
- [ ] All UI is responsive and themed
- [ ] Loading states and error handling work
- [ ] No performance issues with large diffs

---

## 📋 Prompt 6: DFG Execution - Sequential Prompt Workflow (Backend & Frontend)

### Context
**Project**: AskHole - AI Chat Assistant
**Previous Steps**: Workflow Spaces and Git Versioning are complete
**Current State**: WorkflowSpace has `prompt_sequence` field (JSON array), prompts can be reordered in UI
**Goal**: Implement backend logic to execute prompt sequences (Data Flow Graph) and frontend UI to trigger and monitor execution

### Task Part A: Backend - Workflow Execution Engine

#### 1. Create Workflow Executor: `backend/src/workflow_executor.py`
**Purpose**: Execute prompt sequences with output chaining

**Key Class**:
```python
class WorkflowExecutor:
    def __init__(self, workflow_space_id, user_id):
        self.workflow_space = WorkflowSpace.query.get(workflow_space_id)
        self.user = User.query.get(user_id)
        self.results = []  # Store results for each step

    def execute(self, initial_input=None, model=None, temperature=1.0):
        """
        Execute the prompt sequence.

        Args:
            initial_input: Optional initial input for first prompt
            model: Model to use (default: gemini-2.5-flash)
            temperature: Temperature setting

        Returns:
            {
                'success': bool,
                'results': [
                    {
                        'step': int,
                        'prompt_id': int,
                        'prompt_title': str,
                        'input': str,
                        'output': str,
                        'execution_time': float,
                        'error': str | None
                    },
                    ...
                ],
                'final_output': str,
                'total_time': float
            }
        """
        # 1. Get prompt sequence from workflow_space.prompt_sequence
        # 2. For each prompt_id in sequence:
        #    a. Fetch prompt from database (or Git)
        #    b. Prepare input:
        #       - First prompt: use initial_input or empty string
        #       - Subsequent prompts: use previous step's output
        #    c. Execute prompt with selected AI model
        #    d. Store result in self.results
        #    e. Handle errors (continue or stop based on config)
        # 3. Return complete results

    def _execute_single_prompt(self, prompt_content, input_text, model, temperature):
        """Execute a single prompt with input."""
        # Format prompt: replace {{input}} placeholder with input_text
        # Call appropriate AI client based on model
        # Return output string

    def _format_prompt_with_input(self, prompt_content, input_text):
        """Replace {{input}} or {{previous_output}} placeholders."""
        # Simple string replacement
        # Future: support {{output_1}}, {{output_2}} for accessing specific steps
```

#### 2. Add Workflow Execution Endpoint: `backend/src/routes/workflow_spaces.py`

**POST /api/workflow_spaces/{id}/execute**:
```python
@workflow_spaces_bp.route('/<int:workspace_id>/execute', methods=['POST'])
def execute_workflow(workspace_id):
    """
    Execute the prompt sequence in a workflow space.

    Body:
    {
        "initial_input": "optional starting text",
        "model": "gemini-2.5-flash",
        "temperature": 1.0,
        "stop_on_error": true  // Whether to stop if a step fails
    }

    Returns:
    {
        "success": true,
        "results": [...],
        "final_output": "...",
        "total_time": 12.5,
        "workspace_name": "My Workflow"
    }
    """
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    # Check access
    workspace = check_workspace_access(workspace_id, current_user.id, 'viewer')
    if not workspace:
        return jsonify({'error': 'Workspace not found or access denied'}), 404

    # Get request data
    data = request.get_json()
    initial_input = data.get('initial_input', '')
    model = data.get('model', 'gemini-2.5-flash')
    temperature = data.get('temperature', 1.0)
    stop_on_error = data.get('stop_on_error', True)

    try:
        # Execute workflow
        executor = WorkflowExecutor(workspace_id, current_user.id)
        results = executor.execute(
            initial_input=initial_input,
            model=model,
            temperature=temperature,
            stop_on_error=stop_on_error
        )

        return jsonify({
            'success': results['success'],
            'results': results['results'],
            'final_output': results.get('final_output', ''),
            'total_time': results.get('total_time', 0),
            'workspace_name': workspace.name
        })

    except Exception as e:
        logger.exception(f"Workflow execution error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
```

#### 3. Update WorkflowSpace Model
**Add method**:
```python
def get_prompt_sequence_details(self):
    """Get full prompt details for sequence."""
    if not self.prompt_sequence:
        return []

    prompt_ids = json.loads(self.prompt_sequence)
    prompts = []
    for prompt_id in prompt_ids:
        prompt = PromptTemplate.query.get(prompt_id)
        if prompt:
            prompts.append({
                'id': prompt.id,
                'title': prompt.title,
                'content': prompt.content  # Or fetch from Git
            })
    return prompts
```

### Task Part B: Frontend - Workflow Execution UI

#### 4. Create `WorkflowExecutionDialog.jsx`
**Location**: `frontend/src/components/WorkflowExecutionDialog.jsx`

**Purpose**: Dialog to configure and run workflow, showing real-time progress

**Props**:
- `workspaceId`
- `workspaceName`
- `prompts` - array of prompts in sequence
- `isOpen`
- `onClose`

**Features**:
- **Configuration Section**:
  - Initial input textarea (optional)
  - Model selector dropdown
  - Temperature slider
  - "Stop on error" checkbox
  - "Execute Workflow" button

- **Execution Progress**:
  - Stepper showing each prompt as a step
  - Current step highlighted
  - Completed steps: green checkmark
  - Failed steps: red X
  - Pending steps: gray

- **Results Display**:
  - Accordion with each step's result
  - Show: Step number, prompt title, input, output, execution time
  - Copy button for each output
  - "Copy Final Output" button
  - Download results as JSON/TXT button

- **Error Handling**:
  - Display error messages per step
  - "Retry from failed step" button (optional)
  - Cancel execution button (if streaming support added later)

**State**:
```javascript
const [isExecuting, setIsExecuting] = useState(false);
const [currentStep, setCurrentStep] = useState(0);
const [results, setResults] = useState([]);
const [finalOutput, setFinalOutput] = useState('');
const [error, setError] = useState(null);
const [executionConfig, setExecutionConfig] = useState({
  initial_input: '',
  model: 'gemini-2.5-flash',
  temperature: 1.0,
  stop_on_error: true
});
```

**UI Structure**:
```jsx
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-4xl max-h-[90vh]">
    <DialogHeader>
      <DialogTitle>Run Workflow: {workspaceName}</DialogTitle>
      <p className="text-sm text-muted-foreground">
        {prompts.length} steps
      </p>
    </DialogHeader>

    <Tabs defaultValue="configure">
      <TabsList>
        <TabsTrigger value="configure">Configure</TabsTrigger>
        <TabsTrigger value="results" disabled={!results.length}>Results</TabsTrigger>
      </TabsList>

      <TabsContent value="configure">
        <div className="space-y-4">
          <div>
            <Label>Initial Input (Optional)</Label>
            <Textarea
              value={executionConfig.initial_input}
              onChange={(e) => setExecutionConfig({...executionConfig, initial_input: e.target.value})}
              placeholder="Enter initial input for the first prompt..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Model</Label>
              <ModelSelector
                value={executionConfig.model}
                onChange={(model) => setExecutionConfig({...executionConfig, model})}
              />
            </div>
            <div>
              <Label>Temperature: {executionConfig.temperature}</Label>
              <Slider
                value={[executionConfig.temperature]}
                onValueChange={([temp]) => setExecutionConfig({...executionConfig, temperature: temp})}
                min={0}
                max={2}
                step={0.1}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={executionConfig.stop_on_error}
              onCheckedChange={(checked) => setExecutionConfig({...executionConfig, stop_on_error: checked})}
            />
            <Label>Stop execution on error</Label>
          </div>

          <Button
            onClick={handleExecute}
            disabled={isExecuting || prompts.length === 0}
            className="w-full"
          >
            {isExecuting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing Step {currentStep + 1} of {prompts.length}...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Execute Workflow
              </>
            )}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="results">
        <ScrollArea className="h-[500px]">
          {/* Stepper */}
          <div className="mb-6">
            {prompts.map((prompt, idx) => {
              const result = results[idx];
              const status = result ? (result.error ? 'error' : 'success') : 'pending';
              const isCurrent = idx === currentStep && isExecuting;

              return (
                <div key={prompt.id} className="flex items-center gap-3 mb-2">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    ${status === 'success' ? 'bg-green-500' : ''}
                    ${status === 'error' ? 'bg-red-500' : ''}
                    ${status === 'pending' ? 'bg-gray-300' : ''}
                    ${isCurrent ? 'animate-pulse bg-blue-500' : ''}
                  `}>
                    {status === 'success' && <Check className="h-4 w-4 text-white" />}
                    {status === 'error' && <X className="h-4 w-4 text-white" />}
                    {status === 'pending' && <span className="text-xs text-gray-600">{idx + 1}</span>}
                    {isCurrent && <Loader2 className="h-4 w-4 text-white animate-spin" />}
                  </div>
                  <span className="text-sm">{prompt.title}</span>
                </div>
              );
            })}
          </div>

          {/* Results Accordion */}
          <Accordion type="single" collapsible>
            {results.map((result, idx) => (
              <AccordionItem key={idx} value={`step-${idx}`}>
                <AccordionTrigger>
                  Step {idx + 1}: {result.prompt_title}
                  <Badge variant={result.error ? 'destructive' : 'success'} className="ml-2">
                    {result.error ? 'Failed' : 'Success'}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {result.input && (
                      <div>
                        <Label>Input:</Label>
                        <pre className="bg-muted p-2 rounded text-xs">{result.input}</pre>
                      </div>
                    )}
                    {result.output && (
                      <div>
                        <Label>Output:</Label>
                        <pre className="bg-muted p-2 rounded text-xs">{result.output}</pre>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(result.output)}>
                          <Copy className="h-3 w-3 mr-1" /> Copy
                        </Button>
                      </div>
                    )}
                    {result.error && (
                      <Alert variant="destructive">
                        <AlertDescription>{result.error}</AlertDescription>
                      </Alert>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Execution time: {result.execution_time?.toFixed(2)}s
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Final Output */}
          {finalOutput && (
            <div className="mt-6 p-4 border rounded">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-lg">Final Output:</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(finalOutput)}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadResults}>
                    <Download className="h-3 w-3 mr-1" /> Download
                  </Button>
                </div>
              </div>
              <pre className="bg-muted p-3 rounded text-sm whitespace-pre-wrap">{finalOutput}</pre>
            </div>
          )}
        </ScrollArea>
      </TabsContent>
    </Tabs>
  </DialogContent>
</Dialog>
```

#### 5. Update `WorkspaceDetail.jsx`
**Add "Run Workflow" button**:
```jsx
// In Prompts tab, after prompt list
<div className="mt-4">
  <Button
    onClick={() => setIsExecutionDialogOpen(true)}
    disabled={prompts.length === 0}
    className="w-full"
  >
    <Play className="mr-2 h-4 w-4" />
    Run Workflow ({prompts.length} steps)
  </Button>
</div>

{/* Dialog */}
<WorkflowExecutionDialog
  workspaceId={workspace.id}
  workspaceName={workspace.name}
  prompts={prompts}
  isOpen={isExecutionDialogOpen}
  onClose={() => setIsExecutionDialogOpen(false)}
/>
```

#### 6. Update API Service: `frontend/src/services/api.js`
```javascript
export const workflowSpacesAPI = {
  // ... existing methods ...

  executeWorkflow: (id, config) => api.post(`/workflow_spaces/${id}/execute`, config),
};
```

### Technical Requirements
- **Backend**:
  - Support placeholder syntax: `{{input}}` or `{{previous_output}}` in prompts
  - Future enhancement: `{{output_1}}`, `{{output_2}}` for accessing specific steps
  - Measure execution time per step
  - Proper error handling and logging
  - Consider timeout per step (e.g., 60 seconds)

- **Frontend**:
  - Real-time progress updates (currently polling, future: WebSockets)
  - Smooth animations for stepper
  - Responsive design for mobile
  - Accessibility: keyboard navigation, ARIA labels
  - Toast notifications on success/error

### Optional Enhancements (Future)
1. **Streaming support**: Show output as it's being generated
2. **Conditional branching**: If step output contains X, go to step Y
3. **Variable extraction**: Extract values from outputs (regex, JSON path)
4. **Save execution history**: Store workflow runs in database
5. **Scheduled workflows**: Cron-like scheduling
6. **Parallel execution**: Run some steps in parallel

### Files to Reference
- `backend/src/gemini_client.py` - AI client patterns
- `backend/src/routes/chat.py` - similar message handling
- `frontend/src/components/WorkspaceDetail.jsx` - integration point
- `frontend/src/components/ui/*` - shadcn/ui components

### Acceptance Criteria
- [ ] Backend can execute prompt sequences
- [ ] Output from one prompt becomes input to next
- [ ] Frontend shows real-time execution progress
- [ ] Results are displayed clearly per step
- [ ] Error handling works (stop or continue)
- [ ] Can copy and download results
- [ ] Works with different models and temperatures
- [ ] No crashes with empty sequences or invalid prompts

---

## 📋 Summary & Next Steps

### Implementation Order
Use these prompts in sequence:

1. **Prompt 1** → Database models and migration (1-2 days)
2. **Prompt 2** → Backend API for Workflow Spaces (2-3 days)
3. **Prompt 3** → Frontend UI for Workflow Spaces (3-4 days)
4. **Prompt 4** → Git versioning backend (5-7 days) ⚠️ Most complex
5. **Prompt 5** → Git versioning frontend (4-5 days)
6. **Prompt 6** → DFG execution backend + frontend (4-5 days)

**Total Estimated Time**: 6-8 weeks for complete implementation

### Testing Checklist After Each Prompt
- [ ] Database migrations run successfully
- [ ] All API endpoints respond correctly
- [ ] UI components render without errors
- [ ] No console errors or warnings
- [ ] Authentication and authorization work
- [ ] Error handling provides user feedback
- [ ] Mobile responsive design works

### Deployment Considerations
1. **Backup database** before running migrations
2. **Add to .gitignore**: `backend/src/prompts_repo/`
3. **Environment variables**: Git user.name and user.email
4. **File permissions**: Ensure backend can write to prompts_repo
5. **Dependencies**: Update requirements.txt and package.json
6. **Documentation**: Update README with new features

### Success Metrics
- Users can create and manage workflow spaces ✅
- Prompts have full version control with visual diffs ✅
- Prompt sequences execute reliably ✅
- UI is intuitive and responsive ✅
- No data loss or corruption ✅

---

## 🎯 Quick Reference: Key Decisions Needed Before Starting

Before using **Prompt 4** (Git versioning), decide:

1. **Repository structure**:
   - ☐ Single repo: `/prompts_repo/prompts/{prompt_id}.md`
   - ☐ User-separated: `/prompts_repo/users/{user_id}/{prompt_id}.md`

2. **Commit messages**:
   - ☐ Auto-generated
   - ☐ User-provided (recommended)
   - ☐ Hybrid (required for rollback, optional for update)

3. **Database field**:
   - ☐ Keep `content` synced (redundant but safer)
   - ☐ Replace with `file_path` only (cleaner but requires Git for all reads)
   - ☐ Recommended: Keep `content` for backward compatibility during migration

4. **Migration strategy**:
   - ☐ Migrate all existing prompts to Git immediately
   - ☐ Only new prompts use Git (not recommended)
   - ☐ Gradual migration with flag

**Recommended Answers**: Single repo, user-provided commit messages, keep content field initially, full migration.

---

## 📞 Support & Questions

If any prompt is unclear or you encounter issues:
1. Provide error messages and logs
2. Share relevant code snippets
3. Describe expected vs. actual behavior
4. Mention which prompt you're working on

Each prompt is designed to be self-contained, but they build on each other. Don't skip prompts!

Good luck with implementation! 🚀
