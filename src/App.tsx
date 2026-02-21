import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DefaultEmailCategory,
  ImapAccount,
  Category,
  AccountData,
  FLAGGED_FOLDER,
  SYSTEM_FOLDERS,
  TRASH_FOLDER,
  SavedFilter,
} from './types';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailView from './components/EmailView';
import SettingsModal from './components/SettingsModal';
import { generateDemoEmails } from './services/geminiService';
import { useAccounts } from './hooks/useAccounts';
import { useAISettings } from './hooks/useAISettings';
import { useEmails } from './hooks/useEmails';
import { useCategories } from './hooks/useCategories';
import { useSelection } from './hooks/useSelection';
import { useBatchOperations } from './hooks/useBatchOperations';
import { useSync } from './hooks/useSync';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useUndoStack } from './hooks/useUndoStack';
import { useSavedFilters } from './hooks/useSavedFilters';
import { useDialogContext } from './contexts/DialogContext';
import TopBar from './components/TopBar';
import BatchActionBar from './components/BatchActionBar';
import ProgressBar from './components/ProgressBar';
import SavedFilterDialog from './components/SavedFilterDialog';

const App: React.FC = () => {
  const { t, ready } = useTranslation();
  const { accounts, activeAccountId, setAccounts, setActiveAccountId, addAccount, removeAccount, switchAccount } =
    useAccounts();
  const { aiSettings, setAiSettings } = useAISettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dialog = useDialogContext();

  // Saved Filters
  const { saveFilter, deleteFilter } = useSavedFilters();
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<{ id: string; name: string; query: string } | null>(null);

  const {
    setData,
    selectedEmailId,
    setSelectedEmailId,
    selectedCategory,
    setSelectedCategory,
    searchTerm,
    setSearchTerm,
    searchConfig,
    setSearchConfig,
    sortConfig,
    setSortConfig,
    showUnsortedOnly,
    setShowUnsortedOnly,
    currentEmails,
    currentCategories,
    filteredEmails,
    displayedEmails,
    selectedEmail,
    categoryCounts,
    canLoadMore,
    updateActiveAccountData,
    loadMoreEmails,
  } = useEmails({ activeAccountId, accounts });

  const { addCategory, deleteCategory, renameCategory, autoDiscoverFolders } = useCategories();

  const handleSelectEmail = async (id: string) => {
    setSelectedEmailId(id);
    if (!activeAccountId || !window.electron) return;
    const email = currentEmails.find((e) => e.id === id);
    if (email && email.body === undefined && email.bodyHtml === undefined) {
      try {
        const content = await window.electron.getEmailContent(id);
        updateActiveAccountData((prev) => ({
          ...prev,
          emails: prev.emails.map((e) =>
            e.id === id ? { ...e, body: content?.body ?? '', bodyHtml: content?.bodyHtml ?? '' } : e
          ),
        }));
      } catch (error) {
        console.error('Failed to load email content:', error);
      }
    }
  };

  const handleDeleteEmail = async (id: string) => {
    const emailToDelete = currentEmails.find((e) => e.id === id);
    if (!emailToDelete) return;
    const isAlreadyInTrash = emailToDelete.folder === TRASH_FOLDER;

    if (isAlreadyInTrash) {
      // Permanently delete if already in trash
      updateActiveAccountData((prev) => ({ ...prev, emails: prev.emails.filter((e) => e.id !== id) }));
    } else {
      // Move to trash in local state
      updateActiveAccountData((prev) => ({
        ...prev,
        emails: prev.emails.map((e) => (e.id === id ? { ...e, folder: TRASH_FOLDER } : e)),
      }));
    }
    if (selectedEmailId === id) setSelectedEmailId(null);
    if (!window.electron || !activeAccountId || !emailToDelete?.uid) return;
    try {
      await window.electron.deleteEmail({
        accountId: activeAccountId,
        emailId: id,
        uid: emailToDelete.uid,
        folder: emailToDelete.folder,
      });
    } catch (error) {
      console.error('Failed to delete email:', error);
      // Rollback: restore email to previous state
      if (emailToDelete) {
        updateActiveAccountData((prev) => ({
          ...prev,
          emails: isAlreadyInTrash
            ? [...prev.emails, emailToDelete].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            : prev.emails.map((e) => (e.id === id ? emailToDelete : e)),
        }));
      }
    }
  };

  const handleToggleRead = async (id: string) => {
    const email = currentEmails.find((e) => e.id === id);
    if (!email) return;
    const previousReadState = email.isRead;
    updateActiveAccountData((prev) => ({
      ...prev,
      emails: prev.emails.map((e) => (e.id === id ? { ...e, isRead: !e.isRead } : e)),
    }));
    if (window.electron && activeAccountId && email.uid) {
      try {
        await window.electron.updateEmailRead({
          accountId: activeAccountId,
          emailId: id,
          uid: email.uid,
          isRead: !previousReadState,
          folder: email.folder,
        });
      } catch (error) {
        console.error('Failed to update read status:', error);
        // Rollback optimistic update
        updateActiveAccountData((prev) => ({
          ...prev,
          emails: prev.emails.map((e) => (e.id === id ? { ...e, isRead: previousReadState } : e)),
        }));
        throw error;
      }
    }
  };

  const handleToggleFlag = useCallback(
    async (id: string) => {
      const email = currentEmails.find((e) => e.id === id);
      if (!email) return;
      const previousFlagState = email.isFlagged;
      updateActiveAccountData((prev) => ({
        ...prev,
        emails: prev.emails.map((e) => (e.id === id ? { ...e, isFlagged: !e.isFlagged } : e)),
      }));
      if (window.electron && activeAccountId && email.uid) {
        try {
          await window.electron.updateEmailFlag({
            accountId: activeAccountId,
            emailId: id,
            uid: email.uid,
            isFlagged: !previousFlagState,
            folder: email.folder,
          });
        } catch (error) {
          console.error('Failed to update flag status:', error);
          // Rollback optimistic update
          updateActiveAccountData((prev) => ({
            ...prev,
            emails: prev.emails.map((e) => (e.id === id ? { ...e, isFlagged: previousFlagState } : e)),
          }));
          throw error;
        }
      }
    },
    [currentEmails, updateActiveAccountData, activeAccountId]
  );

  const { selectedIds, handleRowClick, handleToggleSelection, handleSelectAll, clearSelection } = useSelection({
    filteredEmails,
    onSelectEmail: handleSelectEmail,
  });

  const {
    isSorting,
    sortProgress,
    canSmartSort,
    handleBatchDelete,
    handleBatchSmartSort,
    handleBatchMarkRead,
    handleBatchFlag,
  } = useBatchOperations({
    selectedIds,
    currentEmails,
    currentCategories,
    aiSettings,
    onDeleteEmail: handleDeleteEmail,
    onToggleRead: handleToggleRead,
    onToggleFlag: handleToggleFlag,
    onClearSelection: clearSelection,
    onUpdateEmails: (updateFn) => updateActiveAccountData((prev) => ({ ...prev, emails: updateFn(prev.emails) })),
    onUpdateCategories: (categories) => updateActiveAccountData((prev) => ({ ...prev, categories })),
    onOpenSettings: () => setIsSettingsOpen(true),
    dialog,
  });

  const { isSyncing, syncAccount } = useSync({
    activeAccountId,
    accounts,
    onAccountsUpdate: setAccounts,
    onDataUpdate: (accountId, { emails }) =>
      setData((prev: Record<string, AccountData>) => ({ ...prev, [accountId]: { ...prev[accountId], emails } })),
    dialog,
  });

  const { pushAction, undo, canUndo, lastActionDescription } = useUndoStack();
  const [undoToast, setUndoToast] = useState<string | null>(null);

  const handleMoveToSmartCategory = useCallback(
    (emailIds: string[], category: string) => {
      if (category === FLAGGED_FOLDER) {
        // Toggle flag for each email — store previous states including uid/folder for direct IPC undo
        const previousStates = new Map<string, { isFlagged?: boolean; uid?: number; folder?: string }>();
        emailIds.forEach((id) => {
          const email = currentEmails.find((e) => e.id === id);
          if (email) previousStates.set(id, { isFlagged: email.isFlagged, uid: email.uid, folder: email.folder });
        });

        emailIds.forEach((id) => {
          void handleToggleFlag(id).catch(() => {});
        });

        pushAction({
          type: 'toggle-flag',
          emailIds,
          previousState: previousStates,
          description: t('app.emailsFlagged', { count: emailIds.length }),
          execute: () => {
            // Restore previous flag states directly without re-querying currentEmails
            updateActiveAccountData((prev) => ({
              ...prev,
              emails: prev.emails.map((e) => {
                const prevState = previousStates.get(e.id);
                return prevState ? { ...e, isFlagged: prevState.isFlagged ?? e.isFlagged } : e;
              }),
            }));
            previousStates.forEach((prev, id) => {
              if (window.electron && activeAccountId && prev.uid) {
                void window.electron
                  .updateEmailFlag({
                    accountId: activeAccountId,
                    emailId: id,
                    uid: prev.uid,
                    isFlagged: prev.isFlagged ?? false,
                    folder: prev.folder,
                  })
                  .catch(() => {});
              }
            });
          },
        });
        return;
      }

      // Smart category assignment
      const previousStates = new Map<string, { smartCategory?: string }>();
      emailIds.forEach((id) => {
        const email = currentEmails.find((e) => e.id === id);
        if (email) previousStates.set(id, { smartCategory: email.smartCategory });
      });

      // Optimistic update
      updateActiveAccountData((prev) => ({
        ...prev,
        emails: prev.emails.map((e) => (emailIds.includes(e.id) ? { ...e, smartCategory: category } : e)),
      }));

      // Persist via IPC
      emailIds.forEach((id) => {
        if (window.electron) {
          window.electron.updateEmailSmartCategory({ emailId: id, category }).catch((error) => {
            console.error('Failed to update smart category:', error);
          });
        }
      });

      pushAction({
        type: 'move-category',
        emailIds,
        previousState: previousStates,
        description: t('app.emailsMovedToCategory', { count: emailIds.length, target: category }),
        execute: () => {
          updateActiveAccountData((prev) => ({
            ...prev,
            emails: prev.emails.map((e) => {
              const prevState = previousStates.get(e.id);
              return prevState ? { ...e, smartCategory: prevState.smartCategory } : e;
            }),
          }));
          previousStates.forEach((prev, id) => {
            if (window.electron) {
              window.electron
                .updateEmailSmartCategory({ emailId: id, category: prev.smartCategory ?? '' })
                .catch(() => {});
            }
          });
        },
      });
    },
    [currentEmails, updateActiveAccountData, handleToggleFlag, pushAction, activeAccountId, t]
  );

  const handleMoveToFolder = useCallback(
    (emailIds: string[], folder: string) => {
      const previousStates = new Map<string, { folder?: string }>();
      emailIds.forEach((id) => {
        const email = currentEmails.find((e) => e.id === id);
        if (email) previousStates.set(id, { folder: email.folder });
      });

      // Optimistic update
      updateActiveAccountData((prev) => ({
        ...prev,
        emails: prev.emails.map((e) => (emailIds.includes(e.id) ? { ...e, folder } : e)),
      }));

      // Persist via IPC
      emailIds.forEach((id) => {
        if (window.electron) {
          window.electron.moveEmail({ emailId: id, target: folder, type: 'folder' }).catch((error) => {
            console.error('Failed to move email:', error);
          });
        }
      });

      pushAction({
        type: 'move-folder',
        emailIds,
        previousState: previousStates,
        description: t('app.emailsMovedToFolder', { count: emailIds.length, target: folder }),
        execute: () => {
          updateActiveAccountData((prev) => ({
            ...prev,
            emails: prev.emails.map((e) => {
              const prevState = previousStates.get(e.id);
              return prevState && prevState.folder ? { ...e, folder: prevState.folder } : e;
            }),
          }));
          previousStates.forEach((prev, id) => {
            if (window.electron && prev.folder) {
              window.electron.moveEmail({ emailId: id, target: prev.folder, type: 'folder' }).catch(() => {});
            }
          });
        },
      });
    },
    [currentEmails, updateActiveAccountData, pushAction, t]
  );

  const {
    isDragging,
    draggedEmailIds,
    dropTargetCategory,
    onEmailDragStart,
    onCategoryDragOver,
    onCategoryDragLeave,
    onDragEnd,
  } = useDragAndDrop({
    onMoveToSmartCategory: handleMoveToSmartCategory,
    onMoveToFolder: handleMoveToFolder,
  });

  const handleUndo = useCallback(() => {
    const desc = lastActionDescription;
    undo();
    if (desc) {
      setUndoToast(t('app.undoneAction', { description: desc }));
      setTimeout(() => setUndoToast(null), 3000);
    }
  }, [undo, lastActionDescription, t]);

  // Load initial data
  useEffect(() => {
    (async () => {
      if (!window.electron) return;
      try {
        const loadedAccounts = await window.electron.getAccounts();
        const savedCategories = await window.electron.getCategories();
        if (loadedAccounts.length > 0) {
          setAccounts(loadedAccounts);
          setActiveAccountId(loadedAccounts[0].id);
          const emails = await window.electron.getEmails(loadedAccounts[0].id);
          setData({ [loadedAccounts[0].id]: { emails, categories: savedCategories } });
        } else {
          setIsSettingsOpen(true);
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
        await dialog.alert({
          title: t('common.error'),
          message: t('app.loadDataError'),
          variant: 'danger',
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setAccounts, setActiveAccountId, setData, dialog.alert]);

  // Load saved filters
  useEffect(() => {
    if (!window.electron) return;
    window.electron
      .getSavedFilters()
      .then(setSavedFilters)
      .catch((err) => {
        console.error('Failed to load saved filters:', err);
      });
  }, []);

  // Handle notification clicks
  useEffect(() => {
    if (!window.electron) return;

    const handleNotificationClick = (data: { emailId: string }) => {
      // Navigate to the email
      setSelectedEmailId(data.emailId);

      // Find the email's category and switch to it
      const email = currentEmails.find((e) => e.id === data.emailId);
      if (email && email.smartCategory) {
        setSelectedCategory(email.smartCategory);
      }
    };

    window.electron.onNotificationClicked(handleNotificationClick);

    return () => {
      if (window.electron) {
        window.electron.removeNotificationClickedListener(handleNotificationClick);
      }
    };
  }, [currentEmails, setSelectedEmailId, setSelectedCategory]);

  // Listen for auto-sync completed events and refresh data
  useEffect(() => {
    if (!window.electron) return;

    const handleAutoSyncCompleted = async () => {
      if (!activeAccountId) return;
      try {
        const emails = await window.electron.getEmails(activeAccountId);
        const categories = await window.electron.getCategories();
        setData((prev: Record<string, AccountData>) => ({
          ...prev,
          [activeAccountId]: { ...prev[activeAccountId], emails, categories },
        }));
      } catch (error) {
        console.error('Failed to refresh after auto-sync:', error);
      }
    };

    window.electron.onAutoSyncCompleted(handleAutoSyncCompleted);

    return () => {
      if (window.electron) {
        window.electron.removeAutoSyncCompletedListener(handleAutoSyncCompleted);
      }
    };
  }, [activeAccountId, setData]);

  // Fetch emails when switching accounts
  useEffect(() => {
    (async () => {
      if (!activeAccountId || !window.electron) return;
      try {
        const emails = await window.electron.getEmails(activeAccountId);
        const categories = await window.electron.getCategories();
        await autoDiscoverFolders(emails, categories);
        const finalCategories = await window.electron.getCategories();
        setData((prev: Record<string, AccountData>) => ({
          ...prev,
          [activeAccountId]: { emails, categories: finalCategories },
        }));
      } catch (error) {
        console.error('Failed to switch account:', error);
        await dialog.alert({
          title: t('common.error'),
          message: t('app.loadAccountError'),
          variant: 'danger',
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId, autoDiscoverFolders, setData, dialog.alert]);

  const handleAddAccount = async (newAccount: ImapAccount) => {
    if (window.electron) {
      try {
        await window.electron.addAccount(newAccount);
        addAccount(newAccount);
        switchAccount(newAccount.id);
        const emails = await window.electron.getEmails(newAccount.id);
        setData((prev: Record<string, AccountData>) => ({
          ...prev,
          [newAccount.id]: {
            emails,
            categories: Object.values(DefaultEmailCategory).map((c) => ({ name: c, type: 'system' })),
          },
        }));
      } catch {
        await dialog.alert({
          title: t('common.error'),
          message: t('app.addAccountError'),
          variant: 'danger',
        });
      }
    } else {
      addAccount(newAccount);
      const demoEmails = await generateDemoEmails(5, aiSettings);
      setData((prev: Record<string, AccountData>) => ({
        ...prev,
        [newAccount.id]: {
          emails: demoEmails.map((e) => ({ ...e, id: e.id + '-' + newAccount.id })),
          categories: Object.values(DefaultEmailCategory).map((c) => ({ name: c, type: 'system' })),
        },
      }));
    }
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      <Sidebar
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setSelectedEmailId(null);
          setSearchTerm('');
          clearSelection();
          if (cat === DefaultEmailCategory.INBOX) setShowUnsortedOnly(false);
        }}
        onAddCategory={async (newCategory) => {
          const reservedNames = [...SYSTEM_FOLDERS, FLAGGED_FOLDER];
          if (reservedNames.includes(newCategory)) return;
          if (!currentCategories.some((c) => c.name === newCategory)) {
            updateActiveAccountData((prev) => ({
              ...prev,
              categories: [...prev.categories, { name: newCategory, type: 'custom' }],
            }));
            await addCategory(newCategory, 'custom');
          }
        }}
        categories={currentCategories}
        counts={categoryCounts}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onSwitchAccount={(id) => {
          switchAccount(id);
          setSelectedCategory(DefaultEmailCategory.INBOX);
          setSelectedEmailId(null);
          clearSelection();
          setSearchTerm('');
          setShowUnsortedOnly(false);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onDeleteCategory={async (cat) => {
          updateActiveAccountData((prev) => ({
            ...prev,
            categories: prev.categories.filter((c: Category) => c.name !== cat),
            emails: prev.emails.map((e) => (e.smartCategory === cat ? { ...e, smartCategory: undefined } : e)),
          }));
          await deleteCategory(cat);
        }}
        onRenameCategory={async (oldName, newName) => {
          const reservedNames = [...SYSTEM_FOLDERS, FLAGGED_FOLDER];
          if (reservedNames.includes(newName)) return;
          updateActiveAccountData((prev) => ({
            ...prev,
            categories: prev.categories.map((c: Category) => (c.name === oldName ? { ...c, name: newName } : c)),
            emails: prev.emails.map((e) => (e.smartCategory === oldName ? { ...e, smartCategory: newName } : e)),
          }));
          await renameCategory(oldName, newName);
        }}
        isDraggingEmails={isDragging}
        dropTargetCategory={dropTargetCategory}
        onCategoryDragOver={onCategoryDragOver}
        onCategoryDragLeave={onCategoryDragLeave}
        savedFilters={savedFilters}
        onExecuteFilter={(query) => setSearchTerm(query)}
        onCreateFilter={() => {
          setEditingFilter(null);
          setFilterDialogOpen(true);
        }}
        onEditFilter={(filter) => {
          setEditingFilter(filter);
          setFilterDialogOpen(true);
        }}
        onDeleteFilter={async (filterId) => {
          try {
            await deleteFilter(filterId);
            setSavedFilters((prev) => prev.filter((f) => f.id !== filterId));
          } catch (error) {
            console.error('Failed to delete filter:', error);
            await dialog.alert({
              title: t('common.error'),
              message: t('app.filterDeleteError', 'Failed to delete filter'),
              variant: 'danger',
            });
          }
        }}
        onDropEmails={async (emailIds, targetCategory, targetType) => {
          if (targetType === 'smart' && targetCategory === '__new_category__') {
            const name = await dialog.prompt({
              title: t('app.newCategory'),
              message: t('app.newCategoryPrompt'),
              confirmText: t('app.create'),
              cancelText: t('common.cancel'),
              variant: 'info',
            });
            if (!name || !name.trim()) return;
            const trimmed = name.trim();
            const reservedNames = [...SYSTEM_FOLDERS, FLAGGED_FOLDER];
            if (reservedNames.includes(trimmed)) return;
            if (!currentCategories.some((c) => c.name === trimmed)) {
              updateActiveAccountData((prev) => ({
                ...prev,
                categories: [...prev.categories, { name: trimmed, type: 'custom' }],
              }));
              await addCategory(trimmed, 'custom');
            }
            handleMoveToSmartCategory(emailIds, trimmed);
            return;
          }
          if (targetType === 'folder') {
            handleMoveToFolder(emailIds, targetCategory);
          } else {
            handleMoveToSmartCategory(emailIds, targetCategory);
          }
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          selectedCategory={selectedCategory}
          filteredEmailsCount={filteredEmails.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchConfig={searchConfig}
          onSearchConfigChange={setSearchConfig}
          sortConfig={sortConfig}
          onSortConfigChange={setSortConfig}
          showUnsortedOnly={showUnsortedOnly}
          onToggleUnsorted={() => setShowUnsortedOnly(!showUnsortedOnly)}
          onSync={syncAccount}
          isSorting={isSorting || isSyncing}
        />

        <BatchActionBar
          filteredEmails={filteredEmails}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onBatchDelete={handleBatchDelete}
          onBatchSmartSort={handleBatchSmartSort}
          onBatchMarkRead={handleBatchMarkRead}
          onBatchFlag={handleBatchFlag}
          canSmartSort={canSmartSort}
          aiSettings={aiSettings}
        />

        {isSorting && (
          <ProgressBar label={t('app.aiSortingProgress', { provider: aiSettings.provider })} progress={sortProgress} />
        )}

        <div className="flex-1 flex overflow-hidden">
          <EmailList
            emails={displayedEmails}
            selectedEmailId={selectedEmailId}
            selectedIds={selectedIds}
            onRowClick={handleRowClick}
            onToggleSelection={handleToggleSelection}
            onDeleteEmail={handleDeleteEmail}
            onToggleRead={(id) => handleToggleRead(id).catch(() => {})}
            onToggleFlag={(id) => handleToggleFlag(id).catch(() => {})}
            isLoading={false}
            onLoadMore={loadMoreEmails}
            hasMore={canLoadMore}
            onDragStart={onEmailDragStart}
            onDragEnd={onDragEnd}
            draggedEmailIds={draggedEmailIds}
            searchQuery={searchTerm}
          />
          <EmailView email={selectedEmail} searchQuery={searchTerm} />
        </div>

        {undoToast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50 flex items-center gap-2">
            <span>{undoToast}</span>
          </div>
        )}

        {canUndo && !undoToast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <button
              type="button"
              onClick={handleUndo}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <span>↩</span>
              <span>{t('app.undoButton')}</span>
            </button>
          </div>
        )}

        <SavedFilterDialog
          isOpen={filterDialogOpen}
          onClose={() => {
            setFilterDialogOpen(false);
            setEditingFilter(null);
          }}
          onSave={async (name, query) => {
            try {
              const id = editingFilter?.id || crypto.randomUUID();
              await saveFilter(id, name, query);
              // Refresh filters list
              if (window.electron) {
                const filters = await window.electron.getSavedFilters();
                setSavedFilters(filters);
              }
            } catch (error) {
              console.error('Failed to save filter:', error);
              await dialog.alert({
                title: t('common.error'),
                message: t('app.filterSaveError', 'Failed to save filter'),
                variant: 'danger',
              });
            }
          }}
          initialName={editingFilter?.name}
          initialQuery={editingFilter?.query || searchTerm}
          mode={editingFilter ? 'edit' : 'create'}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          accounts={accounts}
          onAddAccount={handleAddAccount}
          onRemoveAccount={async (id) => {
            removeAccount(id);
            setData((prev: Record<string, AccountData>) => {
              const { [id]: _removed, ...rest } = prev;
              return rest;
            });
            if (window.electron) await window.electron.deleteAccount(id);
          }}
          aiSettings={aiSettings}
          onSaveAISettings={setAiSettings}
        />
      </div>
    </div>
  );
};

export default App;
