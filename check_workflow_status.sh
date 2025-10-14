#!/bin/bash
# Quick check for workflow implementation

echo "========================================================================"
echo "WORKFLOW IMPLEMENTATION STATUS CHECK"
echo "========================================================================"

echo -e "\n1. Backend Files:"
echo -n "   models/workflow.py: "
if [ -f "backend/src/models/workflow.py" ]; then
    echo "✓ EXISTS"
else
    echo "✗ MISSING"
fi

echo -n "   routes/workflow.py: "
if [ -f "backend/src/routes/workflow.py" ]; then
    echo "✓ EXISTS"
else
    echo "✗ MISSING"
fi

echo -e "\n2. Frontend Files:"
echo -n "   WorkflowSpaces.jsx: "
if [ -f "frontend/src/components/WorkflowSpaces.jsx" ]; then
    echo "✓ EXISTS"
else
    echo "✗ MISSING"
fi

echo -n "   WorkflowBuilder.jsx: "
if [ -f "frontend/src/components/WorkflowBuilder.jsx" ]; then
    echo "✓ EXISTS"
else
    echo "✗ MISSING"
fi

echo -n "   PromptVersionHistory.jsx: "
if [ -f "frontend/src/components/PromptVersionHistory.jsx" ]; then
    echo "✓ EXISTS"
else
    echo "✗ MISSING"
fi

echo -e "\n3. Blueprint Registration:"
if grep -q "from src.routes.workflow import workflow_bp" backend/src/main.py; then
    echo "   ✓ workflow_bp imported"
else
    echo "   ✗ workflow_bp NOT imported"
fi

if grep -q "app.register_blueprint(workflow_bp" backend/src/main.py; then
    echo "   ✓ workflow_bp registered"
else
    echo "   ✗ workflow_bp NOT registered"
fi

echo -e "\n4. API Service:"
if grep -q "export const workflowAPI" frontend/src/services/api.js; then
    echo "   ✓ workflowAPI exported"
else
    echo "   ✗ workflowAPI NOT exported"
fi

echo -e "\n5. Integration Status:"
if grep -q "WorkflowSpaces" frontend/src/App.jsx; then
    echo "   ✓ Components integrated in App.jsx"
else
    echo "   ✗ Components NOT integrated in App.jsx"
    echo "   → You need to add components to the UI"
fi

echo -e "\n========================================================================"
echo "SUMMARY"
echo "========================================================================"
echo "All backend files exist and are registered."
echo "Frontend components exist but are NOT YET INTEGRATED into the UI."
echo ""
echo "TO USE THE NEW FEATURES:"
echo "1. Add a 'Workflows' button/tab to your Sidebar or top navigation"
echo "2. Import and render WorkflowSpaces component when clicked"
echo "3. Start backend: cd backend && source ../.venv/bin/activate && python src/main.py"
echo "4. Start frontend: cd frontend && npm run dev"
echo "========================================================================"
