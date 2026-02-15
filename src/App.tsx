import React, { useState, useEffect } from 'react';
import { DefaultEmailCategory, ImapAccount, Category, AccountData } from './types';
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
import { useDialog } from './hooks/useDialog';
import TopBar from './components/TopBar';
import BatchActionBar from './components/BatchActionBar';
import ProgressBar from './components/ProgressBar';
import ConfirmDialog from './components/ConfirmDialog';

const App: React.FC = () => {
  const { setIsAuthenticated, setIsConnecting } = useAuth();
  const { accounts, activeAccountId, setAccounts, setActiveAccountId, addAccount, removeAccount, switchAccount } =
    useAccounts();
  const { aiSettings, setAiSettings } = useAISettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dialog = useDialog();

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
    if (!window.electron || !activeAccountId) return;
    if (emailToDelete?.uid) {
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
    if (window.electron && activeAccountId) {
      if (email.uid) {
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
        }
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
    if (window.electron && activeAccountId) {
      if (email.uid) {
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
        }
      }
    }
  };

  const { selectedIds, handleRowClick, handleToggleSelection, handleSelectAll, clearSelection } = useSelection({
    filteredEmails,
    onSelectEmail: handleSelectEmail,
  });

  const { isSorting, sortProgress, canSmartSort, handleBatchDelete, handleBatchSmartSort, handleBatchMarkRead } =
    useBatchOperations({
      selectedIds,
      currentEmails,
      currentCategories,
      aiSettings,
      onDeleteEmail: handleDeleteEmail,
      onToggleRead: handleToggleRead,
      onClearSelection: clearSelection,
      onUpdateEmails: (updateFn) => updateActiveAccountData((prev) => ({ ...prev, emails: updateFn(prev.emails) })),
      onUpdateCategories: (categories) => updateActiveAccountData((prev) => ({ ...prev, categories })),
      onOpenSettings: () => setIsSettingsOpen(true),
    });

  const { isSyncing, syncAccount } = useSync({
    activeAccountId,
    accounts,
    onAccountsUpdate: setAccounts,
    onDataUpdate: (accountId, { emails }) =>
      setData((prev: Record<string, AccountData>) => ({ ...prev, [accountId]: { ...prev[accountId], emails } })),
  });

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
  }, [setAccounts, setActiveAccountId, setData, setIsAuthenticated, dialog]);

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
  }, [activeAccountId, autoDiscoverFolders, setData, dialog]);

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
          updateActiveAccountData((prev) => ({
            ...prev,
            categories: prev.categories.map((c: Category) => (c.name === oldName ? { ...c, name: newName } : c)),
            emails: prev.emails.map((e) => (e.smartCategory === oldName ? { ...e, smartCategory: newName } : e)),
          }));
          await renameCategory(oldName, newName);
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
            onToggleRead={handleToggleRead}
            onToggleFlag={handleToggleFlag}
            isLoading={false}
            onLoadMore={loadMoreEmails}
            hasMore={canLoadMore}
          />
          <EmailView email={selectedEmail} />
        </div>

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

      <ConfirmDialog
        isOpen={dialog.isOpen}
        title={dialog.dialogState.title}
        message={dialog.dialogState.message}
        type={dialog.dialogState.type}
        variant={dialog.dialogState.variant}
        confirmText={dialog.dialogState.confirmText}
        cancelText={dialog.dialogState.cancelText}
        defaultValue={dialog.dialogState.defaultValue}
        placeholder={dialog.dialogState.placeholder}
        onConfirm={dialog.handleConfirm}
        onClose={dialog.handleClose}
      />
    </div>
  );
};

export default App;
