import React, { useState } from 'react';
import { X, Plus, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import ContextMenu from './ContextMenu';
import InlineEdit from './InlineEdit';
import { useTranslation } from 'react-i18next';

const ChatTabs = ({ 
  sessions = [], 
  activeSessionId, 
  onSessionSelect, 
  onNewSession, 
  onCloseTab,  // Renamed from onCloseSession to be more specific
  onRenameSession 
}) => {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState({ isVisible: false, position: { x: 0, y: 0 }, sessionId: null });
  const [editingSessionId, setEditingSessionId] = useState(null);

  const handleContextMenu = (e, sessionId) => {
    e.preventDefault();
    setContextMenu({
      isVisible: true,
      position: { x: e.clientX, y: e.clientY },
      sessionId: sessionId
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ isVisible: false, position: { x: 0, y: 0 }, sessionId: null });
  };

  const handleRename = () => {
    setEditingSessionId(contextMenu.sessionId);
    handleCloseContextMenu();
  };

  const handleCloseTab = () => {
    // Close tab only (don't delete/close session)
    onCloseTab(contextMenu.sessionId);
    handleCloseContextMenu();
  };

  const handleDoubleClick = (sessionId) => {
    setEditingSessionId(sessionId);
  };

  const handleSaveRename = (sessionId, newTitle) => {
    onRenameSession(sessionId, newTitle);
    setEditingSessionId(null);
  };

  const handleCancelRename = () => {
    setEditingSessionId(null);
  };

  return (
    <>
      <div className="flex items-center bg-muted/30 border-b">
        <ScrollArea className="flex-1">
          <div className="flex items-center">
            {Array.isArray(sessions) && sessions.length > 0 ? (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center min-w-0 max-w-48 border-r border-border/50 ${
                    activeSessionId === session.id
                      ? 'bg-background border-b-2 border-b-primary'
                      : 'bg-muted/20 hover:bg-muted/40'
                  }`}
                  onContextMenu={(e) => handleContextMenu(e, session.id)}
                >
                  {editingSessionId === session.id ? (
                    <div className="flex items-center gap-2 px-3 py-2 min-w-0 flex-1">
                      <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <InlineEdit
                        value={session.title || t('new_chat')}
                        onSave={(newTitle) => handleSaveRename(session.id, newTitle)}
                        onCancel={handleCancelRename}
                        className="flex-1 min-w-0"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => onSessionSelect(session.id)}
                      onDoubleClick={() => handleDoubleClick(session.id)}
                      className="flex items-center gap-2 px-3 py-2 min-w-0 flex-1 text-left"
                    >
                      <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">
                        {session.title || t('new_chat')}
                      </span>
                    </button>
                  )}
                  {sessions.length > 1 && editingSessionId !== session.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 mr-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(session.id);  // Close tab only, don't delete session
                      }}
                      title={t('close_tab')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))
            ) : (
              // FIXED: Show placeholder when no tabs are open
              <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
                <MessageSquare className="h-4 w-4" />
                <span>{t('no_active_chats')}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewSession}
              // You can keep mx-2 or change it to ml-2 for better alignment next to the last tab/placeholder
              className="flex-shrink-0 mx-2"
              title={t('new_chat')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </ScrollArea>
      </div>
      
      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        onRename={handleRename}
        onDelete={handleCloseTab}
        onClose={handleCloseContextMenu}
        deleteLabel={t('close_tab')}
      />
    </>
  );
};

export default ChatTabs;