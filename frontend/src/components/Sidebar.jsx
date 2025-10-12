import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Database,
  History,
  Plus,
  BookPlus,
  MessageCirclePlus,
  Search,
  Trash2,
  Edit3,
  Star,
  Tag,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LogOut,
  Globe,
  User,
  Heart,
  Github,
  Shield,
  X // Import X icon
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
import CustomLogo from './CustomLogo';
import InlineEdit from './InlineEdit';
import PromptDialog from './PromptDialog';
import PublicPromptsLibrary from './PublicPromptsLibrary';
import { sessionsAPI, promptsAPI } from '@/services/api';

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
  onEditPrompt,
  onOpenSettings,
  onLogout,
  isMobileOverlay = false,
  onRequestClose,
  isAdmin,
  onOpenAdmin
}) => {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState({ isVisible: false, position: { x: 0, y: 0 }, sessionId: null });
  const [promptContextMenu, setPromptContextMenu] = useState({ isVisible: false, position: { x: 0, y: 0 }, promptId: null });
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [activeTab, setActiveTab] = useState('history');
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState(''); // New state for tag filter
  const [searchResults, setSearchResults] = useState({ sessions: [], prompts: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ title: '', content: '', category: 'General', tags: '' });
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [isEditPromptDialogOpen, setIsEditPromptDialogOpen] = useState(false);
  const [isPublicPromptsOpen, setIsPublicPromptsOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState({ id: null, title: '', content: '', category: 'General', tags: '' });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isHoveringLogo, setIsHoveringLogo] = useState(false);

  // Public prompts state
  const [publicPrompts, setPublicPrompts] = useState([]);
  const [publicPromptsLoading, setPublicPromptsLoading] = useState(false);
  const [publicPromptsError, setPublicPromptsError] = useState(null);

  // Long press detection for mobile
  const longPressTimerRef = React.useRef(null);
  const longPressTriggeredRef = React.useRef(false);
  const touchStartPosRef = React.useRef({ x: 0, y: 0 });

  const startLongPress = (event, sessionId) => {
    longPressTriggeredRef.current = false;
    const touch = event.touches ? event.touches[0] : null;
    if (touch) {
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      const x = touch ? touch.clientX : 0;
      const y = touch ? touch.clientY : 0;
      setContextMenu({ isVisible: true, position: { x, y }, sessionId });
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const maybeCancelOnMove = (event) => {
    const touch = event.touches ? event.touches[0] : null;
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  };

  const loadPublicPrompts = async (search = '', tag = '') => {
    try {
      setPublicPromptsLoading(true);
      setPublicPromptsError(null);
      const response = await promptsAPI.getPublicPrompts({
        page: 1,
        per_page: 50,
        search: search.trim(),
        tag: tag.trim()
      });
      setPublicPrompts(response.data.prompts || []);
    } catch (error) {
      console.error('Failed to load public prompts for sidebar:', error);
      setPublicPromptsError(t('failed_to_load_public_prompts'));
      setPublicPrompts([]);
    } finally {
      setPublicPromptsLoading(false);
    }
  };

  // Calculate adaptive width based on content
  const calculateAdaptiveWidth = () => {
    if (isCollapsed) return 60;

    let maxWidth = 320;

    sessions.forEach(session => {
      if (session.model) {
        const estimatedWidth = 200 + session.model.length * 8 + 20;
        maxWidth = Math.max(maxWidth, Math.min(estimatedWidth, 500));
      }
    });

    return maxWidth;
  };

  React.useEffect(() => {
    const newWidth = calculateAdaptiveWidth();
    setSidebarWidth(newWidth);
  }, [sessions, isCollapsed]);

  // Enhanced search effect
  useEffect(() => {
    const searchContent = async () => {
      if (!searchTerm.trim() && !tagFilter) {
        setSearchResults({ sessions: [], prompts: [] });
        if (activeTab === 'public') {
          loadPublicPrompts(); // Load all public prompts if no search or tag filter
        }
        return;
      }

      setIsSearching(true);
      try {
        if (activeTab === 'public') {
          setPublicPromptsLoading(false);
        } else {
          const response = await sessionsAPI.searchContent(searchTerm);
          setSearchResults(response.data || { sessions: [], prompts: [] });
        }
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults({ sessions: [], prompts: [] });
        if (activeTab === 'public') {
          setPublicPromptsError(t('search_failed'));
          setPublicPrompts([]);
        }
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchContent, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, activeTab, t]); // Added t to dependency array

  // Effect for loading public prompts when activeTab is 'public' or tagFilter changes
  useEffect(() => {
    if (activeTab === 'public') {
      const timeoutId = setTimeout(() => {
        loadPublicPrompts(searchTerm, tagFilter);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [activeTab, searchTerm, tagFilter]);

  // Use search results when searching, otherwise use filtered local results
  const filteredSessions = searchTerm.trim() ?
    searchResults.sessions :
    (Array.isArray(sessions) ? sessions.filter(session =>
      session.title.toLowerCase().includes(searchTerm.toLowerCase())
    ) : []);

  const filteredPrompts = (Array.isArray(prompts) ? prompts.filter(prompt =>
    (searchTerm.trim() === '' ||
      prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prompt.content && prompt.content.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (prompt.category && prompt.category.toLowerCase().includes(searchTerm.toLowerCase()))
    ) &&
    (tagFilter === '' || (prompt.tags && prompt.tags.includes(tagFilter)))
  ) : []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return t('today');
    if (diffDays === 2) return t('yesterday');
    if (diffDays <= 7) return t('days_ago', { count: diffDays - 1 });
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
    if (isMobileOverlay && onRequestClose) {
      onRequestClose();
      return;
    }
    setIsCollapsed(!isCollapsed);
  };

  // Prompt context menu handlers
  const handlePromptContextMenu = (e, promptId) => {
    e.preventDefault();
    setPromptContextMenu({
      isVisible: true,
      position: { x: e.clientX, y: e.clientY },
      promptId
    });
  };

  const handleClosePromptContextMenu = () => {
    setPromptContextMenu({ isVisible: false, position: { x: 0, y: 0 }, promptId: null });
  };

  const beginEditPrompt = (prompt) => {
    if (!prompt) return;
    setEditingPrompt({
      id: prompt.id,
      title: prompt.title || '',
      category: prompt.category || 'General',
      content: prompt.content || '',
      tags: Array.isArray(prompt.tags) ? prompt.tags.join(', ') : (prompt.tags || ''),
      is_public: Boolean(prompt.is_public)
    });
    setIsEditPromptDialogOpen(true);
  };

  const handlePromptEditFromContext = () => {
    const prompt = prompts.find(p => p.id === promptContextMenu.promptId);
    beginEditPrompt(prompt);
    handleClosePromptContextMenu();
  };

  const handlePromptDeleteFromContext = () => {
    if (promptContextMenu.promptId) {
      onDeletePrompt(promptContextMenu.promptId);
    }
    handleClosePromptContextMenu();
  };

  const handleDocumentationClick = () => {
    window.open('http://askhole.ru:3000/', '_blank');
  };

  const handleGithubClick = () => {
    window.open('https://github.com/onepoint10/AskHole-App', '_blank');
  };

  const handleTagFilter = (tag) => {
    setTagFilter(tag);
    setSearchTerm(''); // Clear search term when tag changes
    setActiveTab(prev => prev === 'public' ? 'public' : 'prompts'); // Stay on current prompt tab
  };

  return (
    <div
      className="sidebar flex flex-col h-full border-r border-sidebar-border transition-all duration-300 ease-in-out relative"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Header */}
      <div className={`p-3 border-sidebar-border `}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-primary/90 transition-colors"
              onClick={toggleCollapse}
              onMouseEnter={() => setIsHoveringLogo(true)}
              onMouseLeave={() => setIsHoveringLogo(false)}
              title={isCollapsed ? t('expand_sidebar') : t('collapse_sidebar')}
            >
              {isHoveringLogo ? (
                isCollapsed ?
                  <ChevronRight className="h-4 w-4 text-primary-foreground" /> :
                  <ChevronLeft className="h-4 w-4 text-primary-foreground" />
              ) : (
                <CustomLogo className="h-7 w-7 text-primary-foreground" />
              )}
            </div>
            {!isCollapsed && (
              <h2 className={`text-lg text-sidebar-foreground whitespace-nowrap ${isMobileOverlay ? 'pl-3' : ''}`}>
                <span className="font-semibold">Ask</span>
                <span className="font-light">Hole</span>
              </h2>
            )}
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewSession}
                className="hover:bg-sidebar-accent flex-shrink-0"
                title={t('new_chat')}
              >
                <MessageCirclePlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPromptDialogOpen(true)}
                className="hover:bg-sidebar-accent flex-shrink-0"
                title={t('create_prompt')}
              >
                <BookPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSettings}
                className="hover:bg-sidebar-accent flex-shrink-0"
                title={t('settings')}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  localStorage.removeItem('askhole-tour-completed');
                  window.location.reload();
                }}
                className="hover:bg-sidebar-accent flex-shrink-0"
                title={t('restart_tour')}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenAdmin}
                  className="hover:bg-sidebar-accent flex-shrink-0"
                  title={t('admin_dashboard')}
                >
                  <Shield className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        {!isCollapsed && (
          <div className="flex p-1 bg-sidebar-accent rounded-3xl">
            <Button
              variant={activeTab === 'history' ? 'default' : 'ghost'}
              size="sm"
              className={`flex-1 rounded-3xl rounded-r-sm ${activeTab === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}
              onClick={() => setActiveTab('history')}
            >
              <History className="h-4 w-4 mr-1" />
              {t('history')}
            </Button>
            <Button
              variant={activeTab === 'prompts' ? 'default' : 'ghost'}
              size="sm"
              className={`flex-1 rounded-none ${activeTab === 'prompts' ? 'bg-background text-foreground shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}
              onClick={() => setActiveTab('prompts')}
            >
              <Database className="h-4 w-4 mr-1" />
              {t('prompts')}
            </Button>
            <Button
              variant={activeTab === 'public' ? 'default' : 'ghost'}
              size="sm"
              className={`flex-1 rounded-3xl rounded-l-sm ${activeTab === 'public' ? 'bg-background text-foreground shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}
              onClick={() => setActiveTab('public')}
            >
              <Globe className="h-4 w-4 mr-1" />
              {t('public')}
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
              onClick={() => {
                setActiveTab('history');
                setIsCollapsed(!isCollapsed);
              }}
              className="w-8 h-8 p-0"
              title={t('history')}
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTab === 'prompts' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setActiveTab('prompts');
                setIsCollapsed(!isCollapsed);
              }}
              className="w-8 h-8 p-0"
              title={t('prompts')}
            >
              <Database className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTab === 'public' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setActiveTab('public');
                setIsCollapsed(!isCollapsed);
              }}
              className="w-8 h-8 p-0"
              title={t('public_prompts')}
            >
              <Globe className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewSession}
              className="w-8 h-8 p-0 hover:bg-sidebar-accent"
              title={t('new_chat')}
            >
              <MessageCirclePlus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPromptDialogOpen(true)}
              className="w-8 h-10 80 hover:bg-sidebar-accent"
              title={t('create_prompt')}
            >
              <BookPlus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              className="w-8 h-8 p-0 hover:bg-sidebar-accent"
              title={t('settings')}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {/* Fixed Bottom Panel for Collapsed State */}
          <div className="border-sidebar-border p-2">
            <div className="flex flex-col items-center space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDocumentationClick}
                className="w-10 h-10 p-0 hover:bg-sidebar-accent"
                title={t('documentation')}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="w-10 h-10 p-0 mb-3 hover:bg-destructive/10 hover:text-destructive"
                title={t('logout')}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="p-3 border-sidebar-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search_tab', { tab: activeTab })}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-3xl bg-sidebar-accent border-sidebar-border focus:border-sidebar-primary"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:bg-transparent"
                  onClick={() => setSearchTerm('')}
                  title={t('clear_search')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {isSearching && !searchTerm && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 custom-scrollbar message-scroll-area">
            {activeTab === 'history' && (
              <div className="px-2 py-2 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-sidebar-foreground">{t('recent_chats')}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onNewSession}
                    className="hover:bg-sidebar-accent text-sidebar-foreground flex-shrink-0"
                    title={t('new_chat')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className="group flex items-center gap-0 p-2 rounded-lg hover:bg-sidebar-accent cursor-pointer transition-colors slide-in"
                    onClick={() => {
                      if (editingSessionId === session.id) return;
                      if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false;
                        return;
                      }
                      onSessionSelect(session.id);
                      if (isMobileOverlay && onRequestClose) onRequestClose();
                    }}
                    onContextMenu={(e) => handleContextMenu(e, session.id)}
                    onDoubleClick={() => handleDoubleClick(session.id)}
                    onTouchStart={(e) => startLongPress(e, session.id)}
                    onTouchEnd={() => cancelLongPress()}
                    onTouchCancel={() => cancelLongPress()}
                    onTouchMove={(e) => maybeCancelOnMove(e)}
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
                        {formatDate(session.updated_at)} • {session.message_count} {t('messages')}
                      </div>
                      {searchTerm.trim() && session.match_type && (
                        <div className="text-xs text-primary mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {session.match_type === 'title' ? t('title_match') : t('message_match')}
                          </Badge>
                          {session.match_type === 'message' && session.message_role && (
                            <span className="ml-2 text-muted-foreground">
                              {session.message_role}
                            </span>
                          )}
                        </div>
                      )}
                      {searchTerm.trim() && session.match_content && session.match_type === 'message' && (
                        <div className="text-xs text-muted-foreground mt-1 p-2 bg-sidebar-accent/50 rounded border-l-2 border-primary">
                          <div className="font-medium mb-1">{t('matched_content')}:</div>
                          <div className="line-clamp-3">{session.match_content}</div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {session.client_type}
                        </Badge>
                        <span
                          className="text-xs text-muted-foreground truncate min-w-0"
                          title={session.model}
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
                        title={t('delete_chat')}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {filteredSessions.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-6">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {searchTerm ? t('no_matching_chats_found') : t('no_chat_sessions_found')}
                    {!searchTerm && sessions.length === 0 && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onNewSession}
                          className="text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t('start_first_chat')}
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
                  <h3 className="text-sm font-medium text-sidebar-foreground">{t('prompt_library')}</h3>
                  {tagFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTagFilter('')}
                      className="hover:bg-sidebar-accent text-sidebar-foreground flex-shrink-0"
                      title={t('clear_tag_filter')}
                    >
                      <X className="h-4 w-4 mr-1" />
                      {tagFilter}
                    </Button>
                  )}
                </div>
                {filteredPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="group p-2 items-center gap-0 rounded-lg border border-sidebar-border hover:bg-sidebar-accent cursor-pointer transition-colors slide-in"
                    onClick={() => onUsePrompt(prompt)}
                    onContextMenu={(e) => handlePromptContextMenu(e, prompt.id)}
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
                          {prompt.is_public && (
                            <Badge variant="outline" className="text-xs">
                              <Globe className="h-2 w-2 mr-1" />
                              {t('public')}
                            </Badge>
                          )}
                          {prompt.usage_count && prompt.usage_count > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3" />
                              {prompt.usage_count}
                            </div>
                          )}
                        </div>
                        {searchTerm.trim() && prompt.match_type && (
                          <div className="text-xs text-primary mt-1">
                            <Badge variant="outline" className="text-xs">
                              {prompt.match_type === 'title' ? t('title_match') :
                                prompt.match_type === 'content' ? t('content_match') : t('category_match')}
                            </Badge>
                          </div>
                        )}
                        {searchTerm.trim() && prompt.match_content && prompt.match_type !== 'title' && (
                          <div className="text-xs text-muted-foreground mt-1 p-2 bg-sidebar-accent/50 rounded border-l-2 border-primary">
                            <div className="font-medium mb-1">{t('matched_content')}:</div>
                            <div className="line-clamp-3">{prompt.match_content}</div>
                          </div>
                        )}
                        {prompt.tags && Array.isArray(prompt.tags) && prompt.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {prompt.tags.slice(0, 3).map((tag, index) => (
                              <Badge
                                key={index}
                                variant={tagFilter === tag ? 'default' : 'outline'}
                                className="text-xs cursor-pointer hover:bg-accent"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTagFilter(tag);
                                }}
                              >
                                <Tag className="h-2 w-2 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            beginEditPrompt(prompt);
                          }}
                          title={t('edit_prompt')}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePrompt(prompt.id);
                          }}
                          title={t('delete_prompt')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredPrompts.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-6">
                    <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {searchTerm || tagFilter ? t('no_matching_prompts_found') : t('no_prompts_found')}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'public' && (
              <div className="px-3 py-2 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-sidebar-foreground">{t('public_prompts')}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPublicPromptsOpen(true)}
                    className="hover:bg-sidebar-accent text-sidebar-foreground flex-shrink-0"
                    title={t('browse_public_library')}
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                  {tagFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTagFilter('')}
                      className="hover:bg-sidebar-accent text-sidebar-foreground flex-shrink-0"
                      title={t('clear_tag_filter')}
                    >
                      <X className="h-4 w-4 mr-1" />
                      {tagFilter}
                    </Button>
                  )}
                </div>

                {publicPromptsLoading && (
                  <div className="text-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-xs text-muted-foreground">{t('loading_public_prompts')}</p>
                  </div>
                )}

                {publicPromptsError && (
                  <div className="text-center py-6">
                    <p className="text-xs text-red-500">{publicPromptsError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadPublicPrompts(searchTerm, tagFilter)}
                      className="mt-2 text-xs"
                    >
                      {t('retry')}
                    </Button>
                  </div>
                )}

                {!publicPromptsLoading && !publicPromptsError && publicPrompts.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-6">
                    <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {searchTerm || tagFilter ? t('no_matching_public_prompts_found') : t('no_public_prompts_available')}
                    {!searchTerm && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsPublicPromptsOpen(true)}
                          className="text-xs"
                        >
                          {t('browse_public_library')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {!publicPromptsLoading && publicPrompts.length > 0 && (
                  <>
                    {publicPrompts.map((prompt) => (
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
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                <span className="truncate">{prompt.author || t('unknown')}</span>
                              </div>
                              {prompt.likes_count > 0 && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Heart className="h-3 w-3" />
                                  {prompt.likes_count}
                                </div>
                              )}
                            </div>
                            {prompt.tags && Array.isArray(prompt.tags) && prompt.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {prompt.tags.slice(0, 2).map((tag, index) => (
                                  <Badge
                                    key={index}
                                    variant={tagFilter === tag ? 'default' : 'outline'}
                                    className="text-xs cursor-pointer hover:bg-accent"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTagFilter(tag);
                                    }}
                                  >
                                    <Tag className="h-2 w-2 mr-1" />
                                    {tag}
                                  </Badge>
                                ))}
                                {prompt.tags.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{prompt.tags.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {publicPrompts.length >= 50 && (
                      <div className="text-center py-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsPublicPromptsOpen(true)}
                          className="text-xs"
                        >
                          {t('view_all_public_prompts')}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Fixed Bottom Panel for Expanded State */}
          <div className="border-sidebar-border p-3 bg-sidebar-accent rounded-t-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDocumentationClick}
                  className="hover:bg-sidebar-accent flex-shrink-0"
                  title={t('documentation')}
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
                onClick={handleGithubClick}
                className="hover:bg-sidebar-accent flex-shrink-0"
                title={t('github')}
              >
                <Github className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                title={t('logout')}
              >
                <LogOut className="h-4 w-4" />
                <span className="ml-1 text-xs">{t('logout')}</span>
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Context Menus and Dialogs */}
      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        onRename={handleRename}
        onDelete={handleDelete}
        onClose={handleCloseContextMenu}
      />

      <PromptDialog
        isOpen={isPromptDialogOpen}
        onClose={setIsPromptDialogOpen}
        onCreate={(promptData) => {
          onNewPrompt(promptData);
          setIsPromptDialogOpen(false);
        }}
        editMode={false}
      />

      <PromptDialog
        isOpen={isEditPromptDialogOpen}
        onClose={setIsEditPromptDialogOpen}
        onCreate={(updatedPrompt) => {
          if (editingPrompt.id) {
            onEditPrompt(editingPrompt.id, updatedPrompt);
          }
          setIsEditPromptDialogOpen(false);
        }}
        editMode={true}
        initialPrompt={editingPrompt}
      />

      <Dialog open={isPublicPromptsOpen} onOpenChange={setIsPublicPromptsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <PublicPromptsLibrary
            onUsePrompt={onUsePrompt}
            onClose={() => setIsPublicPromptsOpen(false)}
            initialTagFilter={tagFilter} // Pass the current tagFilter from Sidebar
          />
        </DialogContent>
      </Dialog>

      <ContextMenu
        isVisible={promptContextMenu.isVisible}
        position={promptContextMenu.position}
        onRename={handlePromptEditFromContext}
        onDelete={handlePromptDeleteFromContext}
        onClose={handleClosePromptContextMenu}
        deleteLabel={t('delete_prompt')}
        renameLabel={t('edit')}
      />
    </div>
  );
};

export default Sidebar;