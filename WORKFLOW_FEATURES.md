# Workflow Spaces & DFG Features

This document describes the new Workflow Spaces and Directed Flow Graph (DFG) execution features added to AskHole.

## Overview

The implementation includes:

1. **Workflow Spaces** - Project/team workspaces for organizing prompts
2. **Git-style Versioning** - Version control for prompt templates
3. **DFG (Directed Flow Graph)** - Visual workflow builder for prompt sequences
4. **Workflow Execution** - Execute complex prompt workflows

## Backend Components

### Database Models

#### WorkflowSpace
Represents a workspace/project for organizing prompts and workflows.
- Fields: `name`, `description`, `owner_id`, `is_public`
- Relationships: members, prompts, workflows

#### WorkflowSpaceMember
Manages workspace membership and roles.
- Fields: `workspace_id`, `user_id`, `role` (owner, editor, viewer, member)
- Unique constraint: one membership per user per workspace

#### WorkflowPromptAssociation
Associates prompts with workspaces.
- Fields: `workspace_id`, `prompt_id`, `position`
- Allows organizing prompts within a workspace

#### PromptVersion
Git-style versioning for prompts.
- Fields: `prompt_id`, `version_number`, `content`, `title`, `commit_message`, `author_id`
- Each save creates a new version for history tracking

#### Workflow
Represents a workflow (DFG) definition.
- Fields: `workspace_id`, `name`, `description`, `created_by`
- Relationships: nodes, edges, executions

#### WorkflowNode
Nodes in a workflow graph.
- Fields: `workflow_id`, `prompt_id`, `node_type`, `label`, `config`, `position_x`, `position_y`
- Node types: prompt, input, output, condition

#### WorkflowEdge
Edges connecting workflow nodes (data flow).
- Fields: `workflow_id`, `source_node_id`, `target_node_id`, `label`, `config`
- Represents data flow between nodes

#### WorkflowExecution
Execution history and status tracking.
- Fields: `workflow_id`, `user_id`, `status`, `input_data`, `output_data`, `error_message`
- Status: pending, running, completed, failed

### API Endpoints

#### Workspace Management
- `GET /api/workspaces` - List all accessible workspaces
- `POST /api/workspaces` - Create new workspace
- `GET /api/workspaces/{id}` - Get workspace details
- `PUT /api/workspaces/{id}` - Update workspace
- `DELETE /api/workspaces/{id}` - Delete workspace (owner only)

#### Workspace Members
- `POST /api/workspaces/{id}/members` - Add member
- `DELETE /api/workspaces/{id}/members/{member_id}` - Remove member

#### Workspace Prompts
- `POST /api/workspaces/{id}/prompts` - Add prompt to workspace
- `DELETE /api/workspaces/{id}/prompts/{association_id}` - Remove prompt

#### Prompt Versioning
- `GET /api/prompts/{id}/versions` - Get version history
- `POST /api/prompts/{id}/versions` - Create new version
- `POST /api/prompts/{id}/versions/{version_id}/restore` - Restore version

#### Workflow Management
- `GET /api/workspaces/{id}/workflows` - List workflows in workspace
- `POST /api/workspaces/{id}/workflows` - Create workflow
- `GET /api/workflows/{id}` - Get workflow with nodes/edges
- `PUT /api/workflows/{id}` - Update workflow
- `DELETE /api/workflows/{id}` - Delete workflow
- `POST /api/workflows/{id}/execute` - Execute workflow
- `GET /api/workflows/{id}/executions` - Get execution history

## Frontend Components

### WorkflowSpaces.jsx
Main component for managing workflow spaces.

Features:
- List all accessible workspaces
- Create new workspaces
- Edit workspace details
- Delete workspaces
- View workspace stats (members, prompts, workflows)
- Public/private workspace toggle

### WorkflowBuilder.jsx
Visual workflow builder for creating DFGs.

Features:
- Add/remove workflow nodes
- Simple visualization of workflow structure
- Save workflow configuration
- Execute workflows with input data
- View execution history

### PromptVersionHistory.jsx
Git-style version history for prompts.

Features:
- View all versions of a prompt
- Create new versions with commit messages
- Restore previous versions
- View version details and changes

## Usage Guide

### Creating a Workspace

```javascript
import { workflowAPI } from './services/api';

const createWorkspace = async () => {
  const response = await workflowAPI.createWorkspace({
    name: 'My Project',
    description: 'Project description',
    is_public: false
  }, 'en');
  console.log('Created workspace:', response.data);
};
```

### Adding a Prompt to Workspace

```javascript
const addPrompt = async (workspaceId, promptId) => {
  const response = await workflowAPI.addPromptToWorkspace(
    workspaceId,
    { prompt_id: promptId, position: 0 },
    'en'
  );
};
```

### Creating a Prompt Version

```javascript
const createVersion = async (promptId) => {
  const response = await workflowAPI.createPromptVersion(
    promptId,
    { commit_message: 'Updated prompt template' },
    'en'
  );
};
```

### Building a Workflow

```javascript
const workflow = {
  name: 'My Workflow',
  description: 'Process data through multiple prompts',
  nodes: [
    {
      prompt_id: 1,
      node_type: 'prompt',
      label: 'Initial Processing',
      position_x: 100,
      position_y: 100
    },
    {
      prompt_id: 2,
      node_type: 'prompt',
      label: 'Refinement',
      position_x: 300,
      position_y: 100
    }
  ],
  edges: [
    {
      source_node_id: 1,
      target_node_id: 2,
      label: 'Pass output'
    }
  ]
};

const createWorkflow = async (workspaceId) => {
  const response = await workflowAPI.createWorkflow(workspaceId, workflow, 'en');
};
```

### Executing a Workflow

```javascript
const executeWorkflow = async (workflowId) => {
  const response = await workflowAPI.executeWorkflow(
    workflowId,
    { input_data: { text: 'Hello World' } },
    'en'
  );
  console.log('Execution started:', response.data);
};
```

## Integration with Main App

To integrate these components into the main App.jsx:

### Option 1: Add to Sidebar as a New Tab

Add a "Workflows" tab to the Sidebar component:

```javascript
// In Sidebar.jsx, add to tab navigation:
<Button
  variant={activeTab === 'workflows' ? 'default' : 'ghost'}
  size="sm"
  onClick={() => setActiveTab('workflows')}
>
  <Folder className="h-4 w-4 mr-1" />
  {t('workflows')}
</Button>

// In the content area:
{activeTab === 'workflows' && (
  <WorkflowSpaces />
)}
```

### Option 2: Add as a Settings Section

Add workflow management to the Settings dialog:

```javascript
// In SettingsDialog.jsx:
<TabsContent value="workflows">
  <WorkflowSpaces />
</TabsContent>
```

### Option 3: Standalone Page/Route

For apps using routing, add as a separate route:

```javascript
<Route path="/workflows" element={<WorkflowSpaces />} />
```

## Future Enhancements

### Git Integration (GitPython)
To add full Git integration:

1. Install GitPython: `pip install GitPython`
2. Create a Git repository for each workspace
3. Use Git for actual version control instead of database records
4. Enable push/pull to remote repositories

Example implementation:

```python
from git import Repo
import os

def init_workspace_repo(workspace_id):
    """Initialize a Git repository for a workspace"""
    repo_path = f'./workspaces/{workspace_id}'
    os.makedirs(repo_path, exist_ok=True)
    repo = Repo.init(repo_path)
    return repo

def commit_prompt_version(workspace_id, prompt_id, content, message):
    """Commit a prompt version to Git"""
    repo_path = f'./workspaces/{workspace_id}'
    repo = Repo(repo_path)
    
    # Write prompt to file
    prompt_file = f'prompts/{prompt_id}.txt'
    os.makedirs(os.path.dirname(prompt_file), exist_ok=True)
    with open(os.path.join(repo_path, prompt_file), 'w') as f:
        f.write(content)
    
    # Commit changes
    repo.index.add([prompt_file])
    repo.index.commit(message)
```

### Advanced DFG Features

1. **Conditional Nodes**: Add if/else logic to workflows
2. **Loop Nodes**: Iterate over data sets
3. **Parallel Execution**: Run multiple branches simultaneously
4. **Data Transformation**: Transform data between nodes
5. **Error Handling**: Catch and handle errors in workflows
6. **Visual Editor**: Drag-and-drop node editor (React Flow)

### Collaboration Features

1. **Real-time Editing**: Multiple users editing workflows simultaneously
2. **Comments**: Add comments to workflows and prompts
3. **Activity Feed**: Track changes and updates
4. **Notifications**: Notify team members of changes
5. **Permissions**: Fine-grained access control

## Security Considerations

1. **Authentication**: All endpoints require authentication
2. **Authorization**: Role-based access control for workspaces
3. **Data Validation**: Input validation on all endpoints
4. **SQL Injection**: Using SQLAlchemy ORM prevents SQL injection
5. **XSS Prevention**: Frontend sanitizes user input

## Performance Considerations

1. **Indexing**: Add database indexes for common queries
2. **Caching**: Cache workspace and workflow data
3. **Pagination**: Implement pagination for large lists
4. **Lazy Loading**: Load workflow details on demand
5. **Async Execution**: Run workflows asynchronously

## Testing

### Backend Testing

```python
# Test workspace creation
def test_create_workspace(client, auth_token):
    response = client.post('/api/workspaces', 
        json={'name': 'Test Workspace'},
        headers={'X-Session-ID': auth_token})
    assert response.status_code == 201
    assert response.json['name'] == 'Test Workspace'

# Test workflow execution
def test_execute_workflow(client, auth_token, workflow_id):
    response = client.post(f'/api/workflows/{workflow_id}/execute',
        json={'input_data': {'test': 'data'}},
        headers={'X-Session-ID': auth_token})
    assert response.status_code == 202
```

### Frontend Testing

```javascript
// Test workspace creation
describe('WorkflowSpaces', () => {
  it('should create a new workspace', async () => {
    const { getByText, getByPlaceholderText } = render(<WorkflowSpaces />);
    
    fireEvent.click(getByText('New Workspace'));
    fireEvent.change(getByPlaceholderText('Enter workspace name'), {
      target: { value: 'Test Workspace' }
    });
    fireEvent.click(getByText('Create'));
    
    await waitFor(() => {
      expect(getByText('Test Workspace')).toBeInTheDocument();
    });
  });
});
```

## Troubleshooting

### Common Issues

1. **Database migrations**: Run migrations after updating models
   ```bash
   cd backend
   python migrate_database.py
   ```

2. **Import errors**: Ensure all new models are imported in `main.py`

3. **API endpoint not found**: Check blueprint registration in `main.py`

4. **Frontend build errors**: Clear node_modules and reinstall
   ```bash
   cd frontend
   rm -rf node_modules
   npm install
   ```

## License

Same as the main AskHole project (MIT License).
