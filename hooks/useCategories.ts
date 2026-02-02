import { useState, useCallback } from 'react';
import { Email, DefaultEmailCategory } from '../types';

interface Category {
  name: string;
  type: string;
}

interface UseCategoriesReturn {
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  loadCategories: () => Promise<void>;
  addCategory: (name: string, type?: string) => Promise<void>;
  updateCategoryType: (name: string, type: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
  renameCategory: (oldName: string, newName: string) => Promise<void>;
  autoDiscoverFolders: (emails: Email[]) => Promise<void>;
}

export const useCategories = (): UseCategoriesReturn => {
  const [categories, setCategories] = useState<Category[]>([]);

  // Load categories from backend
  const loadCategories = useCallback(async () => {
    if (window.electron) {
      try {
        const savedCategories = await window.electron.getCategories();
        setCategories(savedCategories);
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    }
  }, []);

  // Add a new category
  const addCategory = useCallback(async (name: string, type: string = 'custom') => {
    // Note: Duplicate check should be done by the caller
    // Optimistic UI update
    setCategories(prev => [...prev, { name, type }]);

    // Persist to backend
    if (window.electron) {
      try {
        await window.electron.addCategory(name, type);
      } catch (error) {
        console.error('Failed to add category:', error);
        // Revert optimistic update
        setCategories(prev => prev.filter(c => c.name !== name));
      }
    }
  }, []);

  // Update category type
  const updateCategoryType = useCallback(async (name: string, type: string) => {
    // Store old type for rollback
    const oldCategory = categories.find(c => c.name === name);

    // Optimistic UI update
    setCategories(prev =>
      prev.map(c => c.name === name ? { ...c, type } : c)
    );

    // Persist to backend
    if (window.electron) {
      try {
        await window.electron.updateCategoryType(name, type);
      } catch (error) {
        console.error('Failed to update category type:', error);
        // Revert optimistic update
        if (oldCategory) {
          setCategories(prev =>
            prev.map(c => c.name === name ? oldCategory : c)
          );
        }
      }
    }
  }, [categories]);

  // Delete a category
  const deleteCategory = useCallback(async (name: string) => {
    // Store old category for rollback
    const oldCategory = categories.find(c => c.name === name);

    // Optimistic UI update
    setCategories(prev => prev.filter(c => c.name !== name));

    // Persist to backend
    if (window.electron) {
      try {
        await window.electron.deleteSmartCategory(name);
      } catch (error) {
        console.error('Failed to delete category:', error);
        // Revert optimistic update
        if (oldCategory) {
          setCategories(prev => [...prev, oldCategory]);
        }
      }
    }
  }, [categories]);

  // Rename a category
  const renameCategory = useCallback(async (oldName: string, newName: string) => {
    // Optimistic UI update
    setCategories(prev =>
      prev.map(c => c.name === oldName ? { ...c, name: newName } : c)
    );

    // Persist to backend
    if (window.electron) {
      try {
        await window.electron.renameSmartCategory({ oldName, newName });
      } catch (error) {
        console.error('Failed to rename category:', error);
        // Revert optimistic update
        setCategories(prev =>
          prev.map(c => c.name === newName ? { ...c, name: oldName } : c)
        );
      }
    }
  }, []);

  // Auto-discover physical folders from emails
  const autoDiscoverFolders = useCallback(async (emails: Email[]) => {
    const systemFolders = Object.values(DefaultEmailCategory);
    const mappedFolders = ['Gesendet', 'Spam', 'Papierkorb', 'Posteingang'];

    const foundFolders = new Set<string>();
    const categoriesToFix = new Set<string>();

    // Create quick lookup structures
    const existingCategoryNames = new Set(categories.map(c => c.name));
    const existingCategoryTypes = new Map(categories.map(c => [c.name, c.type]));

    // Scan emails for physical folders
    emails.forEach(e => {
      if (e.folder &&
        !systemFolders.includes(e.folder as any) &&
        !mappedFolders.includes(e.folder)
      ) {
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

    // Reload categories if changes occurred
    if (newDiscovered.length > 0 || fixedCategories.length > 0) {
      await loadCategories();
    }
  }, [categories, addCategory, updateCategoryType, loadCategories]);

  return {
    categories,
    setCategories,
    loadCategories,
    addCategory,
    updateCategoryType,
    deleteCategory,
    renameCategory,
    autoDiscoverFolders
  };
};
