import { useCallback } from 'react';

interface UseSavedFiltersReturn {
  saveFilter: (id: string, name: string, query: string) => Promise<void>;
  deleteFilter: (id: string) => Promise<void>;
}

/** Hook for saving and deleting search filters via Electron IPC. */
export const useSavedFilters = (): UseSavedFiltersReturn => {
  // Save or update a filter
  const saveFilter = useCallback(async (id: string, name: string, query: string) => {
    if (!window.electron) {
      console.error('Electron bridge unavailable — cannot save filter');
      throw new Error('Electron bridge is not available');
    }
    try {
      await window.electron.saveFilter(id, name, query);
    } catch (error) {
      console.error('Failed to save filter:', error);
      throw error;
    }
  }, []);

  // Delete a filter
  const deleteFilter = useCallback(async (id: string) => {
    if (!window.electron) {
      console.error('Electron bridge unavailable — cannot delete filter');
      throw new Error('Electron bridge is not available');
    }
    try {
      await window.electron.deleteFilter(id);
    } catch (error) {
      console.error('Failed to delete filter:', error);
      throw error;
    }
  }, []);

  return {
    saveFilter,
    deleteFilter,
  };
};
