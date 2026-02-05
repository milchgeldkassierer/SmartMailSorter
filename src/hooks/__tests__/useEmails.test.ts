import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEmails } from '../useEmails';
import { Email, DefaultEmailCategory, ImapAccount, INBOX_FOLDER, SENT_FOLDER, SPAM_FOLDER } from '../../types';

describe('useEmails', () => {
  const mockAccount1: ImapAccount = {
    id: 'account-1',
    name: 'Test Account 1',
    email: 'test1@example.com',
    color: 'blue',
  };

  const mockAccount2: ImapAccount = {
    id: 'account-2',
    name: 'Test Account 2',
    email: 'test2@example.com',
    color: 'green',
  };

  const mockEmail1: Email = {
    id: 'email-1',
    sender: 'John Doe',
    senderEmail: 'john@example.com',
    subject: 'Test Email 1',
    body: 'This is a test email body',
    date: '2024-01-01T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: false,
    isFlagged: false,
  };

  const mockEmail2: Email = {
    id: 'email-2',
    sender: 'Jane Smith',
    senderEmail: 'jane@example.com',
    subject: 'Important Meeting',
    body: 'Meeting scheduled for tomorrow',
    date: '2024-01-02T10:00:00Z',
    folder: INBOX_FOLDER,
    smartCategory: 'Geschäftlich',
    isRead: false,
    isFlagged: false,
  };

  const mockEmail3: Email = {
    id: 'email-3',
    sender: 'Bob Johnson',
    senderEmail: 'bob@example.com',
    subject: 'Newsletter',
    body: 'Weekly newsletter content',
    date: '2024-01-03T10:00:00Z',
    folder: INBOX_FOLDER,
    smartCategory: 'Newsletter',
    isRead: true,
    isFlagged: false,
  };

  const mockEmail4: Email = {
    id: 'email-4',
    sender: 'Alice Brown',
    senderEmail: 'alice@example.com',
    subject: 'Sent Email',
    body: 'This is a sent email',
    date: '2024-01-04T10:00:00Z',
    folder: SENT_FOLDER,
    isRead: true,
    isFlagged: false,
  };

  const mockEmail5: Email = {
    id: 'email-5',
    sender: 'Spam Sender',
    senderEmail: 'spam@example.com',
    subject: 'Spam Email',
    body: 'This is spam',
    date: '2024-01-05T10:00:00Z',
    folder: SPAM_FOLDER,
    isRead: false,
    isFlagged: false,
  };

  const defaultParams = {
    activeAccountId: 'account-1',
    accounts: [mockAccount1, mockAccount2],
  };

  beforeEach(() => {
    // Reset any mocks if needed
  });

  describe('Initial State', () => {
    it('should initialize with empty data', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      expect(result.current.data).toEqual({});
    });

    it('should initialize with INBOX as selected category', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      expect(result.current.selectedCategory).toBe(DefaultEmailCategory.INBOX);
    });

    it('should initialize with null selected email id', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      expect(result.current.selectedEmailId).toBe(null);
    });

    it('should initialize with empty search term', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      expect(result.current.searchTerm).toBe('');
    });

    it('should initialize with default search config', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      expect(result.current.searchConfig).toEqual({
        searchSender: true,
        searchSubject: true,
        searchBody: false,
        logic: 'AND',
      });
    });

    it('should initialize with showUnsortedOnly as false', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      expect(result.current.showUnsortedOnly).toBe(false);
    });
  });

  describe('Computed Properties - Empty State', () => {
    it('should return empty arrays for current emails and categories when no data', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      expect(result.current.currentEmails).toEqual([]);
      expect(result.current.currentCategories).toEqual([]);
    });

    it('should return empty filtered emails when no data', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      expect(result.current.filteredEmails).toEqual([]);
    });

    it('should return empty displayed emails when no data', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      expect(result.current.displayedEmails).toEqual([]);
    });

    it('should return null for selected email when no data', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      expect(result.current.selectedEmail).toBe(null);
    });

    it('should return false for canLoadMore when no data', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      expect(result.current.canLoadMore).toBe(false);
    });
  });

  describe('setData', () => {
    it('should set data for accounts', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2],
            categories: [{ name: 'Rechnungen', type: 'smart' }],
          },
        });
      });

      expect(result.current.currentEmails).toHaveLength(2);
      expect(result.current.currentCategories).toHaveLength(1);
    });

    it('should handle multiple accounts data', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1],
            categories: [],
          },
          'account-2': {
            emails: [mockEmail2],
            categories: [],
          },
        });
      });

      expect(result.current.currentEmails).toHaveLength(1);
      expect(result.current.currentEmails[0]).toEqual(mockEmail1);
    });
  });

  describe('updateActiveAccountData', () => {
    it('should update data for active account', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.updateActiveAccountData((prev) => ({
          ...prev,
          emails: [mockEmail1, mockEmail2],
          categories: [],
        }));
      });

      expect(result.current.currentEmails).toHaveLength(2);
    });

    it('should not affect other accounts data', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': { emails: [mockEmail1], categories: [] },
          'account-2': { emails: [mockEmail2], categories: [] },
        });
      });

      act(() => {
        result.current.updateActiveAccountData((prev) => ({
          ...prev,
          emails: [mockEmail1, mockEmail3],
        }));
      });

      expect(result.current.data['account-2'].emails).toHaveLength(1);
      expect(result.current.data['account-2'].emails[0]).toEqual(mockEmail2);
    });

    it('should handle empty previous data', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.updateActiveAccountData((prev) => ({
          emails: [...prev.emails, mockEmail1],
          categories: prev.categories,
        }));
      });

      expect(result.current.currentEmails).toHaveLength(1);
      expect(result.current.currentEmails[0]).toEqual(mockEmail1);
    });
  });

  describe('Filtering by Category', () => {
    beforeEach(() => {
      // Setup will be done in each test
    });

    it('should filter emails for INBOX category', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2, mockEmail4],
            categories: [],
          },
        });
      });

      expect(result.current.filteredEmails).toHaveLength(2);
      expect(result.current.filteredEmails).toContainEqual(mockEmail1);
      expect(result.current.filteredEmails).toContainEqual(mockEmail2);
    });

    it('should filter emails for Gesendet category', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2, mockEmail4],
            categories: [],
          },
        });
        result.current.setSelectedCategory('Gesendet');
      });

      expect(result.current.filteredEmails).toHaveLength(1);
      expect(result.current.filteredEmails[0]).toEqual(mockEmail4);
    });

    it('should filter emails for Spam category', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail5],
            categories: [],
          },
        });
        result.current.setSelectedCategory('Spam');
      });

      expect(result.current.filteredEmails).toHaveLength(1);
      expect(result.current.filteredEmails[0]).toEqual(mockEmail5);
    });

    it('should filter emails by smart category', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2, mockEmail3],
            categories: [{ name: 'Newsletter', type: 'smart' }],
          },
        });
        result.current.setSelectedCategory('Newsletter');
      });

      expect(result.current.filteredEmails).toHaveLength(1);
      expect(result.current.filteredEmails[0]).toEqual(mockEmail3);
    });

    it('should filter unsorted emails when showUnsortedOnly is true', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2],
            categories: [],
          },
        });
        result.current.setShowUnsortedOnly(true);
      });

      expect(result.current.filteredEmails).toHaveLength(1);
      expect(result.current.filteredEmails[0]).toEqual(mockEmail1);
    });
  });

  describe('Search Functionality', () => {
    it('should filter emails by search term in sender', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2, mockEmail3],
            categories: [],
          },
        });
        result.current.setSearchTerm('john doe');
      });

      expect(result.current.filteredEmails).toHaveLength(1);
      expect(result.current.filteredEmails[0]).toEqual(mockEmail1);
    });

    it('should filter emails by search term in subject', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2, mockEmail3],
            categories: [],
          },
        });
        result.current.setSearchTerm('meeting');
      });

      expect(result.current.filteredEmails).toHaveLength(1);
      expect(result.current.filteredEmails[0]).toEqual(mockEmail2);
    });

    it('should filter emails by search term in body when enabled', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2],
            categories: [],
          },
        });
        result.current.setSearchConfig({
          searchSender: false,
          searchSubject: false,
          searchBody: true,
          logic: 'AND',
        });
        result.current.setSearchTerm('scheduled');
      });

      expect(result.current.filteredEmails).toHaveLength(1);
      expect(result.current.filteredEmails[0]).toEqual(mockEmail2);
    });

    it('should use AND logic for multiple search terms', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2],
            categories: [],
          },
        });
        result.current.setSearchTerm('jane meeting');
      });

      expect(result.current.filteredEmails).toHaveLength(1);
      expect(result.current.filteredEmails[0]).toEqual(mockEmail2);
    });

    it('should use OR logic for multiple search terms when configured', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2],
            categories: [],
          },
        });
        result.current.setSearchConfig({
          searchSender: true,
          searchSubject: true,
          searchBody: false,
          logic: 'OR',
        });
        result.current.setSearchTerm('john jane');
      });

      expect(result.current.filteredEmails).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1],
            categories: [],
          },
        });
        result.current.setSearchTerm('JOHN');
      });

      expect(result.current.filteredEmails).toHaveLength(1);
    });
  });

  describe('Pagination', () => {
    it('should display first 100 emails by default', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      const manyEmails = Array.from({ length: 150 }, (_, i) => ({
        ...mockEmail1,
        id: `email-${i}`,
      }));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: manyEmails,
            categories: [],
          },
        });
      });

      expect(result.current.displayedEmails).toHaveLength(100);
      expect(result.current.canLoadMore).toBe(true);
    });

    it('should load more emails when loadMoreEmails is called', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      const manyEmails = Array.from({ length: 250 }, (_, i) => ({
        ...mockEmail1,
        id: `email-${i}`,
      }));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: manyEmails,
            categories: [],
          },
        });
      });

      act(() => {
        result.current.loadMoreEmails();
      });

      expect(result.current.displayedEmails).toHaveLength(200);
      expect(result.current.canLoadMore).toBe(true);
    });

    it('should set canLoadMore to false when all emails are displayed', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2],
            categories: [],
          },
        });
      });

      expect(result.current.canLoadMore).toBe(false);
    });

    it('should reset pagination when resetPagination is called', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      const manyEmails = Array.from({ length: 250 }, (_, i) => ({
        ...mockEmail1,
        id: `email-${i}`,
      }));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: manyEmails,
            categories: [],
          },
        });
        result.current.loadMoreEmails();
      });

      expect(result.current.displayedEmails).toHaveLength(200);

      act(() => {
        result.current.resetPagination();
      });

      expect(result.current.displayedEmails).toHaveLength(100);
    });

    it('should reset pagination when category changes', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      const manyEmails = Array.from({ length: 350 }, (_, i) => ({
        ...mockEmail1,
        id: `email-${i}`,
        folder: i < 250 ? INBOX_FOLDER : SENT_FOLDER, // 250 in Posteingang, 100 in Gesendet
      }));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: manyEmails,
            categories: [],
          },
        });
        result.current.loadMoreEmails();
      });

      expect(result.current.displayedEmails).toHaveLength(200);

      act(() => {
        result.current.setSelectedCategory('Gesendet');
      });

      expect(result.current.displayedEmails).toHaveLength(100);
    });

    it('should reset pagination when search term changes', () => {
      const { result } = renderHook(() => useEmails(defaultParams));
      const manyEmails = Array.from({ length: 150 }, (_, i) => ({
        ...mockEmail1,
        id: `email-${i}`,
      }));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: manyEmails,
            categories: [],
          },
        });
        result.current.loadMoreEmails();
      });

      act(() => {
        result.current.setSearchTerm('test');
      });

      expect(result.current.displayedEmails).toHaveLength(100);
    });
  });

  describe('Category Counts', () => {
    it('should calculate inbox count for unread emails', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2, mockEmail3],
            categories: [],
          },
        });
      });

      expect(result.current.categoryCounts[DefaultEmailCategory.INBOX]).toBe(2);
    });

    it('should calculate smart category counts', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2, mockEmail3],
            categories: [{ name: 'Newsletter', type: 'smart' }],
          },
        });
      });

      expect(result.current.categoryCounts['Newsletter']).toBe(0);
    });

    it('should only count unread emails', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail3],
            categories: [],
          },
        });
      });

      expect(result.current.categoryCounts[DefaultEmailCategory.INBOX]).toBe(1);
    });
  });

  describe('Selected Email', () => {
    it('should return null when no email is selected', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1],
            categories: [],
          },
        });
      });

      expect(result.current.selectedEmail).toBe(null);
    });

    it('should return selected email when id is set', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1, mockEmail2],
            categories: [],
          },
        });
        result.current.setSelectedEmailId('email-2');
      });

      expect(result.current.selectedEmail).toEqual(mockEmail2);
    });

    it('should return null when selected email id does not exist', () => {
      const { result } = renderHook(() => useEmails(defaultParams));

      act(() => {
        result.current.setData({
          'account-1': {
            emails: [mockEmail1],
            categories: [],
          },
        });
        result.current.setSelectedEmailId('non-existent');
      });

      expect(result.current.selectedEmail).toBe(null);
    });
  });

  describe('Multi-Account Support', () => {
    it('should show correct emails when switching accounts', () => {
      const { result, rerender } = renderHook(
        ({ activeAccountId }) => useEmails({ activeAccountId, accounts: [mockAccount1, mockAccount2] }),
        { initialProps: { activeAccountId: 'account-1' } }
      );

      act(() => {
        result.current.setData({
          'account-1': { emails: [mockEmail1], categories: [] },
          'account-2': { emails: [mockEmail2], categories: [] },
        });
      });

      expect(result.current.currentEmails).toHaveLength(1);
      expect(result.current.currentEmails[0]).toEqual(mockEmail1);

      rerender({ activeAccountId: 'account-2' });

      expect(result.current.currentEmails).toHaveLength(1);
      expect(result.current.currentEmails[0]).toEqual(mockEmail2);
    });

    it('should reset pagination when switching accounts', () => {
      const { result, rerender } = renderHook(
        ({ activeAccountId }) => useEmails({ activeAccountId, accounts: [mockAccount1, mockAccount2] }),
        { initialProps: { activeAccountId: 'account-1' } }
      );

      const manyEmailsAccount1 = Array.from({ length: 250 }, (_, i) => ({
        ...mockEmail1,
        id: `email-acc1-${i}`,
      }));

      const manyEmailsAccount2 = Array.from({ length: 150 }, (_, i) => ({
        ...mockEmail1,
        id: `email-acc2-${i}`,
      }));

      act(() => {
        result.current.setData({
          'account-1': { emails: manyEmailsAccount1, categories: [] },
          'account-2': { emails: manyEmailsAccount2, categories: [] },
        });
        result.current.loadMoreEmails();
      });

      expect(result.current.displayedEmails).toHaveLength(200);

      rerender({ activeAccountId: 'account-2' });

      expect(result.current.displayedEmails).toHaveLength(100);
    });
  });
});
