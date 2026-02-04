import React, { useState, useEffect, useMemo } from 'react';
import { Email, DefaultEmailCategory, ImapAccount, AccountData, Category } from '../types';
import { SearchConfig } from '../components/SearchBar';

// Standard folder name constants
const SENT_FOLDER = DefaultEmailCategory.SENT;
const SPAM_FOLDER = DefaultEmailCategory.SPAM;
const TRASH_FOLDER = DefaultEmailCategory.TRASH;
const STANDARD_EXCLUDED_FOLDERS = [SENT_FOLDER, SPAM_FOLDER, TRASH_FOLDER] as const;

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
  showUnsortedOnly: boolean;

  // Computed
  currentEmails: Email[];
  currentCategories: Category[];
  filteredEmails: Email[];
  displayedEmails: Email[];
  selectedEmail: Email | null;
  categoryCounts: Record<string, number>;
  canLoadMore: boolean;

  // Setters
  setData: React.Dispatch<React.SetStateAction<Record<string, AccountData>>>;
  setSelectedEmailId: (id: string | null) => void;
  setSelectedCategory: (category: string) => void;
  setSearchTerm: (term: string) => void;
  setSearchConfig: (config: SearchConfig) => void;
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

  // Filter State
  const [showUnsortedOnly, setShowUnsortedOnly] = useState(false);

  // Pagination State
  const [visibleCount, setVisibleCount] = useState(100);

  // Computed properties based on Active Account
  const activeData = data[activeAccountId] || { emails: [], categories: [] };
  const currentEmails = activeData.emails;
  const currentCategories = activeData.categories;

  // --- Filtering Logic ---
  const filteredEmails = useMemo(() => {
    // 1. Filter by category (standard folders, physical folders, or smart categories)
    const categoryFiltered = currentEmails.filter((email) =>
      shouldShowInCategory(email, selectedCategory, showUnsortedOnly, currentCategories)
    );

    // 2. Apply search filter
    const searchFiltered = categoryFiltered.filter((email) => matchesSearchTerm(email, searchTerm, searchConfig));

    return searchFiltered;
  }, [currentEmails, selectedCategory, searchTerm, searchConfig, showUnsortedOnly, currentCategories]);

  // Pagination
  const displayedEmails = filteredEmails.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredEmails.length;

  // Selected Email
  const selectedEmail = currentEmails.find((e) => e.id === selectedEmailId) || null;

  // Counts Logic
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    // 1. Calculate Standard Folders Explicitly
    const standard: string[] = [DefaultEmailCategory.INBOX, ...STANDARD_EXCLUDED_FOLDERS];

    counts[DefaultEmailCategory.INBOX] = currentEmails.filter(
      (e) => (!e.folder || e.folder === DefaultEmailCategory.INBOX) && !e.isRead
    ).length;
    counts[SENT_FOLDER] = currentEmails.filter((e) => e.folder === SENT_FOLDER && !e.isRead).length;
    counts[SPAM_FOLDER] = currentEmails.filter(
      (e) => (e.folder === SPAM_FOLDER || e.folder === 'Spamverdacht') && !e.isRead
    ).length;
    counts[TRASH_FOLDER] = currentEmails.filter(
      (e) => (e.folder === TRASH_FOLDER || e.folder === 'Gelöscht' || e.folder === 'Trash') && !e.isRead
    ).length;

    // 2. Calculate Categories & Physical Folders
    currentCategories.forEach((cat) => {
      const catName = cat.name;
      if (standard.includes(catName)) return; // Skip if already handled

      if (cat.type === 'folder') {
        counts[catName] = currentEmails.filter((e) => e.folder === catName && !e.isRead).length;
      } else {
        counts[catName] = currentEmails.filter((e) => e.smartCategory === catName && !e.isRead).length;
      }
    });

    return counts;
  }, [currentCategories, currentEmails]);

  // Helper to safely update data for active account
  const updateActiveAccountData = (updateFn: (prev: AccountData) => AccountData) => {
    setData((prev) => ({
      ...prev,
      [activeAccountId]: updateFn(prev[activeAccountId] || { emails: [], categories: [] }),
    }));
  };

  // Load more emails (pagination)
  const loadMoreEmails = () => {
    setVisibleCount((prev) => prev + 100);
  };

  // Reset pagination when filter/category changes
  const resetPagination = () => {
    setVisibleCount(100);
  };

  // Reset pagination when filter/category changes
  useEffect(() => {
    resetPagination();
  }, [selectedCategory, searchTerm, showUnsortedOnly, activeAccountId]);

  return {
    // State
    data,
    selectedEmailId,
    selectedCategory,
    searchTerm,
    searchConfig,
    showUnsortedOnly,

    // Computed
    currentEmails,
    currentCategories,
    filteredEmails,
    displayedEmails,
    selectedEmail,
    categoryCounts,
    canLoadMore,

    // Setters
    setData,
    setSelectedEmailId,
    setSelectedCategory,
    setSearchTerm,
    setSearchConfig,
    setShowUnsortedOnly,

    // Helper Functions
    updateActiveAccountData,
    loadMoreEmails,
    resetPagination,
  };
};
