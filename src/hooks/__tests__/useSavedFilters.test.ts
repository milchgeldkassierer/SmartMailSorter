// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSavedFilters } from '../useSavedFilters';

// Mock window.electron
const mockSaveFilter = vi.fn();
const mockDeleteFilter = vi.fn();

(window as unknown as Record<string, unknown>).electron = {
  saveFilter: mockSaveFilter,
  deleteFilter: mockDeleteFilter,
};

describe('useSavedFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveFilter.mockResolvedValue(undefined);
    mockDeleteFilter.mockResolvedValue(undefined);
  });

  describe('Initial State', () => {
    it('should provide all required functions', () => {
      const { result } = renderHook(() => useSavedFilters());
      expect(result.current).toHaveProperty('saveFilter');
      expect(result.current).toHaveProperty('deleteFilter');
      expect(typeof result.current.saveFilter).toBe('function');
      expect(typeof result.current.deleteFilter).toBe('function');
    });
  });

  describe('saveFilter', () => {
    it('should call window.electron.saveFilter with correct parameters', async () => {
      const { result } = renderHook(() => useSavedFilters());

      await act(async () => {
        await result.current.saveFilter('filter-1', 'Amazon Invoices', 'from:amazon category:Rechnungen');
      });

      expect(mockSaveFilter).toHaveBeenCalledTimes(1);
      expect(mockSaveFilter).toHaveBeenCalledWith('filter-1', 'Amazon Invoices', 'from:amazon category:Rechnungen');
    });

    it('should save filter with different id and name', async () => {
      const { result } = renderHook(() => useSavedFilters());

      await act(async () => {
        await result.current.saveFilter(
          'filter-2',
          'Newsletter with Attachments',
          'category:Newsletter has:attachment'
        );
      });

      expect(mockSaveFilter).toHaveBeenCalledWith(
        'filter-2',
        'Newsletter with Attachments',
        'category:Newsletter has:attachment'
      );
    });

    it('should handle multiple saves', async () => {
      const { result } = renderHook(() => useSavedFilters());

      await act(async () => {
        await result.current.saveFilter('filter-1', 'Filter One', 'query1');
      });

      await act(async () => {
        await result.current.saveFilter('filter-2', 'Filter Two', 'query2');
      });

      await act(async () => {
        await result.current.saveFilter('filter-3', 'Filter Three', 'query3');
      });

      expect(mockSaveFilter).toHaveBeenCalledTimes(3);
      expect(mockSaveFilter).toHaveBeenNthCalledWith(1, 'filter-1', 'Filter One', 'query1');
      expect(mockSaveFilter).toHaveBeenNthCalledWith(2, 'filter-2', 'Filter Two', 'query2');
      expect(mockSaveFilter).toHaveBeenNthCalledWith(3, 'filter-3', 'Filter Three', 'query3');
    });

    it('should handle save errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSaveFilter.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useSavedFilters());

      await expect(async () => {
        await act(async () => {
          await result.current.saveFilter('filter-1', 'Test Filter', 'test query');
        });
      }).rejects.toThrow('Save failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save filter:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should work when updating existing filter with same id', async () => {
      const { result } = renderHook(() => useSavedFilters());

      await act(async () => {
        await result.current.saveFilter('filter-1', 'Original Name', 'original query');
      });

      await act(async () => {
        await result.current.saveFilter('filter-1', 'Updated Name', 'updated query');
      });

      expect(mockSaveFilter).toHaveBeenCalledTimes(2);
      expect(mockSaveFilter).toHaveBeenNthCalledWith(1, 'filter-1', 'Original Name', 'original query');
      expect(mockSaveFilter).toHaveBeenNthCalledWith(2, 'filter-1', 'Updated Name', 'updated query');
    });
  });

  describe('deleteFilter', () => {
    it('should call window.electron.deleteFilter with correct id', async () => {
      const { result } = renderHook(() => useSavedFilters());

      await act(async () => {
        await result.current.deleteFilter('filter-1');
      });

      expect(mockDeleteFilter).toHaveBeenCalledTimes(1);
      expect(mockDeleteFilter).toHaveBeenCalledWith('filter-1');
    });

    it('should delete multiple filters', async () => {
      const { result } = renderHook(() => useSavedFilters());

      await act(async () => {
        await result.current.deleteFilter('filter-1');
      });

      await act(async () => {
        await result.current.deleteFilter('filter-2');
      });

      expect(mockDeleteFilter).toHaveBeenCalledTimes(2);
      expect(mockDeleteFilter).toHaveBeenNthCalledWith(1, 'filter-1');
      expect(mockDeleteFilter).toHaveBeenNthCalledWith(2, 'filter-2');
    });

    it('should handle delete errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDeleteFilter.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useSavedFilters());

      await expect(async () => {
        await act(async () => {
          await result.current.deleteFilter('filter-1');
        });
      }).rejects.toThrow('Delete failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete filter:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow of saving and deleting filters', async () => {
      const { result } = renderHook(() => useSavedFilters());

      // Save a filter
      await act(async () => {
        await result.current.saveFilter('filter-1', 'Test Filter', 'test query');
      });

      expect(mockSaveFilter).toHaveBeenCalledWith('filter-1', 'Test Filter', 'test query');

      // Update the filter
      await act(async () => {
        await result.current.saveFilter('filter-1', 'Updated Filter', 'updated query');
      });

      expect(mockSaveFilter).toHaveBeenCalledWith('filter-1', 'Updated Filter', 'updated query');

      // Delete the filter
      await act(async () => {
        await result.current.deleteFilter('filter-1');
      });

      expect(mockDeleteFilter).toHaveBeenCalledWith('filter-1');

      expect(mockSaveFilter).toHaveBeenCalledTimes(2);
      expect(mockDeleteFilter).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple filters independently', async () => {
      const { result } = renderHook(() => useSavedFilters());

      // Save multiple filters
      await act(async () => {
        await result.current.saveFilter('filter-1', 'Filter 1', 'query1');
        await result.current.saveFilter('filter-2', 'Filter 2', 'query2');
        await result.current.saveFilter('filter-3', 'Filter 3', 'query3');
      });

      expect(mockSaveFilter).toHaveBeenCalledTimes(3);

      // Delete one filter
      await act(async () => {
        await result.current.deleteFilter('filter-2');
      });

      expect(mockDeleteFilter).toHaveBeenCalledWith('filter-2');

      // Update another filter
      await act(async () => {
        await result.current.saveFilter('filter-1', 'Updated Filter 1', 'updated query1');
      });

      expect(mockSaveFilter).toHaveBeenCalledTimes(4);
    });
  });

  describe('Window Electron Availability', () => {
    it('should not throw when window.electron is undefined', async () => {
      const originalElectron = (window as unknown as Record<string, unknown>).electron;
      (window as unknown as Record<string, unknown>).electron = undefined;

      const { result } = renderHook(() => useSavedFilters());

      await act(async () => {
        await result.current.saveFilter('filter-1', 'Test', 'query');
      });

      await act(async () => {
        await result.current.deleteFilter('filter-1');
      });

      // Should not throw errors, just silently skip the operations
      expect(mockSaveFilter).not.toHaveBeenCalled();
      expect(mockDeleteFilter).not.toHaveBeenCalled();

      // Restore
      (window as unknown as Record<string, unknown>).electron = originalElectron;
    });
  });
});
