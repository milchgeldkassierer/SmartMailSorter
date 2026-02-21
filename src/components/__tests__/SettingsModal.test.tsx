import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsModal from '../SettingsModal';
import { ImapAccount, AISettings, LLMProvider } from '../../types';
import { DialogProvider } from '../../contexts/DialogContext';

// Helper to render with DialogProvider
const renderWithDialog = (ui: ReactElement) => render(<DialogProvider>{ui}</DialogProvider>);

describe('SettingsModal - Integration Tests', () => {
  const mockAccounts: ImapAccount[] = [
    {
      id: 'acc-1',
      name: 'Work Account',
      email: 'work@example.com',
      username: 'work@example.com',
      password: 'password123',
      provider: 'gmx',
      imapHost: 'imap.gmx.net',
      imapPort: 993,
      color: 'blue',
    },
    {
      id: 'acc-2',
      name: 'Personal',
      email: 'personal@gmail.com',
      username: 'personal@gmail.com',
      password: 'secret',
      provider: 'gmail',
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      color: 'green',
    },
  ];

  const mockAISettings: AISettings = {
    provider: LLMProvider.GEMINI,
    model: 'gemini-2.5-flash',
    apiKey: '',
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    accounts: mockAccounts,
    onAddAccount: vi.fn(),
    onRemoveAccount: vi.fn(),
    aiSettings: mockAISettings,
    onSaveAISettings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('should not render when isOpen is false', () => {
      renderWithDialog(<SettingsModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Einstellungen')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);
      expect(screen.getByText('Einstellungen')).toBeInTheDocument();
    });

    it('should render the close button', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);
      const header = screen.getByText('Einstellungen').parentElement;
      const closeButton = header?.querySelector('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);
      const header = screen.getByText('Einstellungen').parentElement;
      const closeButton = header?.querySelector('button');

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should render with backdrop overlay', () => {
      const { container } = renderWithDialog(<SettingsModal {...defaultProps} />);
      const backdrop = container.querySelector('.fixed.inset-0.z-50');
      expect(backdrop).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should render all three tab buttons', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);
      expect(screen.getByText('IMAP Konten')).toBeInTheDocument();
      expect(screen.getByText('Smart Sort')).toBeInTheDocument();
      expect(screen.getByText('Allgemein')).toBeInTheDocument();
    });

    it('should default to accounts tab', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);
      expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();
    });

    it('should highlight active tab (accounts by default)', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);
      const accountsTab = screen.getByText('IMAP Konten');
      expect(accountsTab).toHaveClass('bg-blue-100', 'text-blue-700');
    });

    it('should switch to Smart Sort tab when clicked', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      const smartSortTab = screen.getByText('Smart Sort');
      fireEvent.click(smartSortTab);

      // Verify Smart Sort content is displayed
      expect(screen.getByText('Smart Sort Konfiguration')).toBeInTheDocument();
      expect(screen.getByText('LLM Anbieter')).toBeInTheDocument();

      // Verify tab is highlighted
      expect(smartSortTab).toHaveClass('bg-blue-100', 'text-blue-700');
    });

    it('should switch to Allgemein tab when clicked', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      const generalTab = screen.getByText('Allgemein');
      fireEvent.click(generalTab);

      // Verify General content is displayed
      expect(screen.getByText('Datenverwaltung')).toBeInTheDocument();

      // Verify tab is highlighted
      expect(generalTab).toHaveClass('bg-blue-100', 'text-blue-700');
    });

    it('should switch back to accounts tab when clicked', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      // Switch to general tab
      fireEvent.click(screen.getByText('Allgemein'));
      expect(screen.getByText('Datenverwaltung')).toBeInTheDocument();

      // Switch back to accounts tab
      fireEvent.click(screen.getByText('IMAP Konten'));
      expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();

      // Verify accounts tab is highlighted
      const accountsTab = screen.getByText('IMAP Konten');
      expect(accountsTab).toHaveClass('bg-blue-100', 'text-blue-700');
    });

    it('should maintain separate state for each tab', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      // Start on accounts tab
      expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();

      // Switch to Smart Sort
      fireEvent.click(screen.getByText('Smart Sort'));
      expect(screen.getByText('Smart Sort Konfiguration')).toBeInTheDocument();

      // Switch to General
      fireEvent.click(screen.getByText('Allgemein'));
      expect(screen.getByText('Datenverwaltung')).toBeInTheDocument();

      // Switch back to accounts - should still show account list
      fireEvent.click(screen.getByText('IMAP Konten'));
      expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();
      expect(screen.getByText('Work Account')).toBeInTheDocument();
    });
  });

  describe('Tab Content Integration', () => {
    it('should pass accounts props to AccountsTab', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      // Verify accounts are displayed (AccountsTab receives props)
      expect(screen.getByText('Work Account')).toBeInTheDocument();
      expect(screen.getByText(/work@example\.com/)).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText(/personal@gmail\.com/)).toBeInTheDocument();
    });

    it('should pass handlers to AccountsTab', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      // Verify AccountsTab has necessary buttons (handlers are passed)
      expect(screen.getByText('Konto hinzufügen')).toBeInTheDocument();
    });

    it('should pass AI settings props to SmartSortTab', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      // Switch to Smart Sort tab
      fireEvent.click(screen.getByText('Smart Sort'));

      // Verify AI settings content is rendered (SmartSortTab receives props)
      expect(screen.getByText('Smart Sort Konfiguration')).toBeInTheDocument();
      expect(screen.getByText('LLM Anbieter')).toBeInTheDocument();
      expect(screen.getByText('Einstellungen speichern')).toBeInTheDocument();
    });

    it('should render GeneralTab content', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      // Switch to General tab
      fireEvent.click(screen.getByText('Allgemein'));

      // Verify General tab content is rendered
      expect(screen.getByText('Datenverwaltung')).toBeInTheDocument();
      expect(screen.getByText('Datenbank komplett zurücksetzen & neu starten')).toBeInTheDocument();
    });

    it('should update displayed accounts when accounts prop changes', () => {
      const { rerender } = renderWithDialog(<SettingsModal {...defaultProps} />);

      expect(screen.getByText('Work Account')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();

      // Update accounts
      const newAccounts = [mockAccounts[0]]; // Only first account
      rerender(
        <DialogProvider>
          <SettingsModal {...defaultProps} accounts={newAccounts} />
        </DialogProvider>
      );

      expect(screen.getByText('Work Account')).toBeInTheDocument();
      expect(screen.queryByText('Personal')).not.toBeInTheDocument();
    });
  });

  describe('Modal State', () => {
    it('should persist tab selection when modal stays open', () => {
      const { rerender } = renderWithDialog(<SettingsModal {...defaultProps} />);

      // Switch to General tab
      fireEvent.click(screen.getByText('Allgemein'));
      expect(screen.getByText('Datenverwaltung')).toBeInTheDocument();

      // Update another prop (not isOpen)
      const newAccounts = [...mockAccounts, { ...mockAccounts[0], id: 'acc-3' }];
      rerender(
        <DialogProvider>
          <SettingsModal {...defaultProps} accounts={newAccounts} />
        </DialogProvider>
      );

      // Should still be on General tab
      expect(screen.getByText('Datenverwaltung')).toBeInTheDocument();
    });

    it('should persist tab selection when modal is closed and reopened', () => {
      const { rerender } = renderWithDialog(<SettingsModal {...defaultProps} />);

      // Switch to Smart Sort tab
      fireEvent.click(screen.getByText('Smart Sort'));
      expect(screen.getByText('Smart Sort Konfiguration')).toBeInTheDocument();

      // Close modal
      rerender(
        <DialogProvider>
          <SettingsModal {...defaultProps} isOpen={false} />
        </DialogProvider>
      );
      expect(screen.queryByText('Einstellungen')).not.toBeInTheDocument();

      // Reopen modal - should still be on Smart Sort tab (state persists)
      rerender(
        <DialogProvider>
          <SettingsModal {...defaultProps} isOpen={true} />
        </DialogProvider>
      );
      expect(screen.getByText('Smart Sort Konfiguration')).toBeInTheDocument();
    });

    it('should handle empty accounts array', () => {
      renderWithDialog(<SettingsModal {...defaultProps} accounts={[]} />);

      expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();
      expect(screen.getByText('Konto hinzufügen')).toBeInTheDocument();
    });
  });

  describe('Layout and Styling', () => {
    it('should have sidebar with tab buttons', () => {
      const { container } = renderWithDialog(<SettingsModal {...defaultProps} />);
      const sidebar = container.querySelector('.w-48.bg-slate-50');
      expect(sidebar).toBeInTheDocument();
    });

    it('should have scrollable content area', () => {
      const { container } = renderWithDialog(<SettingsModal {...defaultProps} />);
      const contentArea = container.querySelector('.flex-1.p-6.overflow-y-auto');
      expect(contentArea).toBeInTheDocument();
    });

    it('should render modal with max height constraint', () => {
      const { container } = renderWithDialog(<SettingsModal {...defaultProps} />);
      const modalContent = container.querySelector('.max-h-\\[90vh\\]');
      expect(modalContent).toBeInTheDocument();
    });

    it('should have centered modal with backdrop blur', () => {
      const { container } = renderWithDialog(<SettingsModal {...defaultProps} />);
      const wrapper = container.querySelector('.fixed.inset-0.z-50.flex.items-center.justify-center');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass('backdrop-blur-sm');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);
      const heading = screen.getByText('Einstellungen');
      expect(heading.tagName).toBe('H2');
    });

    it('should support keyboard navigation for tab buttons', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      const accountsTab = screen.getByText('IMAP Konten');
      const smartSortTab = screen.getByText('Smart Sort');
      const generalTab = screen.getByText('Allgemein');

      // Tab buttons should be focusable
      expect(accountsTab.tagName).toBe('BUTTON');
      expect(smartSortTab.tagName).toBe('BUTTON');
      expect(generalTab.tagName).toBe('BUTTON');

      accountsTab.focus();
      expect(document.activeElement).toBe(accountsTab);

      smartSortTab.focus();
      expect(document.activeElement).toBe(smartSortTab);
    });

    it('should have accessible modal structure', () => {
      const { container } = renderWithDialog(<SettingsModal {...defaultProps} />);

      // Modal should have proper structure
      const modal = container.querySelector('.bg-white.rounded-xl.shadow-2xl');
      expect(modal).toBeInTheDocument();

      // Should have header with title and close button
      const heading = screen.getByText('Einstellungen');
      expect(heading).toBeInTheDocument();

      const closeButton = heading.parentElement?.querySelector('button');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Tab Component Rendering', () => {
    it('should only render active tab content', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      // On accounts tab - should show accounts content but not other tabs
      expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();
      expect(screen.queryByText('Smart Sort Konfiguration')).not.toBeInTheDocument();
      expect(screen.queryByText('Datenverwaltung')).not.toBeInTheDocument();
    });

    it('should unmount previous tab when switching', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      // Start on accounts tab
      expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();

      // Switch to Smart Sort
      fireEvent.click(screen.getByText('Smart Sort'));

      // Accounts content should be unmounted
      expect(screen.queryByText('Verbundene Konten')).not.toBeInTheDocument();
      // Smart Sort content should be mounted
      expect(screen.getByText('Smart Sort Konfiguration')).toBeInTheDocument();
    });

    it('should render tab icon in Smart Sort tab button', () => {
      renderWithDialog(<SettingsModal {...defaultProps} />);

      const smartSortButton = screen.getByText('Smart Sort').parentElement;
      // Should have Sparkles icon
      const icon = smartSortButton?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });
});
