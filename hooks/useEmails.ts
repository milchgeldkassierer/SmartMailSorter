import { useState, useEffect, useMemo } from 'react';
import { Email, DefaultEmailCategory, ImapAccount, AccountData } from '../types';
import { SearchConfig } from '../components/SearchBar';

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
  currentCategories: { name: string, type: string }[];
  filteredEmails: Email[];
  displayedEmails: Email[];
  selectedEmail: Email | null;
  categoryCounts: Record<string, number>;
  canLoadMore: boolean;

  // Setters
  setData: (data: Record<string, AccountData>) => void;
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

export const useEmails = ({ activeAccountId, accounts }: UseEmailsParams): UseEmailsReturn => {
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
    logic: 'AND'
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
    let result = currentEmails;

    // 1. Initial Filtering by Folder OR Smart Category
    if (selectedCategory === DefaultEmailCategory.INBOX || selectedCategory === 'Posteingang') {
      result = result.filter(e => (!e.folder || e.folder === 'Posteingang') && e.folder !== 'Gesendet' && e.folder !== 'Spam' && e.folder !== 'Papierkorb');

      // Unsorted Toggle
      if (showUnsortedOnly) {
        result = result.filter(e => !e.smartCategory);
      }
    } else if (['Gesendet', 'Spam', 'Papierkorb'].includes(selectedCategory)) {
      result = result.filter(e => e.folder === selectedCategory);
    } else {
      // Check if it's a known physical folder
      const catInfo = currentCategories.find(c => c.name === selectedCategory);

      if (catInfo && catInfo.type === 'folder') {
        // Physical Folder Logic
        result = result.filter(e => {
          if (!e.folder) return false;
          return e.folder === selectedCategory ||
            e.folder.endsWith('/' + selectedCategory) ||
            selectedCategory.endsWith('/' + e.folder);
        });
      } else {
        // Smart Category Logic (Virtual View)
        result = result.filter(e => e.smartCategory === selectedCategory);
      }
    }

    // 2. Search Logic
    if (searchTerm.trim()) {
      const terms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
      result = result.filter(email => {
        const checkTerm = (term: string) => {
          const inSender = searchConfig.searchSender && (
            email.sender.toLowerCase().includes(term) ||
            email.senderEmail.toLowerCase().includes(term)
          );
          const inSubject = searchConfig.searchSubject && email.subject.toLowerCase().includes(term);
          const inBody = searchConfig.searchBody && email.body?.toLowerCase().includes(term);
          return inSender || inSubject || inBody;
        };
        return searchConfig.logic === 'AND' ? terms.every(checkTerm) : terms.some(checkTerm);
      });
    }

    return result;
  }, [currentEmails, selectedCategory, searchTerm, searchConfig, showUnsortedOnly, currentCategories]);

  // Pagination
  const displayedEmails = filteredEmails.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredEmails.length;

  // Selected Email
  const selectedEmail = currentEmails.find(e => e.id === selectedEmailId) || null;

  // Counts Logic
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    // 1. Calculate Standard Folders Explicitly
    const standard = [DefaultEmailCategory.INBOX, 'Gesendet', 'Spam', 'Papierkorb'];

    counts[DefaultEmailCategory.INBOX] = currentEmails.filter(e => (!e.folder || e.folder === 'Posteingang') && !e.isRead).length;
    counts['Gesendet'] = currentEmails.filter(e => e.folder === 'Gesendet' && !e.isRead).length;
    counts['Spam'] = currentEmails.filter(e => (e.folder === 'Spam' || e.folder === 'Spamverdacht') && !e.isRead).length;
    counts['Papierkorb'] = currentEmails.filter(e => (e.folder === 'Papierkorb' || e.folder === 'Gelöscht' || e.folder === 'Trash') && !e.isRead).length;

    // 2. Calculate Categories & Physical Folders
    currentCategories.forEach(cat => {
      const catName = cat.name;
      if (standard.includes(catName)) return; // Skip if already handled

      if (cat.type === 'folder') {
        counts[catName] = currentEmails.filter(e => e.folder === catName && !e.isRead).length;
      } else {
        counts[catName] = currentEmails.filter(e => e.smartCategory === catName && !e.isRead).length;
      }
    });

    return counts;
  }, [currentCategories, currentEmails]);

  // Helper to safely update data for active account
  const updateActiveAccountData = (updateFn: (prev: AccountData) => AccountData) => {
    setData(prev => ({
      ...prev,
      [activeAccountId]: updateFn(prev[activeAccountId] || { emails: [], categories: [] })
    }));
  };

  // Load more emails (pagination)
  const loadMoreEmails = () => {
    setVisibleCount(prev => prev + 100);
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
