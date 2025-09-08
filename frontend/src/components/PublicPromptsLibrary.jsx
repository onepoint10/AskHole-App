import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Search, User, Calendar, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { promptsAPI } from '@/services/api';

const PublicPromptsLibrary = ({ onUsePrompt, onClose }) => {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [likedPrompts, setLikedPrompts] = useState(new Set());

  const loadPublicPrompts = async (page = 1, search = '', category = '') => {
    try {
      setLoading(true);
      const response = await promptsAPI.getPublicPrompts({
        page,
        search,
        category,
        per_page: 12
      });
      
      setPrompts(response.data.prompts || []);
      setPagination(response.data.pagination || {});
      
      // Load like status for each prompt
      if (response.data.prompts && response.data.prompts.length > 0) {
        try {
          const likeStatusPromises = response.data.prompts.map(prompt => 
            promptsAPI.getPromptLikeStatus(prompt.id)
          );
          const likeStatuses = await Promise.all(likeStatusPromises);
          
          const likedSet = new Set();
          likeStatuses.forEach((status, index) => {
            if (status.data.liked) {
              likedSet.add(response.data.prompts[index].id);
            }
          });
          setLikedPrompts(likedSet);
        } catch (likeError) {
          console.warn('Could not load like statuses:', likeError);
        }
      }
      
    } catch (error) {
      console.error('Failed to load public prompts:', error);
      toast.error('Failed to load public prompts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublicPrompts(currentPage, searchQuery, categoryFilter);
  }, [currentPage]);

  const handleSearch = () => {
    setCurrentPage(1);
    loadPublicPrompts(1, searchQuery, categoryFilter);
  };

  const handleCategoryFilter = (category) => {
    setCategoryFilter(category);
    setCurrentPage(1);
    loadPublicPrompts(1, searchQuery, category);
  };

  const handleLike = async (promptId) => {
    try {
      const response = await promptsAPI.likePrompt(promptId);
      
      // Update local state
      setPrompts(prev => prev.map(prompt => 
        prompt.id === promptId 
          ? { ...prompt, likes_count: response.data.likes_count }
          : prompt
      ));
      
      // Update liked status
      setLikedPrompts(prev => {
        const newSet = new Set(prev);
        if (response.data.liked) {
          newSet.add(promptId);
        } else {
          newSet.delete(promptId);
        }
        return newSet;
      });
      
    } catch (error) {
      console.error('Failed to like prompt:', error);
      toast.error('Failed to like prompt');
    }
  };

  const handleUsePrompt = (prompt) => {
    onUsePrompt?.(prompt);
    onClose?.();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getUniqueCategories = () => {
    const categories = [...new Set(prompts.map(p => p.category))];
    return categories.filter(Boolean);
  };

  if (loading && prompts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading public prompts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header - Fixed */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold">Public Prompts Library</h2>
          <p className="text-muted-foreground">Discover and use prompts shared by the community</p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      {/* Search and Filters - Fixed */}
      <div className="space-y-4 flex-shrink-0 mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search prompts by title, content, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            Search
          </Button>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={categoryFilter === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleCategoryFilter('')}
            disabled={loading}
          >
            All Categories
          </Button>
          {getUniqueCategories().map(category => (
            <Button
              key={category}
              variant={categoryFilter === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCategoryFilter(category)}
              disabled={loading}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <ScrollArea className="flex-1 pr-4">
        {/* Prompts Grid */}
        {prompts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No public prompts found.</p>
            {searchQuery && (
              <p className="text-sm text-muted-foreground mt-2">
                Try adjusting your search terms or category filter.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
            {prompts.map((prompt) => (
              <Card key={prompt.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg line-clamp-2">{prompt.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <User className="h-3 w-3" />
                        <span className="truncate">{prompt.author}</span>
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(prompt.id)}
                      className={`ml-2 ${likedPrompts.has(prompt.id) ? 'text-red-500' : 'text-muted-foreground'}`}
                      disabled={loading}
                    >
                      <Heart className={`h-4 w-4 ${likedPrompts.has(prompt.id) ? 'fill-current' : ''}`} />
                      <span className="ml-1 text-xs">{prompt.likes_count || 0}</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                    {prompt.content}
                  </p>
                  
                  <div className="space-y-2">
                    {/* Category */}
                    <div className="flex items-center gap-2">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="secondary" className="text-xs">
                        {prompt.category}
                      </Badge>
                    </div>
                    
                    {/* Tags */}
                    {prompt.tags && prompt.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {prompt.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {prompt.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{prompt.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Date */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(prompt.created_at)}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => handleUsePrompt(prompt)}
                      className="flex-1"
                      disabled={loading}
                    >
                      Use Prompt
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={!pagination.has_prev || loading}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page || currentPage} of {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(pagination.pages, prev + 1))}
              disabled={!pagination.has_next || loading}
            >
              Next
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default PublicPromptsLibrary;