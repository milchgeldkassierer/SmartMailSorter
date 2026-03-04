import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Email,
  DefaultEmailCategory,
  ImapAccount,
  AccountData,
  Category,
  SENT_FOLDER,
  SPAM_FOLDER,
  TRASH_FOLDER,
  FLAGGED_FOLDER,
  SortConfig,
  SearchConfig,
} from '../types';

// Standard folder name constants
const STANDARD_EXCLUDED_FOLDERS = [SENT_FOLDER, SPAM_FOLDER, TRASH_FOLDER] as const;

// Page size for paginated loading
const PAGE_SIZE = 100;

interface UseEmailsParams {
  activeAccountId: string;
  accounts: ImapAccount[];
}

interface UseEmailsReturn {
  // State
  data: Record<string, AccountData>;
  selectedEmailId: string | null;
  selectedCategory: string;
  searchTerm: string;
  searchConfig: SearchConfig;
  sortConfig: SortConfig;
  showUnsortedOnly: boolean;

  // Computed
  currentEmails: Email[];
  currentCategories: Category[];
  filteredEmails: Email[];
  displayedEmails: Email[];
  selectedEmail: Email | null;
  categoryCounts: Record<string, number>;
  canLoadMore: boolean;
  totalCount: number;

  // Setters
  setData: React.Dispatch<React.SetStateAction<Record<string, AccountData>>>;
  setSelectedEmailId: (id: string | null) => void;
  setSelectedCategory: (category: string) => void;
  setSearchTerm: (term: string) => void;
  setSearchConfig: (config: SearchConfig) => void;
  setSortConfig: (config: SortConfig) => void;
  setShowUnsortedOnly: (value: boolean) => void;

  // Helper Functions
  updateActiveAccountData: (updateFn: (prev: AccountData) => AccountData) => void;
  loadMoreEmails: () => void;
  resetPagination: () => void;
}

// Helper function to check if an email belongs in INBOX
const isInboxEmail = (email: Email): boolean => {
  return !email.folder || email.folder === DefaultEmailCategory.INBOX;
};

// Helper function to check if an email belongs to a standard folder
const matchesStandardFolder = (email: Email, folderName: string): boolean => {
  if (folderName === DefaultEmailCategory.INBOX) {
    return isInboxEmail(email);
  }

  if ((STANDARD_EXCLUDED_FOLDERS as ReadonlyArray<string>).includes(folderName)) {
    return email.folder === folderName;
  }

  return false;
};

// Helper function to check if an email matches a physical folder
const matchesPhysicalFolder = (email: Email, folderName: string): boolean => {
  if (!email.folder) return false;
  return (
    email.folder === folderName || email.folder.endsWith('/' + folderName) || folderName.endsWith('/' + email.folder)
  );
};

// Helper function to check if an email matches search criteria
const matchesSearchTerm = (email: Email, searchTerm: string, searchConfig: SearchConfig): boolean => {
  if (!searchTerm.trim()) return true;

  const terms = searchTerm
    .toLowerCase()
    .split(' ')
    .filter((t) => t.length > 0);

  const checkTerm = (term: string) => {
    const inSender =
      searchConfig.searchSender &&
      (email.sender.toLowerCase().includes(term) || email.senderEmail.toLowerCase().includes(term));
    const inSubject = searchConfig.searchSubject && email.subject.toLowerCase().includes(term);
    const inBody = searchConfig.searchBody && email.body?.toLowerCase().includes(term);
    return inSender || inSubject || inBody;
  };

  return searchConfig.logic === 'AND' ? terms.every(checkTerm) : terms.some(checkTerm);
};

// Helper function to check if a category is a standard folder
const isStandardFolderCategory = (category: string): boolean => {
  return (
    category === DefaultEmailCategory.INBOX || (STANDARD_EXCLUDED_FOLDERS as ReadonlyArray<string>).includes(category)
  );
};

// Helper function to check if email should be shown in selected category
const shouldShowInCategory = (
  email: Email,
  selectedCategory: string,
  showUnsortedOnly: boolean,
  categories: Category[]
): boolean => {
  // Handle FLAGGED_FOLDER virtual view
  if (selectedCategory === FLAGGED_FOLDER) {
    return email.isFlagged === true;
  }

  // Handle standard folders first
  if (isStandardFolderCategory(selectedCategory)) {
    if (!matchesStandardFolder(email, selectedCategory)) {
      return false;
    }

    // Apply unsorted filter only for INBOX
    if (selectedCategory === DefaultEmailCategory.INBOX && showUnsortedOnly) {
      return !email.smartCategory;
    }

    return true;
  }

  // Handle physical folders and smart categories
  const categoryInfo = categories.find((c) => c.name === selectedCategory);

  if (categoryInfo && categoryInfo.type === 'folder') {
    return matchesPhysicalFolder(email, selectedCategory);
  }

  // Default to smart category matching
  return email.smartCategory === selectedCategory;
};

export const useEmails = ({ activeAccountId, accounts: _accounts }: UseEmailsParams): UseEmailsReturn => {
  // Data State - stored by account ID
  const [data, setData] = useState<Record<string, AccountData>>({});

  // UI Selection State
  const [selectedCategory, setSelectedCategory] = useState<string>(DefaultEmailCategory.INBOX);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    searchSender: true,
    searchSubject: true,
    searchBody: false,
    logic: 'AND',
  });

  // Sort State
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'date',
    direction: 'desc',
  });

  // Filter State
  const [showUnsortedOnly, setShowUnsortedOnly] = useState(false);

  // Backend-driven counts
  const [totalCount, setTotalCount] = useState(0);
  const [backendCategoryCounts, setBackendCategoryCounts] = useState<Record<string, number>>({});

  // Backend Search State
  const [backendSearchResults, setBackendSearchResults] = useState<Email[]>([]);
  const [isUsingBackendSearch, setIsUsingBackendSearch] = useState(false);

  // Computed properties based on Active Account
  const activeData = data[activeAccountId] || { emails: [], categories: [] };
  const currentEmails = activeData.emails;
  const currentCategories = activeData.categories;

  // Fetch total count and category counts from backend
  useEffect(() => {
    if (!window.electron || !activeAccountId) return;

    const fetchCounts = async () => {
      try {
        const [count, catCounts] = await Promise.all([
          window.electron.getEmailCount(activeAccountId),
          window.electron.getCategoryCounts(activeAccountId),
        ]);
        setTotalCount(count);

        // Convert category counts array to Record
        const countsMap: Record<string, number> = {};
        if (Array.isArray(catCounts)) {
          catCounts.forEach((item: { smartCategory: string; count: number }) => {
            if (item.smartCategory) {
              countsMap[item.smartCategory] = item.count;
            }
          });
        }
        setBackendCategoryCounts(countsMap);
      } catch (error) {
        console.error('Failed to fetch counts:', error);
      }
    };

    fetchCounts();
  }, [activeAccountId, currentEmails.length]); // Re-fetch when emails change

  // Parse operator syntax from searchTerm (e.g. "from:amazon subject:invoice hello")
  const parseSearchOperators = (query: string): { hasOperators: boolean; freeText: string } => {
    const operatorRegex = /(\w+):\s*"([^"]+)"|(\w+):\s*(\S+)/gi;
    let hasOperators = false;
    const freeTextParts: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = operatorRegex.exec(query)) !== null) {
      const beforeOperator = query.substring(lastIndex, match.index).trim();
      if (beforeOperator) freeTextParts.push(beforeOperator);

      const operator = (match[1] || match[3]).toLowerCase();
      const value = (match[2] || match[4]).trim();

      const knownOps = ['from', 'to', 'subject', 'category', 'has', 'before', 'after'];
      // Skip values that look like another operator (word:) unless it's a date with colons
      if (value && (value.match(/^\d{4}-\d{2}-\d{2}/) || !value.match(/^\w+:/))) {
        if (knownOps.includes(operator)) {
          hasOperators = true;
        } else {
          freeTextParts.push(match[0]);
        }
      } else if (value) {
        // Value looks like another operator — treat the whole match as free text
        freeTextParts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    const remaining = query.substring(lastIndex).trim();
    if (remaining) freeTextParts.push(remaining);

    return { hasOperators, freeText: freeTextParts.join(' ').trim() };
  };

  // Debounced backend search to avoid excessive API calls during rapid typing
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const { hasOperators } = parseSearchOperators(searchTerm);
    setIsUsingBackendSearch(hasOperators);

    if (hasOperators && window.electron && activeAccountId) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        window.electron
          .searchEmails(searchTerm, activeAccountId)
          .then((results) => {
            setBackendSearchResults(results);
          })
          .catch((error) => {
            console.error('Backend search failed:', error);
            setBackendSearchResults([]);
          });
      }, 300);
    } else {
      setBackendSearchResults([]);
    }

    return () => clearTimeout(searchDebounceRef.current);
  }, [searchTerm, activeAccountId]);

  // Shared sort comparator for email lists
  const sortEmails = useCallback(
    (emails: Email[]): Email[] => {
      return [...emails].sort((a, b) => {
        let comparison = 0;
        switch (sortConfig.field) {
          case 'date':
            comparison = a.date.localeCompare(b.date);
            break;
          case 'sender':
            comparison = a.sender.localeCompare(b.sender);
            break;
          case 'subject':
            comparison = a.subject.localeCompare(b.subject);
            break;
          default: {
            const _exhaustive: never = sortConfig.field;
            throw new Error(`Unhandled sort field: ${_exhaustive}`);
          }
        }
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    },
    [sortConfig]
  );

  // --- Filtering Logic ---
  const filteredEmails = useMemo(() => {
    // If using backend search, use those results
    if (isUsingBackendSearch) {
      const categoryFiltered = backendSearchResults.filter((email) =>
        shouldShowInCategory(email, selectedCategory, showUnsortedOnly, currentCategories)
      );
      return sortEmails(categoryFiltered);
    }

    // Otherwise, use frontend filtering (original logic)
    const categoryFiltered = currentEmails.filter((email) =>
      shouldShowInCategory(email, selectedCategory, showUnsortedOnly, currentCategories)
    );
    const searchFiltered = categoryFiltered.filter((email) => matchesSearchTerm(email, searchTerm, searchConfig));
    return sortEmails(searchFiltered);
  }, [
    currentEmails,
    selectedCategory,
    searchTerm,
    searchConfig,
    showUnsortedOnly,
    currentCategories,
    sortEmails,
    isUsingBackendSearch,
    backendSearchResults,
  ]);

  // With virtualization, displayedEmails = filteredEmails (no client-side slicing needed)
  const displayedEmails = filteredEmails;
  const canLoadMore = false; // Virtualization handles display; no more client-side pagination

  // Selected Email
  const selectedEmail = currentEmails.find((e) => e.id === selectedEmailId) || null;

  // Category counts from backend, supplemented with local data for standard folders
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    // Standard folders - count from loaded emails (unread counts)
    counts[DefaultEmailCategory.INBOX] = currentEmails.filter((e) => isInboxEmail(e) && !e.isRead).length;
    counts[SENT_FOLDER] = currentEmails.filter((e) => e.folder === SENT_FOLDER && !e.isRead).length;
    counts[SPAM_FOLDER] = currentEmails.filter(
      (e) => (e.folder === SPAM_FOLDER || e.folder === 'Spamverdacht') && !e.isRead
    ).length;
    counts[TRASH_FOLDER] = currentEmails.filter(
      (e) => (e.folder === TRASH_FOLDER || e.folder === 'Gelöscht' || e.folder === 'Trash') && !e.isRead
    ).length;
    counts[FLAGGED_FOLDER] = currentEmails.filter((e) => e.isFlagged && !e.isRead).length;

    // Smart categories and physical folders from backend counts
    const standard: string[] = [DefaultEmailCategory.INBOX, ...STANDARD_EXCLUDED_FOLDERS];
    currentCategories.forEach((cat) => {
      const catName = cat.name;
      if (standard.includes(catName)) return;

      if (cat.type === 'folder') {
        counts[catName] = currentEmails.filter((e) => e.folder === catName && !e.isRead).length;
      } else {
        // Use backend category counts if available, fall back to local count
        counts[catName] = backendCategoryCounts[catName] !== undefined
          ? currentEmails.filter((e) => e.smartCategory === catName && !e.isRead).length
          : 0;
      }
    });

    return counts;
  }, [currentCategories, currentEmails, backendCategoryCounts]);

  // Helper to safely update data for active account
  const updateActiveAccountData = (updateFn: (prev: AccountData) => AccountData) => {
    setData((prev) => ({
      ...prev,
      [activeAccountId]: updateFn(prev[activeAccountId] || { emails: [], categories: [] }),
    }));
  };

  // Load more emails - now a no-op since virtualization handles display
  // Kept for backward compatibility
  const loadMoreEmails = useCallback(() => {
    // No-op: virtualization handles rendering all filtered emails
  }, []);

  // Reset pagination - now triggers re-fetch of counts
  const resetPagination = useCallback(() => {
    // Reset is handled by the useEffect that fetches counts
  }, []);

  // Reset when filter/category changes
  useEffect(() => {
    resetPagination();
  }, [selectedCategory, searchTerm, showUnsortedOnly, activeAccountId, sortConfig, resetPagination]);

  return {
    // State
    data,
    selectedEmailId,
    selectedCategory,
    searchTerm,
    searchConfig,
    sortConfig,
    showUnsortedOnly,

    // Computed
    currentEmails,
    currentCategories,
    filteredEmails,
    displayedEmails,
    selectedEmail,
    categoryCounts,
    canLoadMore,
    totalCount,

    // Setters
    setData,
    setSelectedEmailId,
    setSelectedCategory,
    setSearchTerm,
    setSearchConfig,
    setSortConfig,
    setShowUnsortedOnly,

    // Helper Functions
    updateActiveAccountData,
    loadMoreEmails,
    resetPagination,
  };
};
