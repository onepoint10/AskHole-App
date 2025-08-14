import React, { useEffect, useRef } from 'react';
import { Edit3, Trash2 } from 'lucide-react';

const ContextMenu = ({ isVisible, position, onRename, onDelete, onClose }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[150px]"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
        onClick={onRename}
      >
        <Edit3 className="h-4 w-4" />
        Rename
      </button>
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 hover:text-destructive flex items-center gap-2"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
};

export default ContextMenu;