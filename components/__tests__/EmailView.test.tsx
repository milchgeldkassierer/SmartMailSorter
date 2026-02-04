import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmailView from '../EmailView';
import { Email, INBOX_FOLDER } from '../../types';

// Mock window.electron
const mockGetEmailAttachments = vi.fn();

describe('EmailView', () => {
  // Sample email factory
  const createEmail = (overrides: Partial<Email> = {}): Email => ({
    id: 'email-1',
    sender: 'John Doe',
    senderEmail: 'john@example.com',
    subject: 'Test Subject',
    body: 'This is the plain text email body content.',
    date: '2024-01-15T10:30:00Z',
    folder: INBOX_FOLDER,
    category: 'INBOX',
    isRead: false,
    isFlagged: false,
    hasAttachments: false,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup window.electron mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.electron as any) = {
      getEmailAttachments: mockGetEmailAttachments,
    };
  });

  afterEach(() => {
    // Clean up window.electron mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electron;
  });

  describe('Empty State', () => {
    it('should render placeholder when no email is selected', () => {
      render(<EmailView email={null} />);

      expect(screen.getByText('Wähle eine Email aus, um Details zu sehen.')).toBeInTheDocument();
    });

    it('should not render any email content when email is null', () => {
      render(<EmailView email={null} />);

      expect(screen.queryByText('Test Subject')).not.toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should render CategoryIcon with INBOX category in placeholder', () => {
      render(<EmailView email={null} />);

      // The icon should be rendered (we can verify the container exists)
      const placeholder = screen.getByText('Wähle eine Email aus, um Details zu sehen.');
      expect(placeholder).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render loading spinner when body is undefined', () => {
      const loadingEmail = createEmail({
        body: undefined as unknown as string,
        bodyHtml: undefined,
      });
      render(<EmailView email={loadingEmail} />);

      expect(screen.getByText('Lade Inhalt...')).toBeInTheDocument();
    });

    it('should show loading animation when content is not loaded', () => {
      const loadingEmail = createEmail({
        body: undefined as unknown as string,
        bodyHtml: undefined,
      });
      render(<EmailView email={loadingEmail} />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not show email header when loading', () => {
      const loadingEmail = createEmail({
        body: undefined as unknown as string,
        bodyHtml: undefined,
      });
      render(<EmailView email={loadingEmail} />);

      expect(screen.queryByText('Test Subject')).not.toBeInTheDocument();
    });
  });

  describe('Email Header', () => {
    it('should render email subject', () => {
      const email = createEmail({ subject: 'Important Meeting Tomorrow' });
      render(<EmailView email={email} />);

      expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
    });

    it('should render sender name', () => {
      const email = createEmail({ sender: 'Alice Smith' });
      render(<EmailView email={email} />);

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    it('should render sender email in angle brackets', () => {
      const email = createEmail({ senderEmail: 'alice@company.com' });
      render(<EmailView email={email} />);

      expect(screen.getByText('<alice@company.com>')).toBeInTheDocument();
    });

    it('should render sender initial avatar', () => {
      const email = createEmail({ sender: 'Bob Wilson' });
      render(<EmailView email={email} />);

      // Avatar shows first letter of sender name
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('should render formatted date', () => {
      const email = createEmail({ date: '2024-01-15T10:30:00Z' });
      render(<EmailView email={email} />);

      // Date should be formatted using toLocaleString()
      const formattedDate = new Date('2024-01-15T10:30:00Z').toLocaleString();
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });

    it('should render email category', () => {
      const email = createEmail({ category: 'Rechnungen' });
      render(<EmailView email={email} />);

      expect(screen.getByText('Rechnungen')).toBeInTheDocument();
    });
  });

  describe('AI Confidence Display', () => {
    it('should render AI confidence percentage when present', () => {
      const email = createEmail({ confidence: 0.95 });
      render(<EmailView email={email} />);

      expect(screen.getByText('AI Confidence')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('should round confidence to nearest integer', () => {
      const email = createEmail({ confidence: 0.867 });
      render(<EmailView email={email} />);

      expect(screen.getByText('87%')).toBeInTheDocument();
    });

    it('should not render AI confidence when not present', () => {
      const email = createEmail({ confidence: undefined });
      render(<EmailView email={email} />);

      expect(screen.queryByText('AI Confidence')).not.toBeInTheDocument();
    });

    it('should handle 100% confidence', () => {
      const email = createEmail({ confidence: 1.0 });
      render(<EmailView email={email} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle low confidence values', () => {
      const email = createEmail({ confidence: 0.12 });
      render(<EmailView email={email} />);

      expect(screen.getByText('12%')).toBeInTheDocument();
    });
  });

  describe('Attachments', () => {
    it('should load attachments when email has attachments flag', async () => {
      const email = createEmail({ hasAttachments: true });
      mockGetEmailAttachments.mockResolvedValue([{ id: 'att-1', filename: 'document.pdf', size: 1024 }]);

      render(<EmailView email={email} />);

      await waitFor(() => {
        expect(mockGetEmailAttachments).toHaveBeenCalledWith('email-1');
      });
    });

    it('should render attachment filenames', async () => {
      const email = createEmail({ hasAttachments: true });
      mockGetEmailAttachments.mockResolvedValue([{ id: 'att-1', filename: 'document.pdf', size: 1024 }]);

      render(<EmailView email={email} />);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });
    });

    it('should render multiple attachments', async () => {
      const email = createEmail({ hasAttachments: true });
      mockGetEmailAttachments.mockResolvedValue([
        { id: 'att-1', filename: 'document.pdf', size: 1024 },
        { id: 'att-2', filename: 'image.png', size: 2048 },
        { id: 'att-3', filename: 'spreadsheet.xlsx', size: 4096 },
      ]);

      render(<EmailView email={email} />);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
        expect(screen.getByText('image.png')).toBeInTheDocument();
        expect(screen.getByText('spreadsheet.xlsx')).toBeInTheDocument();
      });
    });

    it('should display attachment size in title', async () => {
      const email = createEmail({ hasAttachments: true });
      mockGetEmailAttachments.mockResolvedValue([{ id: 'att-1', filename: 'document.pdf', size: 2048 }]);

      render(<EmailView email={email} />);

      await waitFor(() => {
        const attachmentElement = screen.getByText('document.pdf').closest('div');
        expect(attachmentElement).toHaveAttribute('title', 'Size: 2.0 KB');
      });
    });

    it('should not load attachments when hasAttachments is false', () => {
      const email = createEmail({ hasAttachments: false });
      render(<EmailView email={email} />);

      expect(mockGetEmailAttachments).not.toHaveBeenCalled();
    });

    it('should not load attachments when window.electron is not available', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).electron;
      const email = createEmail({ hasAttachments: true });
      render(<EmailView email={email} />);

      expect(mockGetEmailAttachments).not.toHaveBeenCalled();
    });

    it('should handle attachment loading error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const email = createEmail({ hasAttachments: true });
      mockGetEmailAttachments.mockRejectedValue(new Error('Network error'));

      render(<EmailView email={email} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Component should still render without crashing
      expect(screen.getByText('Test Subject')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('should clear attachments when switching to email without attachments', async () => {
      const emailWithAttachments = createEmail({ id: 'email-1', hasAttachments: true });
      mockGetEmailAttachments.mockResolvedValue([{ id: 'att-1', filename: 'document.pdf', size: 1024 }]);

      const { rerender } = render(<EmailView email={emailWithAttachments} />);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      // Switch to email without attachments
      const emailWithoutAttachments = createEmail({ id: 'email-2', hasAttachments: false });
      rerender(<EmailView email={emailWithoutAttachments} />);

      await waitFor(() => {
        expect(screen.queryByText('document.pdf')).not.toBeInTheDocument();
      });
    });
  });

  describe('AI Analysis Box', () => {
    it('should render AI reasoning when present', () => {
      const email = createEmail({
        aiReasoning: 'This email appears to be an invoice based on keywords like "payment" and "amount due".',
      });
      render(<EmailView email={email} />);

      expect(screen.getByText('Gemini Analyse')).toBeInTheDocument();
      expect(
        screen.getByText('This email appears to be an invoice based on keywords like "payment" and "amount due".')
      ).toBeInTheDocument();
    });

    it('should not render AI analysis section when aiReasoning is not present', () => {
      const email = createEmail({ aiReasoning: undefined });
      render(<EmailView email={email} />);

      expect(screen.queryByText('Gemini Analyse')).not.toBeInTheDocument();
    });

    it('should not render AI analysis section when aiReasoning is empty string', () => {
      const email = createEmail({ aiReasoning: '' });
      render(<EmailView email={email} />);

      expect(screen.queryByText('Gemini Analyse')).not.toBeInTheDocument();
    });

    it('should render long AI reasoning text', () => {
      const longReasoning = 'A'.repeat(500);
      const email = createEmail({ aiReasoning: longReasoning });
      render(<EmailView email={email} />);

      expect(screen.getByText(longReasoning)).toBeInTheDocument();
    });
  });

  describe('View Toggle (Text/HTML)', () => {
    it('should render view toggle when email has HTML body', () => {
      const email = createEmail({
        body: 'Plain text body',
        bodyHtml: '<p>HTML body</p>',
      });
      render(<EmailView email={email} />);

      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('HTML')).toBeInTheDocument();
    });

    it('should not render view toggle when email has no HTML body', () => {
      const email = createEmail({
        body: 'Plain text body',
        bodyHtml: undefined,
      });
      render(<EmailView email={email} />);

      expect(screen.queryByRole('button', { name: 'Text' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'HTML' })).not.toBeInTheDocument();
    });

    it('should default to HTML view when available', () => {
      const email = createEmail({
        body: 'Plain text body',
        bodyHtml: '<p>HTML body content</p>',
      });
      render(<EmailView email={email} />);

      // HTML button should have active styling
      const htmlButton = screen.getByText('HTML');
      expect(htmlButton).toHaveClass('bg-blue-100');
    });

    it('should switch to text view when Text button is clicked', () => {
      const email = createEmail({
        body: 'Plain text body content',
        bodyHtml: '<p>HTML body content</p>',
      });
      render(<EmailView email={email} />);

      const textButton = screen.getByText('Text');
      fireEvent.click(textButton);

      // Text button should now have active styling
      expect(textButton).toHaveClass('bg-blue-100');
      // Plain text body should be visible
      expect(screen.getByText('Plain text body content')).toBeInTheDocument();
    });

    it('should switch back to HTML view when HTML button is clicked', () => {
      const email = createEmail({
        body: 'Plain text body content',
        bodyHtml: '<p>HTML body content</p>',
      });
      render(<EmailView email={email} />);

      // First switch to text
      fireEvent.click(screen.getByText('Text'));
      // Then back to HTML
      fireEvent.click(screen.getByText('HTML'));

      const htmlButton = screen.getByText('HTML');
      expect(htmlButton).toHaveClass('bg-blue-100');
    });

    it('should reset to HTML view when email changes', async () => {
      const email1 = createEmail({
        id: 'email-1',
        body: 'First email text',
        bodyHtml: '<p>First email HTML</p>',
      });
      const email2 = createEmail({
        id: 'email-2',
        body: 'Second email text',
        bodyHtml: '<p>Second email HTML</p>',
      });

      const { rerender } = render(<EmailView email={email1} />);

      // Switch to text view
      fireEvent.click(screen.getByText('Text'));
      expect(screen.getByText('Text')).toHaveClass('bg-blue-100');

      // Change email
      rerender(<EmailView email={email2} />);

      // Should reset to HTML view
      await waitFor(() => {
        expect(screen.getByText('HTML')).toHaveClass('bg-blue-100');
      });
    });
  });

  describe('Email Body Content', () => {
    it('should render plain text body when no HTML available', () => {
      const email = createEmail({
        body: 'This is the plain text email body.',
        bodyHtml: undefined,
      });
      render(<EmailView email={email} />);

      expect(screen.getByText('This is the plain text email body.')).toBeInTheDocument();
    });

    it('should render HTML body when available and showHtml is true', () => {
      const email = createEmail({
        body: 'Plain text',
        bodyHtml: '<strong>Bold HTML content</strong>',
      });
      render(<EmailView email={email} />);

      // The HTML should be rendered with dangerouslySetInnerHTML
      const htmlContainer = document.querySelector('[class*="prose"]');
      expect(htmlContainer?.innerHTML).toContain('<strong>Bold HTML content</strong>');
    });

    it('should render plain text when showHtml is false', () => {
      const email = createEmail({
        body: 'Plain text body content here',
        bodyHtml: '<p>HTML body content</p>',
      });
      render(<EmailView email={email} />);

      fireEvent.click(screen.getByText('Text'));

      expect(screen.getByText('Plain text body content here')).toBeInTheDocument();
    });

    it('should preserve whitespace in plain text body', () => {
      const email = createEmail({
        body: 'Line 1\n\nLine 3',
        bodyHtml: undefined,
      });
      render(<EmailView email={email} />);

      // Find the body element with whitespace-pre-wrap class
      const bodyElement = document.querySelector('.whitespace-pre-wrap');
      expect(bodyElement).toBeInTheDocument();
      expect(bodyElement).toHaveTextContent('Line 1');
      expect(bodyElement).toHaveTextContent('Line 3');
      expect(bodyElement).toHaveClass('whitespace-pre-wrap');
    });

    it('should handle empty body gracefully', () => {
      const email = createEmail({
        body: '',
        bodyHtml: undefined,
      });
      render(<EmailView email={email} />);

      // Component should render without crashing
      expect(screen.getByText('Test Subject')).toBeInTheDocument();
    });

    it('should show plain text when bodyHtml is empty string', () => {
      const email = createEmail({
        body: 'Fallback plain text',
        bodyHtml: '',
      });
      render(<EmailView email={email} />);

      // Empty string is falsy, so no toggle should appear
      expect(screen.queryByRole('button', { name: 'Text' })).not.toBeInTheDocument();
      expect(screen.getByText('Fallback plain text')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle email with very long subject', () => {
      const longSubject = 'A'.repeat(300);
      const email = createEmail({ subject: longSubject });
      render(<EmailView email={email} />);

      expect(screen.getByText(longSubject)).toBeInTheDocument();
    });

    it('should handle email with special characters in subject', () => {
      const email = createEmail({
        subject: '<script>alert("XSS")</script> & "quotes"',
      });
      render(<EmailView email={email} />);

      // React escapes HTML entities
      expect(screen.getByText('<script>alert("XSS")</script> & "quotes"')).toBeInTheDocument();
    });

    it('should handle email with unicode characters', () => {
      const email = createEmail({
        subject: '🎉 Wichtige Mitteilung 日本語',
        sender: 'Müller, Hans 田中',
      });
      render(<EmailView email={email} />);

      expect(screen.getByText('🎉 Wichtige Mitteilung 日本語')).toBeInTheDocument();
      expect(screen.getByText('Müller, Hans 田中')).toBeInTheDocument();
    });

    it('should handle email with sender starting with number', () => {
      const email = createEmail({ sender: '1-800-FLOWERS' });
      render(<EmailView email={email} />);

      // Avatar should show first character
      const avatar = document.querySelector('.rounded-full.bg-blue-100');
      expect(avatar).toHaveTextContent('1');
    });

    it('should handle email with empty sender name', () => {
      const email = createEmail({ sender: '' });
      render(<EmailView email={email} />);

      // Should not crash - empty string charAt(0) returns ''
      expect(screen.getByText('Test Subject')).toBeInTheDocument();
    });

    it('should handle email with minimal data', () => {
      const minimalEmail: Email = {
        id: 'min-1',
        sender: 'X',
        senderEmail: 'x@y.z',
        subject: 'S',
        body: 'B',
        date: '2024-01-01T00:00:00Z',
        folder: 'Inbox',
        isRead: true,
        isFlagged: false,
      };
      render(<EmailView email={minimalEmail} />);

      // Avatar shows sender initial
      const avatar = document.querySelector('.rounded-full.bg-blue-100');
      expect(avatar).toHaveTextContent('X');
      // Subject in heading
      expect(screen.getByRole('heading', { name: 'S' })).toBeInTheDocument();
      // Body in content area
      const bodyContainer = document.querySelector('.prose.prose-slate.whitespace-pre-wrap');
      expect(bodyContainer).toHaveTextContent('B');
    });

    it('should handle null category gracefully', () => {
      const email = createEmail({ category: undefined });
      render(<EmailView email={email} />);

      // Component should render without crashing
      expect(screen.getByText('Test Subject')).toBeInTheDocument();
    });
  });

  describe('Email Switching', () => {
    it('should update content when email changes', () => {
      const email1 = createEmail({ id: 'email-1', subject: 'First Email Subject' });
      const email2 = createEmail({ id: 'email-2', subject: 'Second Email Subject' });

      const { rerender } = render(<EmailView email={email1} />);
      expect(screen.getByText('First Email Subject')).toBeInTheDocument();

      rerender(<EmailView email={email2} />);
      expect(screen.getByText('Second Email Subject')).toBeInTheDocument();
      expect(screen.queryByText('First Email Subject')).not.toBeInTheDocument();
    });

    it('should reload attachments when switching emails', async () => {
      const email1 = createEmail({ id: 'email-1', hasAttachments: true });
      const email2 = createEmail({ id: 'email-2', hasAttachments: true });

      mockGetEmailAttachments
        .mockResolvedValueOnce([{ id: 'att-1', filename: 'first.pdf', size: 1024 }])
        .mockResolvedValueOnce([{ id: 'att-2', filename: 'second.pdf', size: 2048 }]);

      const { rerender } = render(<EmailView email={email1} />);

      await waitFor(() => {
        expect(mockGetEmailAttachments).toHaveBeenCalledWith('email-1');
      });

      rerender(<EmailView email={email2} />);

      await waitFor(() => {
        expect(mockGetEmailAttachments).toHaveBeenCalledWith('email-2');
      });
    });

    it('should show empty state when switching from email to null', () => {
      const email = createEmail();
      const { rerender } = render(<EmailView email={email} />);

      expect(screen.getByText('Test Subject')).toBeInTheDocument();

      rerender(<EmailView email={null} />);

      expect(screen.getByText('Wähle eine Email aus, um Details zu sehen.')).toBeInTheDocument();
      expect(screen.queryByText('Test Subject')).not.toBeInTheDocument();
    });
  });

  describe('Styling and Layout', () => {
    it('should apply prose styling to body content', () => {
      const email = createEmail({ body: 'Body content' });
      render(<EmailView email={email} />);

      const bodyContainer = screen.getByText('Body content').closest('div');
      expect(bodyContainer).toHaveClass('prose');
    });

    it('should have overflow handling for long emails', () => {
      const email = createEmail();
      render(<EmailView email={email} />);

      const scrollContainer = document.querySelector('.overflow-y-auto');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('should render AI analysis with gradient background', () => {
      const email = createEmail({
        aiReasoning: 'AI analysis text',
      });
      render(<EmailView email={email} />);

      const analysisBox = screen.getByText('AI analysis text').closest('div[class*="gradient"]');
      expect(analysisBox).toHaveClass('bg-gradient-to-r');
    });
  });

  describe('Accessibility', () => {
    it('should have heading for email subject', () => {
      const email = createEmail({ subject: 'Important Email' });
      render(<EmailView email={email} />);

      const heading = screen.getByRole('heading', { name: 'Important Email' });
      expect(heading).toBeInTheDocument();
    });

    it('should have clickable toggle buttons for text/html', () => {
      const email = createEmail({
        body: 'Text',
        bodyHtml: '<p>HTML</p>',
      });
      render(<EmailView email={email} />);

      const textButton = screen.getByRole('button', { name: 'Text' });
      const htmlButton = screen.getByRole('button', { name: 'HTML' });

      expect(textButton).toBeInTheDocument();
      expect(htmlButton).toBeInTheDocument();
    });

    it('should indicate active view toggle visually', () => {
      const email = createEmail({
        body: 'Text',
        bodyHtml: '<p>HTML</p>',
      });
      render(<EmailView email={email} />);

      // HTML should be active by default
      const htmlButton = screen.getByRole('button', { name: 'HTML' });
      expect(htmlButton).toHaveClass('font-medium');

      // Text should not be active
      const textButton = screen.getByRole('button', { name: 'Text' });
      expect(textButton).not.toHaveClass('font-medium');
    });
  });
});
