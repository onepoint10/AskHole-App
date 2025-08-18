import React, { useState } from 'react';
import { 
  Settings, 
  Database, 
  History, 
  Plus, 
  Search,
  Trash2,
  Edit3,
  Star,
  Tag,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import ContextMenu from './ContextMenu';
import InlineEdit from './InlineEdit';

const Sidebar = ({ 
  sessions = [],
  prompts = [],
  currentUser,
  onSessionSelect, 
  onNewSession, 
  onDeleteSession,
  onRenameSession,
  onNewPrompt,
  onUsePrompt,
  onDeletePrompt,
  onOpenSettings,
  onLogout
}) => {
  const [contextMenu, setContextMenu] = useState({ isVisible: false, position: { x: 0, y: 0 }, sessionId: null });
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [activeTab, setActiveTab] = useState('history');
  const [searchTerm, setSearchTerm] = useState('');
  const [newPrompt, setNewPrompt] = useState({ title: '', content: '', category: 'General', tags: '' });
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default 320px (w-80)

  // Calculate adaptive width based on content
  const calculateAdaptiveWidth = () => {
    if (isCollapsed) return 60; // Collapsed width
    
    let maxWidth = 320; // Default width
    
    // Check session model names for required width
    sessions.forEach(session => {
      if (session.model) {
        // Estimate width needed: base width + text length * character width + padding for buttons
        const estimatedWidth = 200 + session.model.length * 8 + 100; // 100px for buttons
        maxWidth = Math.max(maxWidth, Math.min(estimatedWidth, 500)); // Cap at 500px
      }
    });
    
    return maxWidth;
  };

  // Update width when sessions change or collapse state changes
  React.useEffect(() => {
    const newWidth = calculateAdaptiveWidth();
    setSidebarWidth(newWidth);
  }, [sessions, isCollapsed]);

  // Filter sessions and prompts with safety checks
  const filteredSessions = Array.isArray(sessions) ? sessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const filteredPrompts = Array.isArray(prompts) ? prompts.filter(prompt =>
    prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prompt.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prompt.category.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const handleCreatePrompt = () => {
    if (newPrompt.title.trim() && newPrompt.content.trim()) {
      const tags = newPrompt.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      onNewPrompt({
        ...newPrompt,
        tags
      });
      setNewPrompt({ title: '', content: '', category: 'General', tags: '' });
      setIsPromptDialogOpen(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  // Context menu handlers
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

  const handleDelete = () => {
    onDeleteSession(contextMenu.sessionId);
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

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Handler for documentation link
  const handleDocumentationClick = () => {
    window.open('http://192.168.1.138:3000/', '_blank');
  };

  return (
    <div 
      className="sidebar flex flex-col h-full border-r border-sidebar-border transition-all duration-300 ease-in-out relative"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Collapse Toggle Button */}
      <div 
        className="absolute top-6 z-10"
        style={{ right: isCollapsed ? '-12px' : '-12px' }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={toggleCollapse}
          className="h-6 w-6 p-0 rounded-full border-sidebar-border bg-background hover:bg-sidebar-accent shadow-md"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? 
            <ChevronRight className="h-3 w-3" /> : 
            <ChevronLeft className="h-3 w-3" />
          }
        </Button>
      </div>

      {/* Header */}
      <div className="p-3 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-4 w-4 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <h2 className="text-lg font-semibold text-sidebar-foreground whitespace-nowrap">AskHole</h2>
            )}
          </div>
          {!isCollapsed && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onOpenSettings}
              className="hover:bg-sidebar-accent flex-shrink-0"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Tab Navigation */}
        {!isCollapsed && (
          <div className="flex bg-sidebar-accent rounded-lg p-1">
            <Button
              variant={activeTab === 'history' ? 'default' : 'ghost'}
              size="sm"
              className={`flex-1 ${activeTab === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}
              onClick={() => setActiveTab('history')}
            >
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
            <Button
              variant={activeTab === 'prompts' ? 'default' : 'ghost'}
              size="sm"
              className={`flex-1 ${activeTab === 'prompts' ? 'bg-background text-foreground shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}
              onClick={() => setActiveTab('prompts')}
            >
              <Database className="h-4 w-4 mr-1" />
              Prompts
            </Button>
          </div>
        )}
      </div>

      {isCollapsed ? (
        /* Collapsed State - Icon-only buttons */
        <div className="flex flex-col flex-1">
          <div className="flex flex-col items-center p-2 space-y-2 flex-1">
            <Button
              variant={activeTab === 'history' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('history')}
              className="w-10 h-10 p-0"
              title="History"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTab === 'prompts' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('prompts')}
              className="w-10 h-10 p-0"
              title="Prompts"
            >
              <Database className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onNewSession}
              className="w-10 h-10 p-0 hover:bg-sidebar-accent"
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onOpenSettings}
              className="w-10 h-10 p-0 hover:bg-sidebar-accent"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          
          {/* *** ADD THIS: Fixed Bottom Panel for Collapsed State *** */}
          <div className="border-t border-sidebar-border p-2 bg-background">
            <div className="flex flex-col items-center space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDocumentationClick}
                className="w-10 h-10 p-0 hover:bg-sidebar-accent"
                title="Documentation"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="w-10 h-10 p-0 hover:bg-destructive/10 hover:text-destructive"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="px-3 pb-3 border-b border-sidebar-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-sidebar-accent border-sidebar-border focus:border-sidebar-primary"
              />
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 custom-scrollbar">
            {activeTab === 'history' && (
              <div className="px-3 py-2 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-sidebar-foreground">Recent Chats</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onNewSession}
                    className="hover:bg-sidebar-accent text-sidebar-foreground flex-shrink-0"
                    title="New Chat"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className="group flex items-center gap-2 p-2 rounded-lg hover:bg-sidebar-accent cursor-pointer transition-colors slide-in"
                    onClick={() => editingSessionId !== session.id && onSessionSelect(session.id)}
                    onContextMenu={(e) => handleContextMenu(e, session.id)}
                    onDoubleClick={() => handleDoubleClick(session.id)}
                  >
                    <div className="flex-1 min-w-0">
                      {editingSessionId === session.id ? (
                        <InlineEdit
                          value={session.title}
                          onSave={(newTitle) => handleSaveRename(session.id, newTitle)}
                          onCancel={handleCancelRename}
                          className="mb-1"
                        />
                      ) : (
                        <div className="font-medium text-sm truncate text-sidebar-foreground">{session.title}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDate(session.updated_at)} • {session.message_count} messages
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {session.client_type}
                        </Badge>
                        <span 
                          className="text-xs text-muted-foreground truncate min-w-0"
                          title={session.model} // Show full model name on hover
                        >
                          {session.model}
                        </span>
                      </div>
                    </div>
                    {editingSessionId !== session.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        title="Delete Chat"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {filteredSessions.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-6">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {searchTerm ? 'No matching chats found' : 'No chat sessions found'}
                    {!searchTerm && sessions.length === 0 && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onNewSession}
                          className="text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Start First Chat
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'prompts' && (
              <div className="px-3 py-2 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-sidebar-foreground">Prompt Library</h3>
                  <Dialog open={isPromptDialogOpen} onOpenChange={setIsPromptDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="hover:bg-sidebar-accent text-sidebar-foreground flex-shrink-0"
                        title="New Prompt"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create New Prompt</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="title">Title</Label>
                          <Input
                            id="title"
                            value={newPrompt.title}
                            onChange={(e) => setNewPrompt(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter prompt title"
                            className="focus-ring"
                          />
                        </div>
                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Input
                            id="category"
                            value={newPrompt.category}
                            onChange={(e) => setNewPrompt(prev => ({ ...prev, category: e.target.value }))}
                            placeholder="e.g., Writing, Coding, Analysis"
                            className="focus-ring"
                          />
                        </div>
                        <div>
                          <Label htmlFor="tags">Tags (comma-separated)</Label>
                          <Input
                            id="tags"
                            value={newPrompt.tags}
                            onChange={(e) => setNewPrompt(prev => ({ ...prev, tags: e.target.value }))}
                            placeholder="e.g., creative, technical, analysis"
                            className="focus-ring"
                          />
                        </div>
                        <div>
                          <Label htmlFor="content">Prompt Content</Label>
                          <Textarea
                            id="content"
                            value={newPrompt.content}
                            onChange={(e) => setNewPrompt(prev => ({ ...prev, content: e.target.value }))}
                            placeholder="Enter your prompt template..."
                            className="min-h-[100px] focus-ring"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleCreatePrompt} className="btn-primary flex-1">
                            Create Prompt
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setIsPromptDialogOpen(false)}
                            className="btn-secondary"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                {filteredPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="group p-2 rounded-lg border border-sidebar-border hover:bg-sidebar-accent cursor-pointer transition-colors slide-in"
                    onClick={() => onUsePrompt(prompt)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate text-sidebar-foreground">{prompt.title}</div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {prompt.content}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {prompt.category}
                          </Badge>
                          {prompt.usage_count > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3" />
                              {prompt.usage_count}
                            </div>
                          )}
                        </div>
                        {prompt.tags && prompt.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {prompt.tags.slice(0, 3).map((tag, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                <Tag className="h-2 w-2 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePrompt(prompt.id);
                        }}
                        title="Delete Prompt"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredPrompts.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-6">
                    <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {searchTerm ? 'No matching prompts found' : 'No prompts found'}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* *** ADD THIS: Fixed Bottom Panel for Expanded State *** */}
          <div className="border-t border-sidebar-border p-3 bg-background">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDocumentationClick}
                  className="hover:bg-sidebar-accent flex-shrink-0"
                  title="Documentation"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
                {currentUser && (
                  <span className="text-xs text-muted-foreground truncate">
                    {currentUser.username}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
                <span className="ml-1 text-xs">Log out</span>
              </Button>
            </div>
          </div>
        </>
      )}
      
      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        onRename={handleRename}
        onDelete={handleDelete}
        onClose={handleCloseContextMenu}
      />
    </div>
  );
};

export default Sidebar;