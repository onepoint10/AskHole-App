#!/bin/bash

# AskHole Codebase Cleanup Script
# This script removes debug statements and test code from the codebase
# USE WITH CAUTION - Review changes before committing

echo "🧹 AskHole Codebase Cleanup Script"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for changes
CHANGES=0

# Backup function
backup_file() {
    local file=$1
    cp "$file" "$file.backup"
    echo -e "${GREEN}✓${NC} Created backup: $file.backup"
}

echo "Phase 1: Critical Security - Removing Test Endpoints"
echo "------------------------------------------------------"

# 1. Remove test-auth endpoint from chat.py
FILE="backend/src/routes/chat.py"
if [ -f "$FILE" ]; then
    backup_file "$FILE"
    # Remove the test-auth endpoint (lines 1235-1240 approximately)
    # This requires manual review due to varying line numbers
    echo -e "${YELLOW}⚠${NC}  Manual review needed: Remove @chat_bp.route('/test-auth') endpoint from $FILE"
    ((CHANGES++))
fi

# 2. Remove debug-session endpoint from auth.py
FILE="backend/src/routes/auth.py"
if [ -f "$FILE" ]; then
    backup_file "$FILE"
    echo -e "${YELLOW}⚠${NC}  Manual review needed: Remove debug_session() function and /debug-session endpoint from $FILE"
    ((CHANGES++))
fi

echo ""
echo "Phase 2: Backend Cleanup - Removing Print Statements"
echo "-----------------------------------------------------"

# Note: Be very careful with sed - test on copies first!
# This section is commented out for safety - enable after review

# Uncomment these to actually perform the cleanup:

# # Remove print statements from auth.py (preserve those in docstrings)
# FILE="backend/src/routes/auth.py"
# if [ -f "$FILE" ]; then
#     sed -i.bak '/^[[:space:]]*print(/d' "$FILE"
#     echo -e "${GREEN}✓${NC} Cleaned print statements from $FILE"
#     ((CHANGES++))
# fi

# # Remove print statements from gemini_client.py
# FILE="backend/src/gemini_client.py"
# if [ -f "$FILE" ]; then
#     sed -i.bak '/^[[:space:]]*print(/d' "$FILE"
#     echo -e "${GREEN}✓${NC} Cleaned print statements from $FILE"
#     ((CHANGES++))
# fi

echo -e "${YELLOW}⚠${NC}  Backend cleanup commands are commented out for safety"
echo "   Review the script and uncomment to apply"

echo ""
echo "Phase 3: Frontend Cleanup - Removing Console.log"
echo "------------------------------------------------"

# Frontend cleanup - more aggressive since console.log is pure debug

# Create a list of frontend files
FRONTEND_FILES=(
    "frontend/src/App.jsx"
    "frontend/src/components/MessageList.jsx"
    "frontend/src/services/api.js"
)

for FILE in "${FRONTEND_FILES[@]}"; do
    if [ -f "$FILE" ]; then
        backup_file "$FILE"

        # Count console.log statements
        LOG_COUNT=$(grep -c "console\.log(" "$FILE" || true)

        if [ $LOG_COUNT -gt 0 ]; then
            echo -e "${YELLOW}⚠${NC}  Found $LOG_COUNT console.log statements in $FILE"
            # Uncomment the next line to actually remove them:
            # sed -i.bak '/console\.log(/d' "$FILE"
            # echo -e "${GREEN}✓${NC} Removed console.log statements from $FILE"
            ((CHANGES++))
        fi
    fi
done

echo -e "${YELLOW}⚠${NC}  Frontend cleanup is in dry-run mode"
echo "   Remove comment markers to apply changes"

echo ""
echo "Phase 4: Cleanup Summary"
echo "------------------------"

echo "📊 Found $CHANGES files that need cleanup"
echo ""
echo "Next Steps:"
echo "1. Review CODEBASE_CLEANUP_REPORT.md for detailed breakdown"
echo "2. Test the backup files have been created"
echo "3. Edit this script to uncomment the actual cleanup commands"
echo "4. Run the script again to apply changes"
echo "5. Test your application thoroughly"
echo "6. Commit changes with message: 'chore: remove debug statements and test code'"
echo ""
echo "To restore from backups:"
echo "  find . -name '*.backup' -exec bash -c 'mv \"\$0\" \"\${0%.backup}\"' {} \\;"
echo ""
echo -e "${GREEN}✓${NC} Cleanup analysis complete!"
