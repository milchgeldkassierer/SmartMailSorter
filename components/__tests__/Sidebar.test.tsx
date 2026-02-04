import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../Sidebar';
import { ImapAccount, DefaultEmailCategory } from '../../types';

describe('Sidebar', () => {
  const mockAccounts: ImapAccount[] = [
    {
      id: 'acc-1',
      name: 'Work Account',
      email: 'work@example.com',
      color: 'blue',
      storageUsed: 512 * 1024, // 512 KB
      storageTotal: 1024 * 1024 * 1024, // 1 GB
    },
    {
      id: 'acc-2',
      name: 'Personal Account',
      email: 'personal@example.com',
      color: 'green',
      storageUsed: 256 * 1024,
      storageTotal: 2 * 1024 * 1024 * 1024,
    },
  ];

  const mockCategories = [
    { name: 'Posteingang', type: 'system' },
    { name: 'Gesendet', type: 'system' },
    { name: 'Spam', type: 'system' },
    { name: 'Papierkorb', type: 'system' },
    { name: 'Rechnungen', type: 'custom' },
    { name: 'Newsletter', type: 'custom' },
    { name: 'Meine Projekte', type: 'custom' }, // Truly custom category for context menu tests
    { name: 'Work/Projects', type: 'folder' },
  ];

  const mockCounts: Record<string, number> = {
    Posteingang: 25,
    Gesendet: 10,
    Spam: 5,
    Rechnungen: 3,
    Newsletter: 12,
    Sonstiges: 7,
  };

  const defaultProps = {
    selectedCategory: 'Posteingang',
    onSelectCategory: vi.fn(),
    onAddCategory: vi.fn(),
    categories: mockCategories,
    counts: mockCounts,
    isProcessing: false,
    onReset: vi.fn(),
    accounts: mockAccounts,
    activeAccountId: 'acc-1',
    onSwitchAccount: vi.fn(),
    onOpenSettings: vi.fn(),
    onDeleteCategory: vi.fn(),
    onRenameCategory: vi.fn(),
    onUpdateIcon: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the sidebar container', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Ordner')).toBeInTheDocument();
    });

    it('should render all standard folder categories', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Posteingang')).toBeInTheDocument();
      expect(screen.getByText('Gesendet')).toBeInTheDocument();
      expect(screen.getByText('Spam')).toBeInTheDocument();
      expect(screen.getByText('Papierkorb')).toBeInTheDocument();
    });

    it('should render smart categories section', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Intelligentes Postfach')).toBeInTheDocument();
    });

    it('should render AI categories', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('KI Kategorien')).toBeInTheDocument();
      expect(screen.getByText('Rechnungen')).toBeInTheDocument();
      expect(screen.getByText('Newsletter')).toBeInTheDocument();
    });

    it('should render "Sonstiges" category', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Sonstiges')).toBeInTheDocument();
    });

    it('should render category counts when greater than 0', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('25')).toBeInTheDocument(); // Posteingang count
      expect(screen.getByText('10')).toBeInTheDocument(); // Gesendet count
      expect(screen.getByText('5')).toBeInTheDocument(); // Spam count
    });

    it('should not render count for categories with 0 count', () => {
      render(<Sidebar {...defaultProps} />);
      // Papierkorb has no count defined, so 0 - should not show
      const countElements = screen.queryAllByText('0');
      expect(countElements).toHaveLength(0);
    });

    it('should render storage info in footer', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Speicher')).toBeInTheDocument();
    });

    it('should render logout button', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('should render settings button in footer', () => {
      render(<Sidebar {...defaultProps} />);
      const settingsButtons = screen.getAllByTitle('Einstellungen');
      expect(settingsButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Category Selection', () => {
    it('should highlight the selected category', () => {
      render(<Sidebar {...defaultProps} selectedCategory="Posteingang" />);
      const inboxButton = screen.getByRole('button', { name: /Posteingang/i });
      expect(inboxButton).toHaveClass('bg-blue-600');
    });

    it('should call onSelectCategory when clicking a standard folder', () => {
      const onSelectCategory = vi.fn();
      render(<Sidebar {...defaultProps} onSelectCategory={onSelectCategory} />);

      const gesendetButton = screen.getByRole('button', { name: /Gesendet/i });
      fireEvent.click(gesendetButton);

      expect(onSelectCategory).toHaveBeenCalledWith('Gesendet');
    });

    it('should call onSelectCategory when clicking Spam', () => {
      const onSelectCategory = vi.fn();
      render(<Sidebar {...defaultProps} onSelectCategory={onSelectCategory} />);

      const spamButton = screen.getByRole('button', { name: /Spam/i });
      fireEvent.click(spamButton);

      expect(onSelectCategory).toHaveBeenCalledWith('Spam');
    });

    it('should call onSelectCategory when clicking Papierkorb', () => {
      const onSelectCategory = vi.fn();
      render(<Sidebar {...defaultProps} onSelectCategory={onSelectCategory} />);

      const trashButton = screen.getByRole('button', { name: /Papierkorb/i });
      fireEvent.click(trashButton);

      expect(onSelectCategory).toHaveBeenCalledWith('Papierkorb');
    });

    it('should call onSelectCategory when clicking a smart category', () => {
      const onSelectCategory = vi.fn();
      render(<Sidebar {...defaultProps} onSelectCategory={onSelectCategory} />);

      const rechnungenItem = screen.getByText('Rechnungen');
      fireEvent.click(rechnungenItem);

      expect(onSelectCategory).toHaveBeenCalledWith('Rechnungen');
    });

    it('should call onSelectCategory when clicking Sonstiges', () => {
      const onSelectCategory = vi.fn();
      render(<Sidebar {...defaultProps} onSelectCategory={onSelectCategory} />);

      const sonstigesItem = screen.getByText('Sonstiges');
      fireEvent.click(sonstigesItem);

      expect(onSelectCategory).toHaveBeenCalledWith(DefaultEmailCategory.OTHER);
    });
  });

  describe('Account Switching', () => {
    it('should display active account name and email', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Work Account')).toBeInTheDocument();
      expect(screen.getByText('work@example.com')).toBeInTheDocument();
    });

    it('should display account initial in avatar', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('W')).toBeInTheDocument();
    });

    it('should not show account dropdown by default', () => {
      render(<Sidebar {...defaultProps} />);
      // The manage accounts button is only visible when dropdown is open
      expect(screen.queryByText('Konten verwalten')).not.toBeInTheDocument();
    });

    it('should show account dropdown when account button is clicked', () => {
      render(<Sidebar {...defaultProps} />);

      const accountButton = screen.getByText('Work Account').closest('button');
      fireEvent.click(accountButton!);

      expect(screen.getByText('Konten verwalten')).toBeInTheDocument();
      expect(screen.getByText('Personal Account')).toBeInTheDocument();
    });

    it('should hide account dropdown when clicked again', () => {
      render(<Sidebar {...defaultProps} />);

      const accountButton = screen.getByText('Work Account').closest('button');
      fireEvent.click(accountButton!);
      expect(screen.getByText('Konten verwalten')).toBeInTheDocument();

      fireEvent.click(accountButton!);
      expect(screen.queryByText('Konten verwalten')).not.toBeInTheDocument();
    });

    it('should call onSwitchAccount when selecting a different account', () => {
      const onSwitchAccount = vi.fn();
      render(<Sidebar {...defaultProps} onSwitchAccount={onSwitchAccount} />);

      const accountButton = screen.getByText('Work Account').closest('button');
      fireEvent.click(accountButton!);

      const personalAccountButton = screen.getByText('Personal Account');
      fireEvent.click(personalAccountButton);

      expect(onSwitchAccount).toHaveBeenCalledWith('acc-2');
    });

    it('should close dropdown after switching account', () => {
      const onSwitchAccount = vi.fn();
      render(<Sidebar {...defaultProps} onSwitchAccount={onSwitchAccount} />);

      const accountButton = screen.getByText('Work Account').closest('button');
      fireEvent.click(accountButton!);

      const personalAccountButton = screen.getByText('Personal Account');
      fireEvent.click(personalAccountButton);

      expect(screen.queryByText('Konten verwalten')).not.toBeInTheDocument();
    });

    it('should call onOpenSettings when clicking "Konten verwalten"', () => {
      const onOpenSettings = vi.fn();
      render(<Sidebar {...defaultProps} onOpenSettings={onOpenSettings} />);

      const accountButton = screen.getByText('Work Account').closest('button');
      fireEvent.click(accountButton!);

      const manageButton = screen.getByText('Konten verwalten');
      fireEvent.click(manageButton);

      expect(onOpenSettings).toHaveBeenCalled();
    });

    it('should close dropdown after clicking manage accounts', () => {
      render(<Sidebar {...defaultProps} />);

      const accountButton = screen.getByText('Work Account').closest('button');
      fireEvent.click(accountButton!);

      const manageButton = screen.getByText('Konten verwalten');
      fireEvent.click(manageButton);

      expect(screen.queryByText('Konten verwalten')).not.toBeInTheDocument();
    });

    it('should display "Kein Konto" when no active account', () => {
      render(<Sidebar {...defaultProps} accounts={[]} activeAccountId="" />);
      expect(screen.getByText('Kein Konto')).toBeInTheDocument();
      expect(screen.getByText('Bitte einrichten')).toBeInTheDocument();
    });

    it('should show all accounts in dropdown', () => {
      render(<Sidebar {...defaultProps} />);

      const accountButton = screen.getByText('Work Account').closest('button');
      fireEvent.click(accountButton!);

      // Both accounts should be visible in the dropdown
      // Work Account appears twice (header + dropdown item)
      const workAccountElements = screen.getAllByText('Work Account');
      expect(workAccountElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Personal Account')).toBeInTheDocument();
    });
  });

  describe('Context Menu', () => {
    it('should open context menu on right-click of a category item', () => {
      render(<Sidebar {...defaultProps} />);

      // Find the Rechnungen category item container (the parent div with onClick/onContextMenu)
      const rechnungenText = screen.getByText('Rechnungen');
      const categoryItem = rechnungenText.closest('div[class*="cursor-pointer"]');
      fireEvent.contextMenu(categoryItem!);

      // Context menu should show - look for the fixed positioned menu
      const contextMenu = document.querySelector('.fixed');
      expect(contextMenu).toBeInTheDocument();
    });

    it('should show category name in context menu header', () => {
      render(<Sidebar {...defaultProps} />);

      const rechnungenText = screen.getByText('Rechnungen');
      const categoryItem = rechnungenText.closest('div[class*="cursor-pointer"]');
      fireEvent.contextMenu(categoryItem!);

      // The context menu shows the category name as header
      const contextMenu = document.querySelector('.fixed');
      expect(contextMenu?.textContent).toContain('Rechnungen');
    });

    it('should show rename option for custom categories', () => {
      render(<Sidebar {...defaultProps} />);

      // Use 'Meine Projekte' - a truly custom category not in DefaultEmailCategory
      const customCategoryText = screen.getByText('Meine Projekte');
      const categoryItem = customCategoryText.closest('div[class*="cursor-pointer"]');
      fireEvent.contextMenu(categoryItem!);

      expect(screen.getByText('Umbenennen')).toBeInTheDocument();
    });

    it('should show delete option for custom categories', () => {
      render(<Sidebar {...defaultProps} />);

      // Use 'Meine Projekte' - a truly custom category not in DefaultEmailCategory
      const customCategoryText = screen.getByText('Meine Projekte');
      const categoryItem = customCategoryText.closest('div[class*="cursor-pointer"]');
      fireEvent.contextMenu(categoryItem!);

      expect(screen.getByText('Löschen')).toBeInTheDocument();
    });

    it('should show icon change option', () => {
      render(<Sidebar {...defaultProps} />);

      const rechnungenText = screen.getByText('Rechnungen');
      const categoryItem = rechnungenText.closest('div[class*="cursor-pointer"]');
      fireEvent.contextMenu(categoryItem!);

      expect(screen.getByText('Icon ändern')).toBeInTheDocument();
    });

    it('should close context menu on global click', async () => {
      render(<Sidebar {...defaultProps} />);

      // Use 'Meine Projekte' - a truly custom category not in DefaultEmailCategory
      const customCategoryText = screen.getByText('Meine Projekte');
      const categoryItem = customCategoryText.closest('div[class*="cursor-pointer"]');
      fireEvent.contextMenu(categoryItem!);

      // Verify context menu is open (has rename option for custom categories)
      expect(screen.getByText('Umbenennen')).toBeInTheDocument();

      // Trigger window click event to close (the component listens to window click)
      await act(async () => {
        window.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      // Context menu should be closed
      expect(screen.queryByText('Umbenennen')).not.toBeInTheDocument();
    });

    it('should not show rename/delete for default categories', () => {
      render(<Sidebar {...defaultProps} />);

      // Sonstiges is rendered via renderCategoryItem which has the context menu handler
      const sonstigesText = screen.getByText('Sonstiges');
      const categoryItem = sonstigesText.closest('div[class*="cursor-pointer"]');
      fireEvent.contextMenu(categoryItem!);

      // Default categories (Sonstiges = OTHER) should not have rename/delete options
      expect(screen.queryByText('Umbenennen')).not.toBeInTheDocument();
      expect(screen.queryByText('Löschen')).not.toBeInTheDocument();
      // But should still have icon change
      expect(screen.getByText('Icon ändern')).toBeInTheDocument();
    });
  });

  describe('Add Category', () => {
    it('should render add category button', () => {
      render(<Sidebar {...defaultProps} />);
      const addButton = screen.getByTitle('Neuen Ordner erstellen');
      expect(addButton).toBeInTheDocument();
    });

    it('should show input field when add button is clicked', () => {
      render(<Sidebar {...defaultProps} />);

      const addButton = screen.getByTitle('Neuen Ordner erstellen');
      fireEvent.click(addButton);

      const input = screen.getByPlaceholderText('Name...');
      expect(input).toBeInTheDocument();
    });

    it('should focus input when shown', () => {
      render(<Sidebar {...defaultProps} />);

      const addButton = screen.getByTitle('Neuen Ordner erstellen');
      fireEvent.click(addButton);

      const input = screen.getByPlaceholderText('Name...');
      expect(document.activeElement).toBe(input);
    });

    it('should call onAddCategory when form is submitted with valid name', () => {
      const onAddCategory = vi.fn();
      render(<Sidebar {...defaultProps} onAddCategory={onAddCategory} />);

      const addButton = screen.getByTitle('Neuen Ordner erstellen');
      fireEvent.click(addButton);

      const input = screen.getByPlaceholderText('Name...');
      fireEvent.change(input, { target: { value: 'New Category' } });

      // Submit the form
      const form = input.closest('form');
      fireEvent.submit(form!);

      expect(onAddCategory).toHaveBeenCalledWith('New Category');
    });

    it('should trim whitespace from category name', () => {
      const onAddCategory = vi.fn();
      render(<Sidebar {...defaultProps} onAddCategory={onAddCategory} />);

      const addButton = screen.getByTitle('Neuen Ordner erstellen');
      fireEvent.click(addButton);

      const input = screen.getByPlaceholderText('Name...');
      fireEvent.change(input, { target: { value: '  Trimmed Category  ' } });

      const form = input.closest('form');
      fireEvent.submit(form!);

      expect(onAddCategory).toHaveBeenCalledWith('Trimmed Category');
    });

    it('should not call onAddCategory when name is empty', () => {
      const onAddCategory = vi.fn();
      render(<Sidebar {...defaultProps} onAddCategory={onAddCategory} />);

      const addButton = screen.getByTitle('Neuen Ordner erstellen');
      fireEvent.click(addButton);

      const input = screen.getByPlaceholderText('Name...');
      fireEvent.change(input, { target: { value: '' } });

      const form = input.closest('form');
      fireEvent.submit(form!);

      expect(onAddCategory).not.toHaveBeenCalled();
    });

    it('should not call onAddCategory when name is only whitespace', () => {
      const onAddCategory = vi.fn();
      render(<Sidebar {...defaultProps} onAddCategory={onAddCategory} />);

      const addButton = screen.getByTitle('Neuen Ordner erstellen');
      fireEvent.click(addButton);

      const input = screen.getByPlaceholderText('Name...');
      fireEvent.change(input, { target: { value: '   ' } });

      const form = input.closest('form');
      fireEvent.submit(form!);

      expect(onAddCategory).not.toHaveBeenCalled();
    });

    it('should hide input after successful submission', () => {
      const onAddCategory = vi.fn();
      render(<Sidebar {...defaultProps} onAddCategory={onAddCategory} />);

      const addButton = screen.getByTitle('Neuen Ordner erstellen');
      fireEvent.click(addButton);

      const input = screen.getByPlaceholderText('Name...');
      fireEvent.change(input, { target: { value: 'New Category' } });

      const form = input.closest('form');
      fireEvent.submit(form!);

      expect(screen.queryByPlaceholderText('Name...')).not.toBeInTheDocument();
    });

    it('should clear input value after successful submission', () => {
      const onAddCategory = vi.fn();
      render(<Sidebar {...defaultProps} onAddCategory={onAddCategory} />);

      // First submission
      const addButton = screen.getByTitle('Neuen Ordner erstellen');
      fireEvent.click(addButton);

      let input = screen.getByPlaceholderText('Name...');
      fireEvent.change(input, { target: { value: 'First Category' } });

      let form = input.closest('form');
      fireEvent.submit(form!);

      // Click add button again
      fireEvent.click(addButton);

      // Input should be empty
      input = screen.getByPlaceholderText('Name...');
      expect(input).toHaveValue('');
    });
  });

  describe('Footer Actions', () => {
    it('should call onOpenSettings when settings button is clicked', () => {
      const onOpenSettings = vi.fn();
      render(<Sidebar {...defaultProps} onOpenSettings={onOpenSettings} />);

      const settingsButton = screen.getByTitle('Einstellungen');
      fireEvent.click(settingsButton);

      expect(onOpenSettings).toHaveBeenCalled();
    });

    it('should call onReset when logout button is clicked', () => {
      const onReset = vi.fn();
      render(<Sidebar {...defaultProps} onReset={onReset} />);

      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);

      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('Storage Visualization', () => {
    it('should display storage usage for active account', () => {
      render(<Sidebar {...defaultProps} />);
      // Storage display shows "MB / GB" format
      expect(screen.getByText(/MB/)).toBeInTheDocument();
    });

    it('should show "Unbekannt" when storage info is unavailable', () => {
      const accountWithoutStorage: ImapAccount = {
        id: 'acc-3',
        name: 'No Storage Account',
        email: 'nostorage@example.com',
        color: 'red',
      };

      render(<Sidebar {...defaultProps} accounts={[accountWithoutStorage]} activeAccountId="acc-3" />);

      expect(screen.getByText('Unbekannt')).toBeInTheDocument();
    });
  });

  describe('Physical Folders', () => {
    it('should render physical folders under inbox', () => {
      render(<Sidebar {...defaultProps} />);
      // Work/Projects is a physical folder
      expect(screen.getByText('Work/Projects')).toBeInTheDocument();
    });

    it('should call onSelectCategory when clicking a physical folder', () => {
      const onSelectCategory = vi.fn();
      render(<Sidebar {...defaultProps} onSelectCategory={onSelectCategory} />);

      const folderItem = screen.getByText('Work/Projects');
      fireEvent.click(folderItem);

      expect(onSelectCategory).toHaveBeenCalledWith('Work/Projects');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty categories array', () => {
      render(<Sidebar {...defaultProps} categories={[]} />);
      expect(screen.getByText('Ordner')).toBeInTheDocument();
      // Standard folders should still render
      expect(screen.getByText('Posteingang')).toBeInTheDocument();
    });

    it('should handle empty counts object', () => {
      render(<Sidebar {...defaultProps} counts={{}} />);
      // No count badges should be displayed
      const countElements = screen.queryAllByText(/^\d+$/);
      expect(countElements).toHaveLength(0);
    });

    it('should handle single account correctly', () => {
      render(<Sidebar {...defaultProps} accounts={[mockAccounts[0]]} activeAccountId="acc-1" />);

      const accountButton = screen.getByText('Work Account').closest('button');
      fireEvent.click(accountButton!);

      // Should still show manage accounts option
      expect(screen.getByText('Konten verwalten')).toBeInTheDocument();
    });

    it('should fall back to first account if activeAccountId not found', () => {
      render(<Sidebar {...defaultProps} activeAccountId="non-existent-id" />);
      // Should display first account (Work Account)
      expect(screen.getByText('Work Account')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons for categories', () => {
      render(<Sidebar {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have title attribute on add category button', () => {
      render(<Sidebar {...defaultProps} />);
      const addButton = screen.getByTitle('Neuen Ordner erstellen');
      expect(addButton).toHaveAttribute('title', 'Neuen Ordner erstellen');
    });

    it('should have title attribute on settings button', () => {
      render(<Sidebar {...defaultProps} />);
      const settingsButton = screen.getByTitle('Einstellungen');
      expect(settingsButton).toHaveAttribute('title', 'Einstellungen');
    });
  });
});
