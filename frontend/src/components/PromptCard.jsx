import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Tag, User, Calendar, Eye } from 'lucide-react';
import { promptsAPI } from '@/services/api';

const PromptCard = ({ 
  prompt, 
  onUsePrompt, 
  showAuthor = true, 
  showLikes = true, 
  currentUser,
  onTagClick
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(prompt.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    // Check if user has liked this prompt
    const checkLikeStatus = async () => {
      if (!currentUser || !prompt.id) return;
      
      try {
        const response = await promptsAPI.getPromptLikeStatus(prompt.id);
        setIsLiked(response.data.is_liked);
      } catch (error) {
        console.error('Error checking like status:', error);
      }
    };

    checkLikeStatus();
  }, [prompt.id, currentUser]);

  const handleLike = async (e) => {
    e.stopPropagation(); // Prevent triggering the prompt use action
    
    if (!currentUser) {
      // Could show a login prompt here
      console.log('User must be logged in to like prompts');
      return;
    }

    if (isLiking) return; // Prevent double-clicking

    setIsLiking(true);
    const wasLiked = isLiked;
    const newLikedState = !wasLiked;
    const newLikesCount = wasLiked ? likesCount - 1 : likesCount + 1;

    // Optimistic update
    setIsLiked(newLikedState);
    setLikesCount(newLikesCount);

    try {
      await promptsAPI.likePrompt(prompt.id);
    } catch (error) {
      // Revert on error
      console.error('Error toggling like:', error);
      setIsLiked(wasLiked);
      setLikesCount(likesCount);
    } finally {
      setIsLiking(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleUsePrompt = () => {
    onUsePrompt(prompt);
  };

  return (
    <div className="group p-4 border border-sidebar-border rounded-lg hover:bg-sidebar-accent/50 transition-all duration-200 cursor-pointer">
      <div onClick={handleUsePrompt}>
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-base text-sidebar-foreground truncate">
              {prompt.title}
            </h3>
            {showAuthor && prompt.author && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <User className="h-3 w-3" />
                <span>by {prompt.author}</span>
                {prompt.created_at && (
                  <>
                    <span>•</span>
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(prompt.created_at)}</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          {showLikes && (
            <div className="flex items-center gap-2 ml-2">
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 px-2 hover:bg-red-50 hover:text-red-600 transition-colors ${
                  isLiked ? 'text-red-600 bg-red-50' : 'text-gray-400'
                }`}
                onClick={handleLike}
                disabled={isLiking}
                title={isLiked ? 'Unlike this prompt' : 'Like this prompt'}
              >
                <Heart 
                  className={`h-4 w-4 transition-all ${
                    isLiked ? 'fill-current' : ''
                  } ${isLiking ? 'animate-pulse' : ''}`} 
                />
                <span className="ml-1 text-xs font-medium">{likesCount}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Content Preview */}
        <div className="mb-3">
          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
            {prompt.content}
          </p>
        </div>

        {/* Metadata */}
        <div className="flex items-center flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            {prompt.category}
          </Badge>
          
          {prompt.tags && Array.isArray(prompt.tags) && prompt.tags.length > 0 && (
            <>
              {prompt.tags.slice(0, 3).map((tag, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs cursor-pointer hover:bg-accent" 
                  onClick={(e) => { 
                    e.stopPropagation(); // Prevent triggering the prompt use action
                    onTagClick?.(tag);
                  }}
                >
                  <Tag className="h-2 w-2 mr-1" />
                  {tag}
                </Badge>
              ))}
              {prompt.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{prompt.tags.length - 3} more
                </Badge>
              )}
            </>
          )}

          {prompt.usage_count && prompt.usage_count > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <Eye className="h-3 w-3" />
              <span>{prompt.usage_count} uses</span>
            </div>
          )}
        </div>

        {/* Hover actions */}
        <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-colors"
          >
            Use This Prompt
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PromptCard;