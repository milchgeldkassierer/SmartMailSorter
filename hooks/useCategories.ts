import { useCallback } from 'react';
import { Email, Category, SYSTEM_FOLDERS } from '../types';

interface UseCategoriesReturn {
  addCategory: (name: string, type?: string) => Promise<void>;
  updateCategoryType: (name: string, type: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
  renameCategory: (oldName: string, newName: string) => Promise<void>;
  autoDiscoverFolders: (emails: Email[], currentCategories: Category[]) => Promise<void>;
}

export const useCategories = (): UseCategoriesReturn => {
  // Add a new category
  const addCategory = useCallback(async (name: string, type: string = 'custom') => {
    // Note: Duplicate check should be done by the caller
    if (window.electron) {
      try {
        await window.electron.addCategory(name, type);
      } catch (error) {
        console.error('Failed to add category:', error);
        throw error;
      }
    }
  }, []);

  // Update category type
  const updateCategoryType = useCallback(async (name: string, type: string) => {
    if (window.electron) {
      try {
        await window.electron.updateCategoryType(name, type);
      } catch (error) {
        console.error('Failed to update category type:', error);
        throw error;
      }
    }
  }, []);

  // Delete a category
  const deleteCategory = useCallback(async (name: string) => {
    if (window.electron) {
      try {
        await window.electron.deleteSmartCategory(name);
      } catch (error) {
        console.error('Failed to delete category:', error);
        throw error;
      }
    }
  }, []);

  // Rename a category
  const renameCategory = useCallback(async (oldName: string, newName: string) => {
    if (window.electron) {
      try {
        await window.electron.renameSmartCategory({ oldName, newName });
      } catch (error) {
        console.error('Failed to rename category:', error);
        throw error;
      }
    }
  }, []);

  // Auto-discover physical folders from emails
  const autoDiscoverFolders = useCallback(
    async (emails: Email[], currentCategories: Category[]) => {
      const systemFolders = SYSTEM_FOLDERS;

      const foundFolders = new Set<string>();
      const categoriesToFix = new Set<string>();

      // Create quick lookup structures
      const existingCategoryNames = new Set(currentCategories.map((c) => c.name));
      const existingCategoryTypes = new Map(currentCategories.map((c) => [c.name, c.type]));

      // Scan emails for physical folders
      emails.forEach((e) => {
        if (e.folder && !systemFolders.includes(e.folder)) {
          // It's a physical folder candidate
          if (!existingCategoryNames.has(e.folder)) {
            foundFolders.add(e.folder);
          } else {
            // Check if type needs correction (from 'custom' to 'folder')
            if (existingCategoryTypes.get(e.folder) === 'custom') {
              categoriesToFix.add(e.folder);
            }
          }
        }
      });

      // Add newly discovered folders
      const newDiscovered = Array.from(foundFolders);
      for (const folder of newDiscovered) {
        await addCategory(folder, 'folder');
      }

      // Fix incorrect types for existing physical folders
      const fixedCategories = Array.from(categoriesToFix);
      for (const folder of fixedCategories) {
        await updateCategoryType(folder, 'folder');
      }
    },
    [addCategory, updateCategoryType]
  );

  return {
    addCategory,
    updateCategoryType,
    deleteCategory,
    renameCategory,
    autoDiscoverFolders,
  };
};
