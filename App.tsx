import React, { useState, useEffect, useMemo } from 'react';
import { Email, DefaultEmailCategory, ImapAccount, AISettings, LLMProvider, AVAILABLE_MODELS } from './types';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailView from './components/EmailView';
import SettingsModal from './components/SettingsModal';
import SearchBar, { SearchConfig } from './components/SearchBar';
import { generateDemoEmails, categorizeEmailWithAI, categorizeBatchWithAI } from './services/geminiService';
import { RefreshCw, BrainCircuit, Search, Trash2, Filter } from './components/Icon';
import { useAuth } from './hooks/useAuth';
import { useAccounts } from './hooks/useAccounts';
import TopBar from './components/TopBar';
import BatchActionBar from './components/BatchActionBar';

// Structure to hold data per account
interface AccountData {
  emails: Email[];
  categories: { name: string, type: string }[];
}

const App: React.FC = () => {
  // Custom Hooks
  const {
    isAuthenticated,
    isConnecting,
    setIsAuthenticated,
    setIsConnecting
  } = useAuth();

  const {
    accounts,
    activeAccountId,
    activeAccount,
    setAccounts,
    setActiveAccountId,
    addAccount,
    removeAccount,
    switchAccount
  } = useAccounts();

  // AI Settings State (Default to Gemini)
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('smartmail_ai_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse AI settings", e);
      }
    }
    return {
      provider: LLMProvider.GEMINI,
      model: AVAILABLE_MODELS[LLMProvider.GEMINI][0],
      apiKey: ''
    };
  });

  // Persist AI Settings
  useEffect(() => {
    localStorage.setItem('smartmail_ai_settings', JSON.stringify(aiSettings));
  }, [aiSettings]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Data State - stored by account ID
  const [data, setData] = useState<Record<string, AccountData>>({});

  // UI Selection State
  const [selectedCategory, setSelectedCategory] = useState<string>(DefaultEmailCategory.INBOX);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); // New: Multi-select
  const [isSorting, setIsSorting] = useState(false);
  const [sortProgress, setSortProgress] = useState(0);

  // Top Bar Filter State
  const [showUnsortedOnly, setShowUnsortedOnly] = useState(false);

  // Helper to extract unique categories from emails
  const getCategoriesFromEmails = (emails: Email[]) => {
    const customcats = new Set<string>();
    emails.forEach(e => {
      if (e.smartCategory) customcats.add(e.smartCategory);
    });
    // Ensure defaults are always there
    const defaults = Object.values(DefaultEmailCategory);
    return Array.from(new Set([...defaults, ...Array.from(customcats)]));
  };

  // Load initial data from Electron
  useEffect(() => {
    const loadData = async () => {
      if (window.electron) {
        const componentAccounts = await window.electron.getAccounts();

        // Always load persistent categories from DB
        const savedCategories = await window.electron.getCategories();

        if (componentAccounts.length > 0) {
          setAccounts(componentAccounts);
          setActiveAccountId(componentAccounts[0].id);
          setIsAuthenticated(true);

          // Load emails for first account
          const emails = await window.electron.getEmails(componentAccounts[0].id);

          setData(prev => ({
            ...prev,
            [componentAccounts[0].id]: { emails, categories: savedCategories }
          }));
        } else {
          // No accounts, show UI and open settings
          setIsAuthenticated(true);
          setIsSettingsOpen(true);
        }
      }
    };
    loadData();
  }, []);

  // Fetch emails when switching accounts
  useEffect(() => {
    const fetchEmails = async () => {
      if (activeAccountId && window.electron) {
        const emails = await window.electron.getEmails(activeAccountId);
        const savedCategories = await window.electron.getCategories(); // DB Categories: { name, type }[]

        // Dynamic Folder Discovery (Subfolders)
        const systemFolders = Object.values(DefaultEmailCategory);
        const mappedFolders = ['Gesendet', 'Spam', 'Papierkorb', 'Posteingang']; // German mappings

        const foundFolders = new Set<string>();
        // Map of folders needing type correction (if they exist as 'custom' but are physical)
        const categoriesToFix = new Set<string>();

        // We need a quick lookup set for existing categories
        const existingCategoryNames = new Set(savedCategories.map((c: any) => c.name));
        const existingCategoryTypes = new Map(savedCategories.map((c: any) => [c.name, c.type]));

        emails.forEach(e => {
          if (e.folder &&
            !systemFolders.includes(e.folder as any) &&
            !mappedFolders.includes(e.folder)
          ) {
            // It's a physical folder candidate
            if (!existingCategoryNames.has(e.folder)) {
              foundFolders.add(e.folder);
            } else {
              // It exists. Check if type matches. Default was 'custom', we want 'folder'.
              // Optimization: Only update if it is currently 'custom' to save DB writes
              if (existingCategoryTypes.get(e.folder) === 'custom') {
                categoriesToFix.add(e.folder);
              }
            }
          }
        });

        // 1. Add missing discovered folders
        const newDiscovered = Array.from(foundFolders);
        for (const folder of newDiscovered) {
          console.log("Auto-discovering folder:", folder);
          await window.electron.addCategory(folder, 'folder'); // Explicit type
        }

        // 2. Fix incorrect types for existing physical folders
        const fixedCategories = Array.from(categoriesToFix);
        for (const folder of fixedCategories) {
          console.log("Fixing category type for:", folder);
          await window.electron.updateCategoryType(folder, 'folder');
        }

        // Refetch if changes occurred
        const finalCategories = (newDiscovered.length > 0 || fixedCategories.length > 0)
          ? await window.electron.getCategories()
          : savedCategories;

        setData(prev => ({
          ...prev,
          [activeAccountId]: { emails, categories: finalCategories }
        }));
      }
    };
    fetchEmails();
  }, [activeAccountId]);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    searchSender: true,
    searchSubject: true,
    searchBody: false, // Body search is slower/noisier by default
    logic: 'AND'
  });

  // Computed properties based on Active Account
  const activeData = data[activeAccountId] || { emails: [], categories: [] };
  const currentEmails = activeData.emails;
  const currentCategories = activeData.categories;

  // --- Filtering Logic ---
  const filteredEmails = useMemo(() => {
    let result = currentEmails;

    // 1. Initial Filtering by Folder OR Smart Category
    if (selectedCategory === DefaultEmailCategory.INBOX || selectedCategory === 'Posteingang') { // Handle both just in case
      result = result.filter(e => (!e.folder || e.folder === 'Posteingang') && e.folder !== 'Gesendet' && e.folder !== 'Spam' && e.folder !== 'Papierkorb');

      // Unsorted Toggle
      if (showUnsortedOnly) {
        result = result.filter(e => !e.smartCategory);
      }
    } else if (['Gesendet', 'Spam', 'Papierkorb'].includes(selectedCategory)) {
      result = result.filter(e => e.folder === selectedCategory);
    } else {
      // Check if it's a known physical folder
      const catInfo = currentCategories.find((c: any) => c.name === selectedCategory);

      console.log('Filtering debug:', { selectedCategory, catType: catInfo?.type, found: !!catInfo });

      if (catInfo && catInfo.type === 'folder') {
        // Physical Folder Logic: Handle full path (Posteingang/Crypto) vs short name (Crypto) mismatch
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
          const inBody = searchConfig.searchBody && email.body.toLowerCase().includes(term);
          return inSender || inSubject || inBody;
        };
        return searchConfig.logic === 'AND' ? terms.every(checkTerm) : terms.some(checkTerm);
      });
    }

    return result;
  }, [currentEmails, selectedCategory, searchTerm, searchConfig, showUnsortedOnly]);

  // PAGINATION
  const [visibleCount, setVisibleCount] = useState(100);

  // Reset pagination when filter/category changes
  useEffect(() => {
    setVisibleCount(100);
  }, [selectedCategory, searchTerm, showUnsortedOnly, activeAccountId]);

  const displayedEmails = filteredEmails.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredEmails.length;

  const selectedEmail = currentEmails.find(e => e.id === selectedEmailId) || null;

  // Counts Logic
  // Counts Logic
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
    currentCategories.forEach((cat: any) => {
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
      [activeAccountId]: updateFn(prev[activeAccountId] || { emails: [], categories: Object.values(DefaultEmailCategory) })
    }));
  };

  const handleSwitchAccount = (id: string) => {
    switchAccount(id);
    setSelectedCategory(DefaultEmailCategory.INBOX);
    setSelectedEmailId(null);
    setSelectedIds(new Set()); // Clear selection
    setSearchTerm(''); // Reset search on account switch
    setShowUnsortedOnly(false);
  };

  const handleAddAccount = async (newAccount: ImapAccount) => {
    if (window.electron) {
      setIsConnecting(true);
      try {
        await window.electron.addAccount(newAccount);
        addAccount(newAccount);
        switchAccount(newAccount.id);

        // Sync immediately
        const emails = await window.electron.getEmails(newAccount.id);
        setData(prev => ({
          ...prev,
          [newAccount.id]: { emails, categories: Object.values(DefaultEmailCategory) }
        }));
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Failed to add account:", error);
        alert("Konto konnte nicht hinzugefügt werden. Prüfe die Daten.");
      } finally {
        setIsConnecting(false);
      }
    } else {
      // Fallback for browser dev mode
      addAccount(newAccount);
      setData(prev => ({
        ...prev,
        [newAccount.id]: { emails: [], categories: Object.values(DefaultEmailCategory).map(c => ({ name: c, type: 'system' })) }
      }));
      // Auto-generate some emails
      const demoEmails = await generateDemoEmails(5, aiSettings);
      setData(prev => ({
        ...prev,
        [newAccount.id]: {
          emails: demoEmails.map(e => ({ ...e, id: e.id + '-' + newAccount.id })),
          categories: Object.values(DefaultEmailCategory).map(c => ({ name: c, type: 'system' }))
        }
      }));
    }
  };

  const handleRemoveAccount = async (id: string) => {
    // Remove from UI immediately using hook
    removeAccount(id);

    // Clean up data state
    setData(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    // Remove from Backend
    if (window.electron) {
      await window.electron.deleteAccount(id);
    }

    // If no accounts left, set unauthenticated
    if (accounts.length === 1) {
      setIsAuthenticated(false);
    }
  };

  const handleAddCategory = async (newCategory: string) => {
    if (!currentCategories.some((c: any) => c.name === newCategory)) {
      // Optimistic UI Update
      updateActiveAccountData(prev => ({
        ...prev,
        categories: [...prev.categories, { name: newCategory, type: 'custom' }]
      }));
      // Persist to DB
      if (window.electron) await window.electron.addCategory(newCategory, 'custom');
    }
  };

  // --- Email Actions ---

  const handleSelectEmail = async (id: string) => {
    setSelectedEmailId(id);

    // Check if we have the content (lazy load body)
    if (activeAccountId && window.electron) {
      const email = activeData.emails.find(e => e.id === id);
      // Fix: Check for undefined specifically (property missing)
      // If it is null or empty string, it means we already tried loading it.
      if (email && email.body === undefined && email.bodyHtml === undefined) {
        console.log(`[LazyLoad] Triggering load for email ${id}`);
        try {
          const content = await window.electron.getEmailContent(id);
          console.log(`[LazyLoad] RECV CONTENT: ${content ? "OK" : "NULL"}`, content);

          // Content might be null, but we must set it to something (e.g. empty string) so we don't fetch again
          // fallback to "" to ensure EmailView renders empty state instead of spinner
          const newBody = content?.body ?? "";
          const newHtml = content?.bodyHtml ?? "";

          updateActiveAccountData(prev => ({
            ...prev,
            emails: prev.emails.map(e => e.id === id ? { ...e, body: newBody, bodyHtml: newHtml } : e)
          }));
          console.log(`[LazyLoad] State updated for ${id}`);
        } catch (err) {
          console.error(`[LazyLoad] Error loading content for ${id}:`, err);
        }
      } else {
        console.log(`[LazyLoad] Skipping load for ${id}. Body present? ${email?.body !== undefined}`);
      }
    }
  }


  const handleDeleteEmail = async (id: string) => {
    // Optimistic UI update
    updateActiveAccountData(prev => ({
      ...prev,
      emails: prev.emails.filter(e => e.id !== id)
    }));

    if (selectedEmailId === id) {
      setSelectedEmailId(null);
    }

    // Call Backend
    if (window.electron && activeAccountId) {
      const email = activeData.emails.find(e => e.id === id);
      const account = accounts.find(a => a.id === activeAccountId);

      if (email && email.uid && account) {
        try {
          await window.electron.deleteEmail({
            account,
            emailId: id,
            uid: email.uid,
            folder: email.folder
          });
        } catch (e) {
          console.error("Failed to delete email", e);
        }
      }
    }
  };

  const handleToggleRead = async (id: string) => {
    const email = activeData.emails.find(e => e.id === id);
    if (!email) return;

    // Optimistic Update
    updateActiveAccountData(prev => ({
      ...prev,
      emails: prev.emails.map(e => e.id === id ? { ...e, isRead: !e.isRead } : e)
    }));

    // Call Backend
    if (window.electron && activeAccountId) {
      const account = accounts.find(a => a.id === activeAccountId);
      if (email.uid && account) {
        try {
          await window.electron.updateEmailRead({
            account,
            emailId: id,
            uid: email.uid,
            isRead: !email.isRead,
            folder: email.folder
          });
        } catch (e) {
          console.error("Failed to update read status", e);
        }
      }
    }
  };

  const handleToggleFlag = async (id: string) => {
    const email = activeData.emails.find(e => e.id === id);
    if (!email) return;

    // Optimistic Update
    updateActiveAccountData(prev => ({
      ...prev,
      emails: prev.emails.map(e => e.id === id ? { ...e, isFlagged: !e.isFlagged } : e)
    }));

    // Call Backend
    if (window.electron && activeAccountId) {
      const account = accounts.find(a => a.id === activeAccountId);
      if (email.uid && account) {
        try {
          await window.electron.updateEmailFlag({
            account,
            emailId: id,
            uid: email.uid,
            isFlagged: !email.isFlagged,
            folder: email.folder
          });
        } catch (e) {
          console.error("Failed to update flag status", e);
        }
      }
    }
  };

  // --- Batch Actions ---

  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const handleSelection = (id: string, multi: boolean, range: boolean) => {
    let next = new Set(selectedIds);

    if (range && lastClickedId && filteredEmails.length > 0) {
      // Range Selection
      const currentIndex = filteredEmails.findIndex(e => e.id === id);
      const lastIndex = filteredEmails.findIndex(e => e.id === lastClickedId);

      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);
        const rangeIds = filteredEmails.slice(start, end + 1).map(e => e.id);
        rangeIds.forEach(rid => next.add(rid));
      }
    } else if (multi) {
      // Toggle Selection (Ctrl+Click)
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setLastClickedId(id);
    } else {
      // Single Selection or toggle via checkbox
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setLastClickedId(id);
    }
    setSelectedIds(next);
  };

  const handleRowClick = (id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      handleSelection(id, true, false);
    } else if (e.shiftKey) {
      window.getSelection()?.removeAllRanges();
      handleSelection(id, false, true);
    } else {
      handleSelectEmail(id);
    }
  };

  // Replaces handleToggleSelection (simple version)
  const handleToggleSelection = (id: string) => {
    handleSelection(id, false, false);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedIds.size === filteredEmails.length && filteredEmails.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmails.map(e => e.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size} Emails wirklich löschen?`)) return;

    const ids = Array.from(selectedIds);
    // Process in parallel
    await Promise.all(ids.map(id => handleDeleteEmail(id)));
    setSelectedIds(new Set());
  };

  // --- Smart Sort ---

  const handleBatchSmartSort = async () => {
    console.log("Starting Smart Sort...");
    if (selectedIds.size === 0) return;
    if (!aiSettings.apiKey) {
      alert("Bitte AI Settings (API Key) konfigurieren!");
      setIsSettingsOpen(true);
      return;
    }

    setIsSorting(true);
    setSortProgress(5); // Start progress

    try {
      const emailsToSort = currentEmails.filter(e => selectedIds.has(e.id));
      console.log(`Sorting ${emailsToSort.length} emails using ${aiSettings.provider}...`);

      const newCategoriesFound = new Set<string>();
      const emailResults = new Map<string, any>(); // Map emailId -> Result

      // 1. Analyze all emails in chunks
      let processed = 0;
      const chunkSize = 5; // Increased chunk size for batching efficiency

      for (let i = 0; i < emailsToSort.length; i += chunkSize) {
        const chunk = emailsToSort.slice(i, i + chunkSize);
        console.log(`Processing batch ${Math.ceil((i + 1) / chunkSize)} of ${Math.ceil(emailsToSort.length / chunkSize)}`);

        // NEW: Ensure we have content for this chunk (lazy load for AI)
        const enrichedChunk = await Promise.all(chunk.map(async (e) => {
          if ((e.body === undefined && e.bodyHtml === undefined) && window.electron) {
            const content = await window.electron.getEmailContent(e.id);
            if (content) {
              return { ...e, body: content.body, bodyHtml: content.bodyHtml };
            }
          }
          return e;
        }));

        // NEW: Batch Call
        // Map objects to strings for AI service
        const categoryNames = currentCategories.map((c: any) => c.name);
        const batchResults = await categorizeBatchWithAI(enrichedChunk, categoryNames, aiSettings);

        // Map results back to structure
        const results = enrichedChunk.map((email, index) => {
          const sortResult = batchResults[index];
          console.log(`Analyzed email ${email.id}:`, sortResult);
          return { id: email.id, sortResult };
        });

        // Store valid results
        results.forEach(r => {
          if (r.sortResult.confidence > 0) { // Filter out hard errors if any
            emailResults.set(r.id, r.sortResult);
            // Check if unique and new
            const cat = r.sortResult.categoryId;
            const exists = currentCategories.some((c: any) => c.name === cat);
            if (!exists && !Object.values(DefaultEmailCategory).includes(cat as any)) {
              newCategoriesFound.add(cat);
            }
          }
        });

        processed += chunk.length;
        setSortProgress(5 + (processed / emailsToSort.length) * 85); // 5-90% is analysis
      }

      console.log("Analysis complete. Found new categories:", Array.from(newCategoriesFound));

      // 2. Popup Confirmation for New Folders
      let allowedNewCategories = new Set<string>();

      if (newCategoriesFound.size > 0) {
        const newArr = Array.from(newCategoriesFound);
        // Simple confirmation flow 
        const confirmed = confirm(
          `Die KI schlägt folgende neue Ordner vor:\n\n${newArr.join(', ')}\n\nSollen diese angelegt werden?\n(Bei 'Abbrechen' werden die Mails in 'Sonstiges' verschoben)`
        );

        if (confirmed) {
          allowedNewCategories = newCategoriesFound;
        } else {
          console.log("User rejected new categories.");
        }
      }

      // 3. Apply Updates (Backend & State)
      const updates: any[] = [];

      console.log("Applying updates to backend...");

      // Updates for Backend
      for (const [emailId, result] of emailResults.entries()) {
        let finalCategory = result.categoryId;

        // If it's a new category but user denied creation, fallback to OTHER or keep in INBOX (using OTHER here for visibility)
        if (newCategoriesFound.has(finalCategory) && !allowedNewCategories.has(finalCategory)) {
          finalCategory = DefaultEmailCategory.OTHER;
        }

        updates.push({
          emailId,
          category: finalCategory,
          summary: result.summary,
          reasoning: result.reasoning,
          confidence: result.confidence
        });

        // Execute IPC Backend Update
        if (window.electron) {
          await window.electron.updateEmailSmartCategory({
            emailId,
            category: finalCategory,
            summary: result.summary,
            reasoning: result.reasoning,
            confidence: result.confidence
          });
        }
      }

      console.log(`Updated ${updates.length} emails in backend.`);

      // 4. Update Frontend State safely (once)
      updateActiveAccountData(prev => {
        const updatedEmails = prev.emails.map(email => {
          const update = updates.find(u => u.emailId === email.id);
          if (update) {
            return {
              ...email,
              smartCategory: update.category, // VIRTUAL UPDATE
              aiSummary: update.summary,
              aiReasoning: update.reasoning,
              confidence: update.confidence
            };
          }
          return email;
        });

        // Add ONLY allowed new categories
        let newCats = [...prev.categories];
        allowedNewCategories.forEach(catName => {
          // Check if exists by name (because newCats contains objects)
          const exists = newCats.some((c: any) => c.name === catName);
          if (!exists) {
            // Push proper object shape
            newCats.push({ name: catName, type: 'custom' });

            // Trigger Async Persist (no await needed here to not block UI)
            if (window.electron) window.electron.addCategory(catName, 'custom');
          }
        });

        return {
          emails: updatedEmails,
          categories: newCats
        };
      });

      console.log("Frontend state updated.");
      setSortProgress(100);
      await new Promise(r => setTimeout(r, 500)); // Show 100% briefly

      // Success feedback if something happened
      if (updates.length > 0) {
        // alert(`${updates.length} Emails erfolgreich sortiert!`);
      }

    } catch (e) {
      console.error("CRITICAL Smart Sort Error:", e);
      alert("Ein Fehler ist beim Sortieren aufgetreten. Bitte Konsole öffnen für Details.");
    } finally {
      console.log("Smart Sort Finished. Cleaning up...");
      setIsSorting(false);
      setSortProgress(0);
      setSelectedIds(new Set());
    }
  };

  const handleSync = async () => {
    if (!window.electron || !activeAccountId) return;
    setIsSorting(true);
    const account = accounts.find(a => a.id === activeAccountId);
    if (account) {
      await window.electron.syncAccount(account);
      // Refresh Emails AND Account Info (Quota)
      const emails = await window.electron.getEmails(activeAccountId);
      const updatedAccounts = await window.electron.getAccounts(); // Load fresh account data

      setAccounts(updatedAccounts); // Update UI with new Quota
      setData(prev => ({
        ...prev,
        [activeAccountId]: { ...prev[activeAccountId], emails }
      }));
    }
    setIsSorting(false);
  };

  // Determine if Smart Sort button should be enabled
  const canSmartSort = selectedIds.size > 0 && aiSettings.provider && aiSettings.apiKey;

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      <Sidebar
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setSelectedEmailId(null);
          setSearchTerm('');
          setSelectedIds(new Set()); // Start fresh on folder change
          if (cat === DefaultEmailCategory.INBOX) setShowUnsortedOnly(false);
        }}
        onAddCategory={handleAddCategory}
        categories={currentCategories}
        counts={categoryCounts}
        isProcessing={isSorting}
        onReset={() => setIsAuthenticated(false)}

        accounts={accounts}
        activeAccountId={activeAccountId}
        onSwitchAccount={handleSwitchAccount}
        onOpenSettings={() => setIsSettingsOpen(true)}

        onDeleteCategory={async (cat) => {
          // Frontend Update
          updateActiveAccountData(prev => ({
            ...prev,
            categories: prev.categories.filter(c => c !== cat),
            emails: prev.emails.map(e => e.smartCategory === cat ? { ...e, smartCategory: undefined } : e)
          }));
          // Backend Update
          if (window.electron) await window.electron.deleteSmartCategory(cat);
        }}

        onRenameCategory={async (oldName, newName) => {
          // Frontend Update
          updateActiveAccountData(prev => ({
            ...prev,
            categories: prev.categories.map(c => c === oldName ? newName : c),
            emails: prev.emails.map(e => e.smartCategory === oldName ? { ...e, smartCategory: newName } : e)
          }));
          // Backend Update
          if (window.electron) await window.electron.renameSmartCategory({ oldName, newName });
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <TopBar
          selectedCategory={selectedCategory}
          filteredEmailsCount={filteredEmails.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchConfig={searchConfig}
          onSearchConfigChange={setSearchConfig}
          showUnsortedOnly={showUnsortedOnly}
          onToggleUnsorted={() => setShowUnsortedOnly(!showUnsortedOnly)}
          onSync={handleSync}
          isSorting={isSorting}
        />

        {/* Batch Action Bar */}
        <BatchActionBar
          filteredEmails={filteredEmails}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onBatchDelete={handleBatchDelete}
          onBatchSmartSort={handleBatchSmartSort}
          canSmartSort={canSmartSort}
          aiSettings={aiSettings}
        />

        {/* Progress Bar (if sorting) */}
        {isSorting && (
          <div className="bg-slate-50 px-6 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs text-blue-600 font-medium">AI sortiert Emails... ({aiSettings.provider})</span>
            <div className="w-48 bg-slate-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${sortProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          <EmailList
            emails={displayedEmails}
            selectedEmailId={selectedEmailId}
            selectedIds={selectedIds}
            onSelectEmail={handleSelectEmail}
            onRowClick={handleRowClick}
            onToggleSelection={(id, shiftKey) => handleSelection(id, false, shiftKey)}
            onDeleteEmail={handleDeleteEmail}
            onToggleRead={handleToggleRead}
            onToggleFlag={handleToggleFlag}
            isLoading={false}
            onLoadMore={() => setVisibleCount(prev => prev + 100)}
            hasMore={canLoadMore}
          />
          <EmailView email={selectedEmail} />
        </div>

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          accounts={accounts}
          onAddAccount={handleAddAccount}
          onRemoveAccount={handleRemoveAccount}
          aiSettings={aiSettings}
          onSaveAISettings={setAiSettings}
        />
      </div>
    </div>
  );
};

export default App;