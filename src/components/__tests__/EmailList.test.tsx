import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmailList from '../EmailList';
import { Email, INBOX_FOLDER } from '../../types';

describe('EmailList', () => {
  // Sample email factory
  const createEmail = (overrides: Partial<Email> = {}): Email => ({
    id: 'email-1',
    sender: 'John Doe',
    senderEmail: 'john@example.com',
    subject: 'Test Subject',
    body: 'This is the email body content for testing.',
    date: new Date().toISOString(), // Use current date/time so formatEmailDate shows time
    folder: INBOX_FOLDER,
    isRead: false,
    isFlagged: false,
    hasAttachments: false,
    ...overrides,
  });

  const mockEmails: Email[] = [
    createEmail({ id: 'email-1', sender: 'John Doe', subject: 'First Email', isRead: false }),
    createEmail({ id: 'email-2', sender: 'Jane Smith', subject: 'Second Email', isRead: true }),
    createEmail({ id: 'email-3', sender: 'Bob Wilson', subject: 'Third Email', isFlagged: true }),
  ];

  const defaultProps = {
    emails: mockEmails,
    selectedEmailId: null,
    selectedIds: new Set<string>(),
    onRowClick: vi.fn(),
    onToggleSelection: vi.fn(),
    onDeleteEmail: vi.fn(),
    onToggleRead: vi.fn(),
    onToggleFlag: vi.fn(),
    isLoading: false,
    onLoadMore: undefined,
    hasMore: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading spinner when isLoading is true', () => {
      render(<EmailList {...defaultProps} isLoading={true} />);

      // Loading spinner should be visible
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not render emails when loading', () => {
      render(<EmailList {...defaultProps} isLoading={true} />);

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('First Email')).not.toBeInTheDocument();
    });

    it('should not render empty state message when loading', () => {
      render(<EmailList {...defaultProps} isLoading={true} emails={[]} />);

      expect(screen.queryByText('Keine Emails')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should render empty state icon when no emails', () => {
      render(<EmailList {...defaultProps} emails={[]} />);

      // Folder icon should be present with specific styling
      const icon = document.querySelector('svg.w-16.h-16.opacity-20');
      expect(icon).toBeInTheDocument();
    });

    it('should render empty state heading when no emails', () => {
      render(<EmailList {...defaultProps} emails={[]} />);

      expect(screen.getByText('Keine Emails')).toBeInTheDocument();
    });

    it('should render empty state description when no emails', () => {
      render(<EmailList {...defaultProps} emails={[]} />);

      expect(screen.getByText('Dieser Ordner enthält noch keine Emails.')).toBeInTheDocument();
    });

    it('should center align empty state content', () => {
      render(<EmailList {...defaultProps} emails={[]} />);

      const emptyStateContainer = screen.getByText('Keine Emails').closest('div');
      expect(emptyStateContainer).toHaveClass('text-center');
    });

    it('should not render email count header when empty', () => {
      render(<EmailList {...defaultProps} emails={[]} />);

      expect(screen.queryByText(/Emails \(/)).not.toBeInTheDocument();
    });

    it('should apply proper styling to empty state container', () => {
      const { container } = render(<EmailList {...defaultProps} emails={[]} />);

      // Should have the empty state container
      const emptyStateRoot = container.querySelector('[data-testid="empty-state"]');
      expect(emptyStateRoot).toBeInTheDocument();
    });
  });

  describe('Email List Rendering', () => {
    it('should render email count header', () => {
      render(<EmailList {...defaultProps} />);

      expect(screen.getByText('Emails (3)')).toBeInTheDocument();
    });

    it('should render all email senders', () => {
      render(<EmailList {...defaultProps} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });

    it('should render all email subjects', () => {
      render(<EmailList {...defaultProps} />);

      expect(screen.getByText('First Email')).toBeInTheDocument();
      expect(screen.getByText('Second Email')).toBeInTheDocument();
      expect(screen.getByText('Third Email')).toBeInTheDocument();
    });

    it('should render email body preview', () => {
      render(<EmailList {...defaultProps} />);

      const bodyPreviews = screen.getAllByText('This is the email body content for testing.');
      expect(bodyPreviews.length).toBe(3);
    });

    it('should render smart date formatting for today (shows time)', () => {
      render(<EmailList {...defaultProps} />);

      // Today's emails should show time in HH:MM format
      const timeElements = screen.getAllByText(/\d{2}:\d{2}/);
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it('should apply different styling for read vs unread emails', () => {
      render(<EmailList {...defaultProps} />);

      // Unread email sender has text-slate-900
      const johnDoe = screen.getByText('John Doe');
      expect(johnDoe).toHaveClass('text-slate-900');

      // Read email sender has text-slate-600
      const janeSmith = screen.getByText('Jane Smith');
      expect(janeSmith).toHaveClass('text-slate-600');
    });

    it('should show attachment icon when email has attachments', () => {
      const emailWithAttachment = createEmail({
        id: 'email-4',
        hasAttachments: true,
      });
      render(<EmailList {...defaultProps} emails={[emailWithAttachment]} />);

      // Paperclip icon should be present
      const paperclip = document.querySelector('svg.text-blue-600');
      expect(paperclip).toBeInTheDocument();
    });

    it('should not show attachment icon when email has no attachments', () => {
      const emailWithoutAttachment = createEmail({
        id: 'email-5',
        hasAttachments: false,
      });
      render(<EmailList {...defaultProps} emails={[emailWithoutAttachment]} />);

      // Check no paperclip in subject row area (exclude other icons)
      const allIcons = document.querySelectorAll('svg.text-blue-600.flex-shrink-0');
      expect(allIcons.length).toBe(0);
    });

    it('should show AI summary when present', () => {
      const emailWithSummary = createEmail({
        id: 'email-6',
        aiSummary: 'This is an AI generated summary',
      });
      render(<EmailList {...defaultProps} emails={[emailWithSummary]} />);

      expect(screen.getByText('This is an AI generated summary')).toBeInTheDocument();
    });

    it('should not show AI summary section when not present', () => {
      const emailWithoutSummary = createEmail({ id: 'email-7', aiSummary: undefined });
      render(<EmailList {...defaultProps} emails={[emailWithoutSummary]} />);

      // BrainCircuit icon should not be present when no AI summary
      const aiIndicators = document.querySelectorAll('.bg-blue-100');
      expect(aiIndicators.length).toBe(0);
    });
  });

  describe('Smart Date Formatting', () => {
    it('should display time (HH:MM) for today\'s emails', () => {
      const todayEmail = createEmail({
        id: 'today-email',
        sender: 'Today Sender',
        date: new Date().toISOString(),
      });

      render(<EmailList {...defaultProps} emails={[todayEmail]} />);

      // Should show time in HH:MM format
      const timeElement = screen.getByText(/\d{2}:\d{2}/);
      expect(timeElement).toBeInTheDocument();
    });

    it('should display "Gestern" for yesterday\'s emails', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const yesterdayEmail = createEmail({
        id: 'yesterday-email',
        sender: 'Yesterday Sender',
        date: yesterday.toISOString(),
      });

      render(<EmailList {...defaultProps} emails={[yesterdayEmail]} />);

      // Should show "Gestern"
      expect(screen.getByText('Gestern')).toBeInTheDocument();
    });

    it('should display day name for emails from 2-6 days ago', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const thisWeekEmail = createEmail({
        id: 'thisweek-email',
        sender: 'This Week Sender',
        date: threeDaysAgo.toISOString(),
      });

      render(<EmailList {...defaultProps} emails={[thisWeekEmail]} />);

      // Should show a German day name
      const germanDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
      const hasGermanDayName = germanDays.some((day) => screen.queryByText(day) !== null);
      expect(hasGermanDayName).toBe(true);
    });

    it('should display full date (DD.MM.YYYY) for emails older than 6 days', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const olderEmail = createEmail({
        id: 'older-email',
        sender: 'Older Sender',
        date: tenDaysAgo.toISOString(),
      });

      render(<EmailList {...defaultProps} emails={[olderEmail]} />);

      // Should show full date in DD.MM.YYYY format
      const dateElement = screen.getByText(/\d{2}\.\d{2}\.\d{4}/);
      expect(dateElement).toBeInTheDocument();
    });

    it('should display full date for emails from last year', () => {
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      lastYear.setMonth(5); // June
      lastYear.setDate(15);

      const oldEmail = createEmail({
        id: 'lastyear-email',
        sender: 'Last Year Sender',
        date: lastYear.toISOString(),
      });

      render(<EmailList {...defaultProps} emails={[oldEmail]} />);

      // Should show full date
      const dateElement = screen.getByText(/\d{2}\.\d{2}\.\d{4}/);
      expect(dateElement).toBeInTheDocument();
    });

    it('should use German day names, not English', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const thisWeekEmail = createEmail({
        id: 'german-day-email',
        sender: 'German Day Sender',
        date: threeDaysAgo.toISOString(),
      });

      render(<EmailList {...defaultProps} emails={[thisWeekEmail]} />);

      // Should not show English day names
      const englishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      englishDays.forEach((day) => {
        expect(screen.queryByText(day)).not.toBeInTheDocument();
      });
    });

    it('should handle mixed date ranges in email list', () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const mixedEmails = [
        createEmail({ id: 'today', sender: 'Today', date: today.toISOString() }),
        createEmail({ id: 'yesterday', sender: 'Yesterday', date: yesterday.toISOString() }),
        createEmail({ id: 'thisweek', sender: 'This Week', date: threeDaysAgo.toISOString() }),
        createEmail({ id: 'older', sender: 'Older', date: oneMonthAgo.toISOString() }),
      ];

      render(<EmailList {...defaultProps} emails={mixedEmails} />);

      // Should render all emails with appropriate date formatting
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Yesterday')).toBeInTheDocument();
      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('Older')).toBeInTheDocument();

      // Should have time format (HH:MM) for today
      expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
      // Should have "Gestern" for yesterday
      expect(screen.getByText('Gestern')).toBeInTheDocument();
      // Should have full date for older
      expect(screen.getByText(/\d{2}\.\d{2}\.\d{4}/)).toBeInTheDocument();
    });

    it('should format specific time correctly for today', () => {
      const specificTime = new Date();
      specificTime.setHours(14, 30, 0, 0);

      const specificTimeEmail = createEmail({
        id: 'specific-time',
        sender: 'Specific Time Sender',
        date: specificTime.toISOString(),
      });

      render(<EmailList {...defaultProps} emails={[specificTimeEmail]} />);

      // Should show exactly 14:30
      expect(screen.getByText('14:30')).toBeInTheDocument();
    });

    it('should pad single-digit hours and minutes with zeros', () => {
      const morningTime = new Date();
      morningTime.setHours(9, 5, 0, 0);

      const morningEmail = createEmail({
        id: 'morning',
        sender: 'Morning Sender',
        date: morningTime.toISOString(),
      });

      render(<EmailList {...defaultProps} emails={[morningEmail]} />);

      // Should show 09:05, not 9:5
      expect(screen.getByText('09:05')).toBeInTheDocument();
    });
  });

  describe('Email Selection', () => {
    it('should highlight selected email', () => {
      render(<EmailList {...defaultProps} selectedEmailId="email-1" />);

      // Selected email should have blue left border and background
      const emailRow = screen.getByText('John Doe').closest('div[class*="border-b"]');
      expect(emailRow).toHaveClass('bg-blue-50');
      expect(emailRow).toHaveClass('border-l-blue-600');
    });

    it('should not highlight non-selected emails', () => {
      render(<EmailList {...defaultProps} selectedEmailId="email-1" />);

      // Non-selected email should have transparent border
      const janeRow = screen.getByText('Jane Smith').closest('div[class*="border-b"]');
      expect(janeRow).toHaveClass('border-l-transparent');
    });

    it('should apply selection styling when email is in selectedIds', () => {
      const selectedIds = new Set(['email-2']);
      render(<EmailList {...defaultProps} selectedIds={selectedIds} />);

      const janeRow = screen.getByText('Jane Smith').closest('div[class*="border-b"]');
      expect(janeRow).toHaveClass('bg-blue-50/50');
    });

    it('should show checked checkbox when email is selected', () => {
      const selectedIds = new Set(['email-1']);
      render(<EmailList {...defaultProps} selectedIds={selectedIds} />);

      // Checkbox should have blue background when selected
      const checkboxes = document.querySelectorAll('.bg-blue-600.border-blue-600');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  describe('Row Click Interactions', () => {
    it('should call onRowClick when clicking an email row', () => {
      const onRowClick = vi.fn();
      render(<EmailList {...defaultProps} onRowClick={onRowClick} />);

      const emailRow = screen.getByText('John Doe').closest('div[class*="cursor-pointer"]');
      fireEvent.click(emailRow!);

      expect(onRowClick).toHaveBeenCalledWith('email-1', expect.any(Object));
    });

    it('should call onRowClick with correct email id', () => {
      const onRowClick = vi.fn();
      render(<EmailList {...defaultProps} onRowClick={onRowClick} />);

      const emailRow = screen.getByText('Jane Smith').closest('div[class*="cursor-pointer"]');
      fireEvent.click(emailRow!);

      expect(onRowClick).toHaveBeenCalledWith('email-2', expect.any(Object));
    });
  });

  describe('Checkbox Toggle Interactions', () => {
    it('should call onToggleSelection when clicking checkbox', () => {
      const onToggleSelection = vi.fn();
      render(<EmailList {...defaultProps} onToggleSelection={onToggleSelection} />);

      // Find checkbox container (absolute positioned left element)
      const checkboxContainers = document.querySelectorAll('.absolute.left-4');
      fireEvent.click(checkboxContainers[0]);

      expect(onToggleSelection).toHaveBeenCalledWith('email-1', false);
    });

    it('should pass shiftKey to onToggleSelection', () => {
      const onToggleSelection = vi.fn();
      render(<EmailList {...defaultProps} onToggleSelection={onToggleSelection} />);

      const checkboxContainers = document.querySelectorAll('.absolute.left-4');
      fireEvent.click(checkboxContainers[0], { shiftKey: true });

      expect(onToggleSelection).toHaveBeenCalledWith('email-1', true);
    });

    it('should not trigger row click when clicking checkbox', () => {
      const onRowClick = vi.fn();
      const onToggleSelection = vi.fn();
      render(<EmailList {...defaultProps} onRowClick={onRowClick} onToggleSelection={onToggleSelection} />);

      const checkboxContainers = document.querySelectorAll('.absolute.left-4');
      fireEvent.click(checkboxContainers[0]);

      expect(onToggleSelection).toHaveBeenCalled();
      expect(onRowClick).not.toHaveBeenCalled();
    });
  });

  describe('Action Button Interactions', () => {
    describe('Flag Toggle', () => {
      it('should call onToggleFlag when clicking star button', () => {
        const singleEmail = createEmail({ id: 'email-single', isFlagged: false });
        const onToggleFlag = vi.fn();
        render(<EmailList {...defaultProps} emails={[singleEmail]} onToggleFlag={onToggleFlag} />);

        const flagButton = screen.getByTitle('Markieren');
        fireEvent.click(flagButton);

        expect(onToggleFlag).toHaveBeenCalledWith('email-single');
      });

      it('should show "Markierung entfernen" title when email is flagged', () => {
        const flaggedEmail = createEmail({ id: 'email-flagged', isFlagged: true });
        render(<EmailList {...defaultProps} emails={[flaggedEmail]} />);

        expect(screen.getByTitle('Markierung entfernen')).toBeInTheDocument();
      });

      it('should show "Markieren" title when email is not flagged', () => {
        const unflaggedEmail = createEmail({ id: 'email-unflagged', isFlagged: false });
        render(<EmailList {...defaultProps} emails={[unflaggedEmail]} />);

        expect(screen.getByTitle('Markieren')).toBeInTheDocument();
      });

      it('should not trigger row click when clicking flag button', () => {
        const singleEmail = createEmail({ id: 'email-single', isFlagged: false });
        const onRowClick = vi.fn();
        const onToggleFlag = vi.fn();
        render(
          <EmailList {...defaultProps} emails={[singleEmail]} onRowClick={onRowClick} onToggleFlag={onToggleFlag} />
        );

        const flagButton = screen.getByTitle('Markieren');
        fireEvent.click(flagButton);

        expect(onToggleFlag).toHaveBeenCalled();
        expect(onRowClick).not.toHaveBeenCalled();
      });
    });

    describe('Read Toggle', () => {
      it('should call onToggleRead when clicking read button', () => {
        const singleEmail = createEmail({ id: 'email-single', isRead: false });
        const onToggleRead = vi.fn();
        render(<EmailList {...defaultProps} emails={[singleEmail]} onToggleRead={onToggleRead} />);

        const readButton = screen.getByTitle('Als gelesen markieren');
        fireEvent.click(readButton);

        expect(onToggleRead).toHaveBeenCalledWith('email-single');
      });

      it('should show "Als ungelesen markieren" title when email is read', () => {
        const readEmail = createEmail({ id: 'email-read', isRead: true });
        render(<EmailList {...defaultProps} emails={[readEmail]} />);

        expect(screen.getByTitle('Als ungelesen markieren')).toBeInTheDocument();
      });

      it('should show "Als gelesen markieren" title when email is unread', () => {
        const unreadEmail = createEmail({ id: 'email-unread', isRead: false });
        render(<EmailList {...defaultProps} emails={[unreadEmail]} />);

        expect(screen.getByTitle('Als gelesen markieren')).toBeInTheDocument();
      });

      it('should not trigger row click when clicking read button', () => {
        const singleEmail = createEmail({ id: 'email-single', isRead: false });
        const onRowClick = vi.fn();
        const onToggleRead = vi.fn();
        render(
          <EmailList {...defaultProps} emails={[singleEmail]} onRowClick={onRowClick} onToggleRead={onToggleRead} />
        );

        const readButton = screen.getByTitle('Als gelesen markieren');
        fireEvent.click(readButton);

        expect(onToggleRead).toHaveBeenCalled();
        expect(onRowClick).not.toHaveBeenCalled();
      });
    });

    describe('Delete', () => {
      it('should call onDeleteEmail when clicking delete button', () => {
        const singleEmail = createEmail({ id: 'email-single' });
        const onDeleteEmail = vi.fn();
        render(<EmailList {...defaultProps} emails={[singleEmail]} onDeleteEmail={onDeleteEmail} />);

        const deleteButton = screen.getByTitle('Löschen');
        fireEvent.click(deleteButton);

        expect(onDeleteEmail).toHaveBeenCalledWith('email-single');
      });

      it('should not trigger row click when clicking delete button', () => {
        const singleEmail = createEmail({ id: 'email-single' });
        const onRowClick = vi.fn();
        const onDeleteEmail = vi.fn();
        render(
          <EmailList {...defaultProps} emails={[singleEmail]} onRowClick={onRowClick} onDeleteEmail={onDeleteEmail} />
        );

        const deleteButton = screen.getByTitle('Löschen');
        fireEvent.click(deleteButton);

        expect(onDeleteEmail).toHaveBeenCalled();
        expect(onRowClick).not.toHaveBeenCalled();
      });
    });
  });

  describe('Load More', () => {
    it('should render load more button when hasMore is true and onLoadMore is provided', () => {
      const onLoadMore = vi.fn();
      render(<EmailList {...defaultProps} hasMore={true} onLoadMore={onLoadMore} />);

      expect(screen.getByText('Mehr laden...')).toBeInTheDocument();
    });

    it('should not render load more button when hasMore is false', () => {
      const onLoadMore = vi.fn();
      render(<EmailList {...defaultProps} hasMore={false} onLoadMore={onLoadMore} />);

      expect(screen.queryByText('Mehr laden...')).not.toBeInTheDocument();
    });

    it('should not render load more button when onLoadMore is not provided', () => {
      render(<EmailList {...defaultProps} hasMore={true} onLoadMore={undefined} />);

      expect(screen.queryByText('Mehr laden...')).not.toBeInTheDocument();
    });

    it('should call onLoadMore when clicking load more button', () => {
      const onLoadMore = vi.fn();
      render(<EmailList {...defaultProps} hasMore={true} onLoadMore={onLoadMore} />);

      const loadMoreButton = screen.getByText('Mehr laden...');
      fireEvent.click(loadMoreButton);

      expect(onLoadMore).toHaveBeenCalled();
    });

    it('should not trigger row click when clicking load more button', () => {
      const onRowClick = vi.fn();
      const onLoadMore = vi.fn();
      render(<EmailList {...defaultProps} hasMore={true} onLoadMore={onLoadMore} onRowClick={onRowClick} />);

      const loadMoreButton = screen.getByText('Mehr laden...');
      fireEvent.click(loadMoreButton);

      expect(onLoadMore).toHaveBeenCalled();
      expect(onRowClick).not.toHaveBeenCalled();
    });
  });

  describe('Virtual Scrolling', () => {
    it('should render only first 50 emails by default', () => {
      // Create 60 emails
      const manyEmails = Array.from({ length: 60 }, (_, i) =>
        createEmail({ id: `email-${i}`, sender: `Sender ${i}`, subject: `Subject ${i}` })
      );

      render(<EmailList {...defaultProps} emails={manyEmails} />);

      // Should render first 50 emails
      expect(screen.getByText('Sender 0')).toBeInTheDocument();
      expect(screen.getByText('Sender 49')).toBeInTheDocument();
      expect(screen.queryByText('Sender 50')).not.toBeInTheDocument();
    });

    it('should show correct total count in header even with virtual scrolling', () => {
      const manyEmails = Array.from({ length: 100 }, (_, i) =>
        createEmail({ id: `email-${i}`, sender: `Sender ${i}` })
      );

      render(<EmailList {...defaultProps} emails={manyEmails} />);

      expect(screen.getByText('Emails (100)')).toBeInTheDocument();
    });

    it('should reset visible count when emails prop changes', async () => {
      const emails50 = Array.from({ length: 50 }, (_, i) => createEmail({ id: `email-${i}`, sender: `Sender ${i}` }));

      const { rerender } = render(<EmailList {...defaultProps} emails={emails50} />);

      // Rerender with new emails
      const newEmails = Array.from({ length: 10 }, (_, i) =>
        createEmail({ id: `new-email-${i}`, sender: `New Sender ${i}` })
      );

      rerender(<EmailList {...defaultProps} emails={newEmails} />);

      // New emails should be rendered
      expect(screen.getByText('New Sender 0')).toBeInTheDocument();
      expect(screen.queryByText('Sender 0')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle email with very long subject', () => {
      const longSubjectEmail = createEmail({
        id: 'long-subject',
        subject: 'A'.repeat(200),
      });

      render(<EmailList {...defaultProps} emails={[longSubjectEmail]} />);

      const subjectElement = screen.getByText('A'.repeat(200));
      expect(subjectElement).toHaveClass('truncate');
    });

    it('should handle email with very long sender name', () => {
      const longSenderEmail = createEmail({
        id: 'long-sender',
        sender: 'B'.repeat(100),
      });

      render(<EmailList {...defaultProps} emails={[longSenderEmail]} />);

      const senderElement = screen.getByText('B'.repeat(100));
      expect(senderElement).toHaveClass('truncate');
    });

    it('should handle email with empty body', () => {
      const emptyBodyEmail = createEmail({
        id: 'empty-body',
        body: '',
      });

      render(<EmailList {...defaultProps} emails={[emptyBodyEmail]} />);

      // Should still render without errors
      expect(screen.getByText(emptyBodyEmail.sender)).toBeInTheDocument();
    });

    it('should handle single email correctly', () => {
      const singleEmail = createEmail({ id: 'single' });

      render(<EmailList {...defaultProps} emails={[singleEmail]} />);

      expect(screen.getByText('Emails (1)')).toBeInTheDocument();
      expect(screen.getByText(singleEmail.sender)).toBeInTheDocument();
    });

    it('should handle email with special characters in subject', () => {
      const specialCharsEmail = createEmail({
        id: 'special',
        subject: '<script>alert("XSS")</script>',
      });

      render(<EmailList {...defaultProps} emails={[specialCharsEmail]} />);

      // React escapes HTML by default
      expect(screen.getByText('<script>alert("XSS")</script>')).toBeInTheDocument();
    });

    it('should handle mixed read/unread/flagged states', () => {
      const mixedEmails: Email[] = [
        createEmail({ id: 'e1', isRead: false, isFlagged: false }),
        createEmail({ id: 'e2', isRead: true, isFlagged: false }),
        createEmail({ id: 'e3', isRead: false, isFlagged: true }),
        createEmail({ id: 'e4', isRead: true, isFlagged: true }),
      ];

      render(<EmailList {...defaultProps} emails={mixedEmails} />);

      // All emails should render without issues
      expect(screen.getByText('Emails (4)')).toBeInTheDocument();
    });

    it('should handle multiple selections correctly', () => {
      const selectedIds = new Set(['email-1', 'email-2']);

      render(<EmailList {...defaultProps} selectedIds={selectedIds} />);

      // Both selected emails should have selection styling
      const johnRow = screen.getByText('John Doe').closest('div[class*="border-b"]');
      const janeRow = screen.getByText('Jane Smith').closest('div[class*="border-b"]');

      expect(johnRow).toHaveClass('bg-blue-50/50');
      expect(janeRow).toHaveClass('bg-blue-50/50');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible action buttons with titles', () => {
      const singleEmail = createEmail({ id: 'email-single', isRead: false, isFlagged: false });
      render(<EmailList {...defaultProps} emails={[singleEmail]} />);

      expect(screen.getByTitle('Markieren')).toBeInTheDocument();
      expect(screen.getByTitle('Als gelesen markieren')).toBeInTheDocument();
      expect(screen.getByTitle('Löschen')).toBeInTheDocument();
    });

    it('should have cursor-pointer on clickable email rows', () => {
      render(<EmailList {...defaultProps} />);

      const emailRow = screen.getByText('John Doe').closest('div[class*="border-b"]');
      expect(emailRow).toHaveClass('cursor-pointer');
    });

    it('should apply hover styling classes', () => {
      render(<EmailList {...defaultProps} />);

      const emailRow = screen.getByText('John Doe').closest('div[class*="border-b"]');
      expect(emailRow).toHaveClass('hover:bg-slate-50');
    });
  });
});
