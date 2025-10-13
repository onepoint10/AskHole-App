# Architecture Diagram: Workflow Spaces & DFG Features

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐ │
│  │  WorkflowSpaces.jsx  │  │ WorkflowBuilder.jsx  │  │PromptVersion-    │ │
│  │                      │  │                      │  │  History.jsx     │ │
│  │ • List workspaces    │  │ • Build workflows    │  │                  │ │
│  │ • Create/Edit/Delete │  │ • Add/Remove nodes   │  │ • View versions  │ │
│  │ • Manage members     │  │ • Execute workflows  │  │ • Create version │ │
│  │ • View stats         │  │ • Visual editor      │  │ • Restore version│ │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬─────────┘ │
│             │                          │                        │           │
│             └──────────────────────────┼────────────────────────┘           │
│                                        │                                    │
│                          ┌─────────────▼─────────────┐                     │
│                          │   services/api.js         │                     │
│                          │                           │                     │
│                          │   workflowAPI:            │                     │
│                          │   • getWorkspaces()       │                     │
│                          │   • createWorkspace()     │                     │
│                          │   • createWorkflow()      │                     │
│                          │   • executeWorkflow()     │                     │
│                          │   • getPromptVersions()   │                     │
│                          │   • createPromptVersion() │                     │
│                          └─────────────┬─────────────┘                     │
│                                        │                                    │
└────────────────────────────────────────┼────────────────────────────────────┘
                                         │
                              HTTP/REST API (JSON)
                                         │
┌────────────────────────────────────────▼────────────────────────────────────┐
│                              BACKEND (Flask)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      routes/workflow.py                              │  │
│  │                                                                      │  │
│  │  Workspace Routes:                   Workflow Routes:                │  │
│  │  • GET    /api/workspaces            • GET    /api/workflows/{id}   │  │
│  │  • POST   /api/workspaces            • POST   /api/workflows        │  │
│  │  • PUT    /api/workspaces/{id}       • PUT    /api/workflows/{id}   │  │
│  │  • DELETE /api/workspaces/{id}       • DELETE /api/workflows/{id}   │  │
│  │                                      • POST   /api/workflows/{id}/   │  │
│  │  Member Routes:                               execute                │  │
│  │  • POST   /api/workspaces/{id}/                                     │  │
│  │           members                    Version Routes:                │  │
│  │  • DELETE /api/workspaces/{id}/      • GET    /api/prompts/{id}/    │  │
│  │           members/{mid}                        versions              │  │
│  │                                      • POST   /api/prompts/{id}/    │  │
│  │                                               versions              │  │
│  │                                      • POST   /api/prompts/{id}/    │  │
│  │                                               versions/{vid}/restore│  │
│  └──────────────────────────┬───────────────────────────────────────────┘  │
│                             │                                               │
│  ┌──────────────────────────▼───────────────────────────────────────────┐  │
│  │                      models/workflow.py                              │  │
│  │                                                                      │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────┐ │  │
│  │  │ WorkflowSpace   │  │ Workflow        │  │ PromptVersion      │ │  │
│  │  │                 │  │                 │  │                    │ │  │
│  │  │ • name          │  │ • workspace_id  │  │ • prompt_id        │ │  │
│  │  │ • description   │  │ • name          │  │ • version_number   │ │  │
│  │  │ • owner_id      │  │ • description   │  │ • content          │ │  │
│  │  │ • is_public     │  │ • created_by    │  │ • commit_message   │ │  │
│  │  └────────┬────────┘  └────────┬────────┘  │ • author_id        │ │  │
│  │           │                    │            └────────────────────┘ │  │
│  │           │                    │                                   │  │
│  │  ┌────────▼────────┐  ┌────────▼────────┐  ┌────────────────────┐ │  │
│  │  │ WorkflowSpace   │  │ WorkflowNode    │  │ WorkflowExecution  │ │  │
│  │  │ Member          │  │                 │  │                    │ │  │
│  │  │                 │  │ • workflow_id   │  │ • workflow_id      │ │  │
│  │  │ • workspace_id  │  │ • prompt_id     │  │ • user_id          │ │  │
│  │  │ • user_id       │  │ • node_type     │  │ • status           │ │  │
│  │  │ • role          │  │ • label         │  │ • input_data       │ │  │
│  │  └─────────────────┘  │ • config        │  │ • output_data      │ │  │
│  │                       │ • position_x/y  │  │ • error_message    │ │  │
│  │  ┌─────────────────┐  └─────────────────┘  └────────────────────┘ │  │
│  │  │ WorkflowPrompt  │  ┌─────────────────┐                         │  │
│  │  │ Association     │  │ WorkflowEdge    │                         │  │
│  │  │                 │  │                 │                         │  │
│  │  │ • workspace_id  │  │ • workflow_id   │                         │  │
│  │  │ • prompt_id     │  │ • source_node   │                         │  │
│  │  │ • position      │  │ • target_node   │                         │  │
│  │  └─────────────────┘  │ • label         │                         │  │
│  │                       │ • config        │                         │  │
│  │                       └─────────────────┘                         │  │
│  └──────────────────────────┬───────────────────────────────────────────┘  │
│                             │                                               │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  SQLite Database   │
                    │                    │
                    │  • workflow_spaces │
                    │  • workflows       │
                    │  • workflow_nodes  │
                    │  • workflow_edges  │
                    │  • prompt_versions │
                    │  • workflow_       │
                    │    executions      │
                    └────────────────────┘


DATA FLOW EXAMPLE: Creating and Executing a Workflow
═══════════════════════════════════════════════════

1. User creates workspace
   WorkflowSpaces.jsx → workflowAPI.createWorkspace() 
   → POST /api/workspaces → WorkflowSpace model → Database

2. User adds prompts to workspace
   WorkflowSpaces.jsx → workflowAPI.addPromptToWorkspace()
   → POST /api/workspaces/{id}/prompts → WorkflowPromptAssociation → Database

3. User creates workflow
   WorkflowBuilder.jsx → workflowAPI.createWorkflow()
   → POST /api/workspaces/{id}/workflows → Workflow model → Database

4. User adds nodes to workflow
   WorkflowBuilder.jsx → workflowAPI.updateWorkflow()
   → PUT /api/workflows/{id} → WorkflowNode models → Database

5. User executes workflow
   WorkflowBuilder.jsx → workflowAPI.executeWorkflow()
   → POST /api/workflows/{id}/execute → WorkflowExecution model → Database
   → (Future: Actual execution engine processes nodes)


VERSION CONTROL FLOW: Git-style Versioning
═══════════════════════════════════════════

1. User edits prompt template
   PromptDialog.jsx → promptsAPI.updatePrompt()
   → PUT /api/prompts/{id} → PromptTemplate model → Database

2. User creates version snapshot
   PromptVersionHistory.jsx → workflowAPI.createPromptVersion()
   → POST /api/prompts/{id}/versions 
   → PromptVersion model (with version_number++) → Database

3. User views version history
   PromptVersionHistory.jsx → workflowAPI.getPromptVersions()
   → GET /api/prompts/{id}/versions 
   → Returns all PromptVersion records

4. User restores old version
   PromptVersionHistory.jsx → workflowAPI.restorePromptVersion()
   → POST /api/prompts/{id}/versions/{vid}/restore
   → Updates PromptTemplate with version content → Database


SECURITY LAYERS
═══════════════

┌────────────────────┐
│   User Login       │
│   (Authentication) │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│   Session Token    │
│   (X-Session-ID)   │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ get_current_user() │
│ (Route Protection) │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  Role-Based Check  │
│  (owner/editor/    │
│   viewer)          │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│   Database Query   │
│   (Filtered by     │
│    user_id)        │
└────────────────────┘


FILE STRUCTURE
══════════════

AskHole-App/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   │   ├── workflow.py      ✓ NEW
│   │   │   ├── chat.py
│   │   │   └── user.py
│   │   ├── routes/
│   │   │   ├── workflow.py      ✓ NEW
│   │   │   ├── chat.py
│   │   │   ├── auth.py
│   │   │   └── admin.py
│   │   └── main.py              ✓ MODIFIED
│   ├── test_workflow_integration.py ✓ NEW
│   ├── verify_syntax.py         ✓ NEW
│   └── requirements.txt         ✓ MODIFIED
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── WorkflowSpaces.jsx        ✓ NEW
│       │   ├── WorkflowBuilder.jsx       ✓ NEW
│       │   └── PromptVersionHistory.jsx  ✓ NEW
│       └── services/
│           └── api.js           ✓ MODIFIED
│
├── WORKFLOW_FEATURES.md         ✓ NEW
├── IMPLEMENTATION_SUMMARY.md    ✓ NEW
├── ARCHITECTURE.md              ✓ NEW (this file)
└── README.md                    ✓ MODIFIED
```

## Key Design Decisions

### 1. Database Design
- **Normalized structure**: Separate tables for workspaces, members, prompts, workflows
- **Relationships**: Using SQLAlchemy relationships for easy navigation
- **JSON fields**: Store complex config as JSON in TEXT fields
- **Unique constraints**: Prevent duplicate memberships and prompt associations

### 2. API Design
- **RESTful principles**: Standard HTTP methods (GET, POST, PUT, DELETE)
- **Nested resources**: `/workspaces/{id}/workflows` for hierarchy
- **Authentication first**: All endpoints require authentication
- **Role-based access**: Different permissions based on user role

### 3. Frontend Architecture
- **Component isolation**: Each feature has its own component
- **Shared API service**: Centralized API calls in `services/api.js`
- **Hooks-based**: Using React hooks for state management
- **Dialog patterns**: Consistent UI patterns for create/edit operations

### 4. Security
- **Authentication**: Token-based authentication on all endpoints
- **Authorization**: Role checks (owner, editor, viewer, member)
- **Data isolation**: Users only see their own or shared workspaces
- **Input validation**: Server-side validation on all inputs

### 5. Extensibility
- **Pluggable nodes**: Node types are configurable (prompt, input, output, condition)
- **JSON configs**: Store arbitrary configuration in JSON fields
- **Version control**: Built-in versioning for all prompts
- **Execution tracking**: Complete history of workflow runs

## Future Enhancement Paths

### Path 1: Advanced DFG
```
Current: Simple linear node list
    ↓
Add: Drag-and-drop editor (React Flow)
    ↓
Add: Conditional branching
    ↓
Add: Parallel execution
    ↓
Add: Loop nodes
```

### Path 2: Real Git Integration
```
Current: Database-stored versions
    ↓
Add: GitPython integration
    ↓
Add: Git repository per workspace
    ↓
Add: Push/pull to remote repos
    ↓
Add: Branching and merging
```

### Path 3: Collaboration
```
Current: Basic member roles
    ↓
Add: Real-time editing (WebSockets)
    ↓
Add: Comments and discussions
    ↓
Add: Activity feed
    ↓
Add: Notifications
```

### Path 4: Workflow Execution
```
Current: API endpoint (no execution)
    ↓
Add: Basic sequential execution
    ↓
Add: Data passing between nodes
    ↓
Add: Error handling and retry
    ↓
Add: Background job queue
    ↓
Add: Monitoring and logging
```
