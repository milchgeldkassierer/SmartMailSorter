import { useCallback } from 'react';

interface UseSavedFiltersReturn {
  saveFilter: (id: string, name: string, query: string) => Promise<void>;
  deleteFilter: (id: string) => Promise<void>;
}

export const useSavedFilters = (): UseSavedFiltersReturn => {
  // Save or update a filter
  const saveFilter = useCallback(async (id: string, name: string, query: string) => {
    // Note: Duplicate check should be done by the caller
    if (window.electron) {
      try {
        await window.electron.saveFilter(id, name, query);
      } catch (error) {
        console.error('Failed to save filter:', error);
        throw error;
      }
    }
  }, []);

  // Delete a filter
  const deleteFilter = useCallback(async (id: string) => {
    if (window.electron) {
      try {
        await window.electron.deleteFilter(id);
      } catch (error) {
        console.error('Failed to delete filter:', error);
        throw error;
      }
    }
  }, []);

  return {
    saveFilter,
    deleteFilter,
  };
};
