import { useState, useCallback } from 'react';

interface DragAndDropState {
  isDragging: boolean;
  draggedEmailIds: string[];
  dropTargetCategory: string | null;
}

interface DragAndDropCallbacks {
  onMoveToSmartCategory: (emailIds: string[], category: string) => void;
  onMoveToFolder: (emailIds: string[], folder: string) => void;
}

interface UseDragAndDropReturn {
  isDragging: boolean;
  draggedEmailIds: string[];
  dropTargetCategory: string | null;
  onEmailDragStart: (emailId: string, selectedIds: Set<string>, event: React.DragEvent) => void;
  onCategoryDragOver: (categoryName: string, event: React.DragEvent) => void;
  onCategoryDragLeave: (event: React.DragEvent) => void;
  onCategoryDrop: (categoryName: string, categoryType: string, event: React.DragEvent) => void;
  onDragEnd: () => void;
}

export const useDragAndDrop = (callbacks: DragAndDropCallbacks): UseDragAndDropReturn => {
  const [state, setState] = useState<DragAndDropState>({
    isDragging: false,
    draggedEmailIds: [],
    dropTargetCategory: null,
  });

  const onEmailDragStart = useCallback(
    (emailId: string, selectedIds: Set<string>, event: React.DragEvent) => {
      const ids = selectedIds.has(emailId) ? Array.from(selectedIds) : [emailId];

      event.dataTransfer.setData('application/json', JSON.stringify(ids));
      event.dataTransfer.effectAllowed = 'move';

      // Create custom drag image showing count
      if (ids.length > 1) {
        const dragImage = document.createElement('div');
        dragImage.textContent = `${ids.length} emails`;
        dragImage.style.cssText =
          'position:absolute;top:-1000px;padding:8px 12px;background:#3b82f6;color:white;border-radius:6px;font-size:13px;font-weight:500;';
        document.body.appendChild(dragImage);
        event.dataTransfer.setDragImage(dragImage, 0, 0);
        setTimeout(() => document.body.removeChild(dragImage), 0);
      }

      setState({
        isDragging: true,
        draggedEmailIds: ids,
        dropTargetCategory: null,
      });
    },
    []
  );

  const onCategoryDragOver = useCallback((categoryName: string, event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setState((prev) => ({
      ...prev,
      dropTargetCategory: categoryName,
    }));
  }, []);

  const onCategoryDragLeave = useCallback((event: React.DragEvent) => {
    const relatedTarget = event.relatedTarget as Node | null;
    const currentTarget = event.currentTarget as Node;

    // Only clear if leaving the container entirely, not entering a child
    if (relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    setState((prev) => ({
      ...prev,
      dropTargetCategory: null,
    }));
  }, []);

  const onCategoryDrop = useCallback(
    (categoryName: string, categoryType: string, event: React.DragEvent) => {
      event.preventDefault();

      let emailIds: string[] = [];
      try {
        const data = event.dataTransfer.getData('application/json');
        emailIds = JSON.parse(data);
      } catch {
        // Invalid drag data, ignore
        return;
      }

      if (emailIds.length === 0) return;

      if (categoryType === 'folder') {
        callbacks.onMoveToFolder(emailIds, categoryName);
      } else {
        callbacks.onMoveToSmartCategory(emailIds, categoryName);
      }

      setState({
        isDragging: false,
        draggedEmailIds: [],
        dropTargetCategory: null,
      });
    },
    [callbacks]
  );

  const onDragEnd = useCallback(() => {
    setState({
      isDragging: false,
      draggedEmailIds: [],
      dropTargetCategory: null,
    });
  }, []);

  return {
    isDragging: state.isDragging,
    draggedEmailIds: state.draggedEmailIds,
    dropTargetCategory: state.dropTargetCategory,
    onEmailDragStart,
    onCategoryDragOver,
    onCategoryDragLeave,
    onCategoryDrop,
    onDragEnd,
  };
};
