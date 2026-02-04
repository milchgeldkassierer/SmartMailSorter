import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BatchActionBar from '../BatchActionBar';
import { Email, AISettings, LLMProvider, INBOX_FOLDER } from '../../types';

describe('BatchActionBar', () => {
  const mockEmail1: Email = {
    id: '1',
    sender: 'test1@example.com',
    senderEmail: 'test1@example.com',
    subject: 'Test 1',
    body: 'Body 1',
    date: '2024-01-01T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: false,
    isFlagged: false,
    hasAttachments: false,
  };

  const mockEmail2: Email = {
    id: '2',
    sender: 'test2@example.com',
    senderEmail: 'test2@example.com',
    subject: 'Test 2',
    body: 'Body 2',
    date: '2024-01-02T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: false,
    isFlagged: false,
    hasAttachments: false,
  };

  const defaultAISettings: AISettings = {
    provider: LLMProvider.GEMINI,
    model: 'gemini-3-flash-preview',
    apiKey: '',
  };

  const defaultProps = {
    filteredEmails: [mockEmail1, mockEmail2],
    selectedIds: new Set<string>(),
    onSelectAll: vi.fn(),
    onBatchDelete: vi.fn(),
    onBatchMarkRead: vi.fn(),
    onBatchSmartSort: vi.fn(),
    canSmartSort: false,
    aiSettings: defaultAISettings,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the select all checkbox', () => {
      render(<BatchActionBar {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('should not show selected count when no items are selected', () => {
      render(<BatchActionBar {...defaultProps} />);
      expect(screen.queryByText(/ausgewählt/)).not.toBeInTheDocument();
    });

    it('should show selected count when items are selected', () => {
      const selectedIds = new Set(['1']);
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} />);
      expect(screen.getByText('1 ausgewählt')).toBeInTheDocument();
    });

    it('should show correct count for multiple selections', () => {
      const selectedIds = new Set(['1', '2']);
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} />);
      expect(screen.getByText('2 ausgewählt')).toBeInTheDocument();
    });

    it('should not show action buttons when no items are selected', () => {
      render(<BatchActionBar {...defaultProps} />);
      expect(screen.queryByText('Löschen')).not.toBeInTheDocument();
      expect(screen.queryByText('Smart Sortieren')).not.toBeInTheDocument();
    });

    it('should show action buttons when items are selected', () => {
      const selectedIds = new Set(['1']);
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} />);
      expect(screen.getByText('Löschen')).toBeInTheDocument();
      expect(screen.getByText('Smart Sortieren')).toBeInTheDocument();
    });
  });

  describe('Select All Checkbox', () => {
    it('should be unchecked when no items are selected', () => {
      render(<BatchActionBar {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('should be unchecked when some items are selected', () => {
      const selectedIds = new Set(['1']);
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('should be checked when all items are selected', () => {
      const selectedIds = new Set(['1', '2']);
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('should be unchecked when filteredEmails is empty', () => {
      render(<BatchActionBar {...defaultProps} filteredEmails={[]} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('should call onSelectAll when clicked', () => {
      const onSelectAll = vi.fn();
      render(<BatchActionBar {...defaultProps} onSelectAll={onSelectAll} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(onSelectAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete Button', () => {
    it('should call onBatchDelete when clicked', () => {
      const onBatchDelete = vi.fn();
      const selectedIds = new Set(['1']);
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} onBatchDelete={onBatchDelete} />);

      const deleteButton = screen.getByText('Löschen').closest('button');
      fireEvent.click(deleteButton!);

      expect(onBatchDelete).toHaveBeenCalledTimes(1);
    });

    it('should have correct styling', () => {
      const selectedIds = new Set(['1']);
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} />);

      const deleteButton = screen.getByText('Löschen').closest('button');
      expect(deleteButton).toHaveClass('hover:bg-red-50', 'hover:text-red-600');
    });
  });

  describe('Smart Sort Button', () => {
    it('should call onBatchSmartSort when clicked and enabled', () => {
      const onBatchSmartSort = vi.fn();
      const selectedIds = new Set(['1']);
      const aiSettings: AISettings = { ...defaultAISettings, apiKey: 'test-key' };
      render(
        <BatchActionBar
          {...defaultProps}
          selectedIds={selectedIds}
          onBatchSmartSort={onBatchSmartSort}
          canSmartSort={true}
          aiSettings={aiSettings}
        />
      );

      const smartSortButton = screen.getByText('Smart Sortieren').closest('button');
      fireEvent.click(smartSortButton!);

      expect(onBatchSmartSort).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when canSmartSort is false', () => {
      const selectedIds = new Set(['1']);
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} canSmartSort={false} />);

      const smartSortButton = screen.getByText('Smart Sortieren').closest('button');
      expect(smartSortButton).toBeDisabled();
    });

    it('should not be disabled when canSmartSort is true', () => {
      const selectedIds = new Set(['1']);
      const aiSettings: AISettings = { ...defaultAISettings, apiKey: 'test-key' };
      render(
        <BatchActionBar {...defaultProps} selectedIds={selectedIds} canSmartSort={true} aiSettings={aiSettings} />
      );

      const smartSortButton = screen.getByText('Smart Sortieren').closest('button');
      expect(smartSortButton).not.toBeDisabled();
    });

    it('should have disabled styles when canSmartSort is false', () => {
      const selectedIds = new Set(['1']);
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} canSmartSort={false} />);

      const smartSortButton = screen.getByText('Smart Sortieren').closest('button');
      expect(smartSortButton).toHaveClass('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
    });

    it('should have enabled styles when canSmartSort is true', () => {
      const selectedIds = new Set(['1']);
      const aiSettings: AISettings = { ...defaultAISettings, apiKey: 'test-key' };
      render(
        <BatchActionBar {...defaultProps} selectedIds={selectedIds} canSmartSort={true} aiSettings={aiSettings} />
      );

      const smartSortButton = screen.getByText('Smart Sortieren').closest('button');
      expect(smartSortButton).toHaveClass('from-blue-600', 'to-indigo-600', 'text-white');
    });

    it('should show appropriate title when API key is missing', () => {
      const selectedIds = new Set(['1']);
      const aiSettings: AISettings = { ...defaultAISettings, apiKey: '' };
      render(
        <BatchActionBar {...defaultProps} selectedIds={selectedIds} canSmartSort={false} aiSettings={aiSettings} />
      );

      const smartSortButton = screen.getByText('Smart Sortieren').closest('button');
      expect(smartSortButton).toHaveAttribute('title', 'Bitte API Key in Einstellungen hinterlegen');
    });

    it('should show appropriate title when API key is present', () => {
      const selectedIds = new Set(['1']);
      const aiSettings: AISettings = { ...defaultAISettings, apiKey: 'test-key' };
      render(
        <BatchActionBar {...defaultProps} selectedIds={selectedIds} canSmartSort={true} aiSettings={aiSettings} />
      );

      const smartSortButton = screen.getByText('Smart Sortieren').closest('button');
      expect(smartSortButton).toHaveAttribute('title', 'Ausgewählte Mails mit AI sortieren');
    });
  });

  describe('Mark as Read/Unread Button', () => {
    it('should not render when no items are selected', () => {
      render(<BatchActionBar {...defaultProps} />);
      expect(screen.queryByText('Als gelesen')).not.toBeInTheDocument();
      expect(screen.queryByText('Als ungelesen')).not.toBeInTheDocument();
    });

    it('should render with "Als gelesen" label when unread emails are selected', () => {
      const selectedIds = new Set(['1']); // mockEmail1 has isRead: false
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} />);
      expect(screen.getByText('Als gelesen')).toBeInTheDocument();
    });

    it('should render with "Als ungelesen" label when only read emails are selected', () => {
      const readEmail: Email = { ...mockEmail1, id: '3', isRead: true };
      const selectedIds = new Set(['3']);
      render(<BatchActionBar {...defaultProps} filteredEmails={[readEmail]} selectedIds={selectedIds} />);
      expect(screen.getByText('Als ungelesen')).toBeInTheDocument();
    });

    it('should render with "Als gelesen" label when mixed read/unread emails are selected', () => {
      const readEmail: Email = { ...mockEmail1, id: '3', isRead: true };
      const unreadEmail: Email = { ...mockEmail2, id: '4', isRead: false };
      const selectedIds = new Set(['3', '4']);
      render(<BatchActionBar {...defaultProps} filteredEmails={[readEmail, unreadEmail]} selectedIds={selectedIds} />);
      // If any email is unread, button should say "Als gelesen"
      expect(screen.getByText('Als gelesen')).toBeInTheDocument();
    });

    it('should call onBatchMarkRead when clicked', () => {
      const onBatchMarkRead = vi.fn();
      const selectedIds = new Set(['1']);
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} onBatchMarkRead={onBatchMarkRead} />);

      const markReadButton = screen.getByText('Als gelesen').closest('button');
      fireEvent.click(markReadButton!);

      expect(onBatchMarkRead).toHaveBeenCalledTimes(1);
    });

    it('should have correct styling', () => {
      const selectedIds = new Set(['1']);
      render(<BatchActionBar {...defaultProps} selectedIds={selectedIds} />);

      const markReadButton = screen.getByText('Als gelesen').closest('button');
      expect(markReadButton).toHaveClass('hover:bg-blue-50', 'hover:text-blue-600', 'hover:border-blue-200');
    });
  });

  describe('Dynamic Behavior', () => {
    it('should update selected count when selection changes', () => {
      const { rerender } = render(<BatchActionBar {...defaultProps} selectedIds={new Set(['1'])} />);
      expect(screen.getByText('1 ausgewählt')).toBeInTheDocument();

      rerender(<BatchActionBar {...defaultProps} selectedIds={new Set(['1', '2'])} />);
      expect(screen.getByText('2 ausgewählt')).toBeInTheDocument();
    });

    it('should show/hide action buttons based on selection', () => {
      const { rerender } = render(<BatchActionBar {...defaultProps} selectedIds={new Set()} />);
      expect(screen.queryByText('Löschen')).not.toBeInTheDocument();

      rerender(<BatchActionBar {...defaultProps} selectedIds={new Set(['1'])} />);
      expect(screen.getByText('Löschen')).toBeInTheDocument();
    });

    it('should handle checkbox state correctly with different email lists', () => {
      const { rerender } = render(
        <BatchActionBar {...defaultProps} filteredEmails={[mockEmail1]} selectedIds={new Set(['1'])} />
      );
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      rerender(
        <BatchActionBar {...defaultProps} filteredEmails={[mockEmail1, mockEmail2]} selectedIds={new Set(['1'])} />
      );
      expect(checkbox.checked).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty email list', () => {
      render(<BatchActionBar {...defaultProps} filteredEmails={[]} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('should handle selecting all in empty list', () => {
      const onSelectAll = vi.fn();
      render(<BatchActionBar {...defaultProps} filteredEmails={[]} onSelectAll={onSelectAll} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(onSelectAll).toHaveBeenCalledTimes(1);
    });

    it('should not call onBatchSmartSort when button is disabled', () => {
      const onBatchSmartSort = vi.fn();
      const selectedIds = new Set(['1']);
      render(
        <BatchActionBar
          {...defaultProps}
          selectedIds={selectedIds}
          onBatchSmartSort={onBatchSmartSort}
          canSmartSort={false}
        />
      );

      const smartSortButton = screen.getByText('Smart Sortieren').closest('button');
      fireEvent.click(smartSortButton!);

      // Disabled button should not trigger the callback
      expect(onBatchSmartSort).not.toHaveBeenCalled();
    });
  });
});
