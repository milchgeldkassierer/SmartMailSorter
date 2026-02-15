import React, { useState, useEffect, useCallback } from 'react';
import { DefaultEmailCategory, ImapAccount, Category, AccountData, FLAGGED_FOLDER, SYSTEM_FOLDERS } from './types';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailView from './components/EmailView';
import SettingsModal from './components/SettingsModal';
import { generateDemoEmails } from './services/geminiService';
import { useAuth } from './hooks/useAuth';
import { useAccounts } from './hooks/useAccounts';
import { useAISettings } from './hooks/useAISettings';
import { useEmails } from './hooks/useEmails';
import { useCategories } from './hooks/useCategories';
import { useSelection } from './hooks/useSelection';
import { useBatchOperations } from './hooks/useBatchOperations';
import { useSync } from './hooks/useSync';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useUndoStack } from './hooks/useUndoStack';
import { useDialogContext } from './contexts/DialogContext';
import TopBar from './components/TopBar';
import BatchActionBar from './components/BatchActionBar';
import ProgressBar from './components/ProgressBar';

const App: React.FC = () => {
  const { setIsAuthenticated, setIsConnecting } = useAuth();
  const { accounts, activeAccountId, setAccounts, setActiveAccountId, addAccount, removeAccount, switchAccount } =
    useAccounts();
  const { aiSettings, setAiSettings } = useAISettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dialog = useDialogContext();

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
    updateActiveAccountData((prev) => ({ ...prev, emails: prev.emails.filter((e) => e.id !== id) }));
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
      // Rollback: restore email to state
      if (emailToDelete) {
        updateActiveAccountData((prev) => ({
          ...prev,
          emails: [...prev.emails, emailToDelete].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          ),
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

  const handleToggleFlag = async (id: string) => {
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
  };

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
        // Toggle flag for each email
        const previousStates = new Map<string, { isFlagged?: boolean }>();
        emailIds.forEach((id) => {
          const email = currentEmails.find((e) => e.id === id);
          if (email) previousStates.set(id, { isFlagged: email.isFlagged });
        });

        emailIds.forEach((id) => handleToggleFlag(id).catch(() => {}));

        pushAction({
          type: 'toggle-flag',
          emailIds,
          previousState: previousStates,
          description: `${emailIds.length} Email(s) markiert`,
          execute: () => {
            previousStates.forEach((prev, id) => {
              const email = currentEmails.find((e) => e.id === id);
              if (email && email.isFlagged !== prev.isFlagged) {
                handleToggleFlag(id).catch(() => {});
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
        description: `${emailIds.length} Email(s) nach ${category} verschoben`,
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
    [currentEmails, updateActiveAccountData, handleToggleFlag, pushAction]
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
        description: `${emailIds.length} Email(s) nach ${folder} verschoben`,
        execute: () => {
          updateActiveAccountData((prev) => ({
            ...prev,
            emails: prev.emails.map((e) => {
              const prevState = previousStates.get(e.id);
              return prevState ? { ...e, folder: prevState.folder! } : e;
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
    [currentEmails, updateActiveAccountData, pushAction]
  );

  const { isDragging, draggedEmailIds, dropTargetCategory, onEmailDragStart, onDragEnd } = useDragAndDrop({
    onMoveToSmartCategory: handleMoveToSmartCategory,
    onMoveToFolder: handleMoveToFolder,
  });

  const handleUndo = useCallback(() => {
    const desc = lastActionDescription;
    undo();
    if (desc) {
      setUndoToast(`Rückgängig: ${desc}`);
      setTimeout(() => setUndoToast(null), 3000);
    }
  }, [undo, lastActionDescription]);

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
          setIsAuthenticated(true);
          const emails = await window.electron.getEmails(loadedAccounts[0].id);
          setData({ [loadedAccounts[0].id]: { emails, categories: savedCategories } });
        } else {
          setIsAuthenticated(true);
          setIsSettingsOpen(true);
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
        await dialog.alert({
          title: 'Fehler',
          message: 'Fehler beim Laden der Daten',
          variant: 'danger',
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setAccounts, setActiveAccountId, setData, setIsAuthenticated, dialog.alert]);

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
          title: 'Fehler',
          message: 'Fehler beim Laden des Kontos',
          variant: 'danger',
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId, autoDiscoverFolders, setData, dialog.alert]);

  const handleAddAccount = async (newAccount: ImapAccount) => {
    if (window.electron) {
      setIsConnecting(true);
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
        setIsAuthenticated(true);
      } catch {
        await dialog.alert({
          title: 'Fehler',
          message: 'Konto konnte nicht hinzugefügt werden. Prüfe die Daten.',
          variant: 'danger',
        });
      } finally {
        setIsConnecting(false);
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
        onReset={() => setIsAuthenticated(false)}
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
        onDropEmails={(emailIds, targetCategory, targetType) => {
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

        {isSorting && <ProgressBar label={`AI sortiert Emails... (${aiSettings.provider})`} progress={sortProgress} />}

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
          />
          <EmailView email={selectedEmail} />
        </div>

        {undoToast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50 flex items-center gap-2">
            <span>{undoToast}</span>
          </div>
        )}

        {canUndo && !undoToast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={handleUndo}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <span>↩</span>
              <span>Rückgängig (Ctrl+Z)</span>
            </button>
          </div>
        )}

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
            if (accounts.length === 1) setIsAuthenticated(false);
          }}
          aiSettings={aiSettings}
          onSaveAISettings={setAiSettings}
        />
      </div>
    </div>
  );
};

export default App;
