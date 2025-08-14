import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

const InlineEdit = ({ value, onSave, onCancel, className = "" }) => {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    setEditValue(value);
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [value]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editValue.trim() && editValue.trim() !== value) {
      onSave(editValue.trim());
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleBlur = () => {
    if (editValue.trim() && editValue.trim() !== value) {
      onSave(editValue.trim());
    } else {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="text-sm font-medium"
        autoFocus
      />
    </form>
  );
};

export default InlineEdit;