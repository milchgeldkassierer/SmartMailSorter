import React, { useState } from 'react';
import { Email } from '../types';

interface UseSelectionProps {
  filteredEmails: Email[];
  onSelectEmail: (id: string) => void;
}

interface UseSelectionReturn {
  selectedIds: Set<string>;
  handleSelection: (id: string, multi: boolean, range: boolean) => void;
  handleRowClick: (id: string, e: React.MouseEvent) => void;
  handleToggleSelection: (id: string, shiftKey?: boolean) => void;
  handleSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearSelection: () => void;
}

export const useSelection = ({ filteredEmails, onSelectEmail }: UseSelectionProps): UseSelectionReturn => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const handleSelection = (id: string, multi: boolean, range: boolean) => {
    let next = new Set(selectedIds);

    if (range && lastClickedId && filteredEmails.length > 0) {
      // Range Selection
      const currentIndex = filteredEmails.findIndex(e => e.id === id);
      const lastIndex = filteredEmails.findIndex(e => e.id === lastClickedId);

      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);
        const rangeIds = filteredEmails.slice(start, end + 1).map(e => e.id);
        rangeIds.forEach(rid => next.add(rid));
      }
    } else if (multi) {
      // Toggle Selection (Ctrl+Click)
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setLastClickedId(id);
    } else {
      // Single Selection or toggle via checkbox
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setLastClickedId(id);
    }
    setSelectedIds(next);
  };

  const handleRowClick = (id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      handleSelection(id, true, false);
    } else if (e.shiftKey) {
      window.getSelection()?.removeAllRanges();
      handleSelection(id, false, true);
    } else {
      onSelectEmail(id);
    }
  };

  const handleToggleSelection = (id: string, shiftKey: boolean = false) => {
    handleSelection(id, false, shiftKey);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedIds.size === filteredEmails.length && filteredEmails.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmails.map(e => e.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setLastClickedId(null);
  };

  return {
    selectedIds,
    handleSelection,
    handleRowClick,
    handleToggleSelection,
    handleSelectAll,
    clearSelection
  };
};
