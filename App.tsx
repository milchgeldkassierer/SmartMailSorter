import React, { useState, useEffect } from 'react';
import { DefaultEmailCategory, ImapAccount } from './types';
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
import TopBar from './components/TopBar';
import BatchActionBar from './components/BatchActionBar';
import ProgressBar from './components/ProgressBar';

const App: React.FC = () => {
  const { isAuthenticated, isConnecting, setIsAuthenticated, setIsConnecting } = useAuth();
  const { accounts, activeAccountId, setAccounts, setActiveAccountId, addAccount, removeAccount, switchAccount } = useAccounts();
  const { aiSettings, setAiSettings } = useAISettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const {
    data, setData, selectedEmailId, setSelectedEmailId, selectedCategory, setSelectedCategory,
    searchTerm, setSearchTerm, searchConfig, setSearchConfig, showUnsortedOnly, setShowUnsortedOnly,
    currentEmails, currentCategories, filteredEmails, displayedEmails, selectedEmail,
    categoryCounts, canLoadMore, updateActiveAccountData, loadMoreEmails
  } = useEmails({ activeAccountId, accounts });

  const { addCategory, deleteCategory, renameCategory, autoDiscoverFolders } = useCategories();

  const handleSelectEmail = async (id: string) => {
    setSelectedEmailId(id);
    if (!activeAccountId || !window.electron) return;
    const email = currentEmails.find(e => e.id === id);
    if (email && email.body === undefined && email.bodyHtml === undefined) {
      const content = await window.electron.getEmailContent(id);
      updateActiveAccountData(prev => ({
        ...prev,
        emails: prev.emails.map(e => e.id === id ? { ...e, body: content?.body ?? "", bodyHtml: content?.bodyHtml ?? "" } : e)
      }));
    }
  };

  const handleDeleteEmail = async (id: string) => {
    updateActiveAccountData(prev => ({ ...prev, emails: prev.emails.filter(e => e.id !== id) }));
    if (selectedEmailId === id) setSelectedEmailId(null);
    if (!window.electron || !activeAccountId) return;
    const email = currentEmails.find(e => e.id === id);
    const account = accounts.find(a => a.id === activeAccountId);
    if (email?.uid && account) {
      await window.electron.deleteEmail({ account, emailId: id, uid: email.uid, folder: email.folder });
    }
  };

  const { selectedIds, handleRowClick, handleToggleSelection, handleSelectAll, clearSelection } = useSelection({
    filteredEmails,
    onSelectEmail: handleSelectEmail
  });

  const { isSorting, sortProgress, canSmartSort, handleBatchDelete, handleBatchSmartSort } = useBatchOperations({
    selectedIds, currentEmails, currentCategories, aiSettings, activeAccountId, accounts,
    onDeleteEmail: handleDeleteEmail,
    onClearSelection: clearSelection,
    onUpdateEmails: (updateFn) => updateActiveAccountData(prev => ({ ...prev, emails: updateFn(prev.emails) })),
    onUpdateCategories: (categories) => updateActiveAccountData(prev => ({ ...prev, categories })),
    onOpenSettings: () => setIsSettingsOpen(true)
  });

  const { isSyncing, syncAccount } = useSync({
    activeAccountId, accounts,
    onAccountsUpdate: setAccounts,
    onDataUpdate: (accountId, { emails }) => setData(prev => ({ ...prev, [accountId]: { ...prev[accountId], emails } }))
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
        alert('Fehler beim Laden der Daten');
      }
    })();
  }, []);

  // Fetch emails when switching accounts
  useEffect(() => {
    (async () => {
      if (!activeAccountId || !window.electron) return;
      const emails = await window.electron.getEmails(activeAccountId);
      await autoDiscoverFolders(emails);
      const finalCategories = await window.electron.getCategories();
      setData(prev => ({ ...prev, [activeAccountId]: { emails, categories: finalCategories } }));
    })();
  }, [activeAccountId]);

  const handleAddAccount = async (newAccount: ImapAccount) => {
    if (window.electron) {
      setIsConnecting(true);
      try {
        await window.electron.addAccount(newAccount);
        addAccount(newAccount);
        switchAccount(newAccount.id);
        const emails = await window.electron.getEmails(newAccount.id);
        setData(prev => ({ ...prev, [newAccount.id]: {
          emails,
          categories: Object.values(DefaultEmailCategory).map(c => ({ name: c, type: 'system' }))
        }}));
        setIsAuthenticated(true);
      } catch (error) {
        alert("Konto konnte nicht hinzugefügt werden. Prüfe die Daten.");
      } finally {
        setIsConnecting(false);
      }
    } else {
      addAccount(newAccount);
      const demoEmails = await generateDemoEmails(5, aiSettings);
      setData(prev => ({ ...prev, [newAccount.id]: {
        emails: demoEmails.map(e => ({ ...e, id: e.id + '-' + newAccount.id })),
        categories: Object.values(DefaultEmailCategory).map(c => ({ name: c, type: 'system' }))
      }}));
    }
  };

  const handleToggleRead = async (id: string) => {
    const email = currentEmails.find(e => e.id === id);
    if (!email) return;
    updateActiveAccountData(prev => ({ ...prev, emails: prev.emails.map(e => e.id === id ? { ...e, isRead: !e.isRead } : e) }));
    if (window.electron && activeAccountId) {
      const account = accounts.find(a => a.id === activeAccountId);
      if (email.uid && account) {
        await window.electron.updateEmailRead({ account, emailId: id, uid: email.uid, isRead: !email.isRead, folder: email.folder });
      }
    }
  };

  const handleToggleFlag = async (id: string) => {
    const email = currentEmails.find(e => e.id === id);
    if (!email) return;
    updateActiveAccountData(prev => ({ ...prev, emails: prev.emails.map(e => e.id === id ? { ...e, isFlagged: !e.isFlagged } : e) }));
    if (window.electron && activeAccountId) {
      const account = accounts.find(a => a.id === activeAccountId);
      if (email.uid && account) {
        await window.electron.updateEmailFlag({ account, emailId: id, uid: email.uid, isFlagged: !email.isFlagged, folder: email.folder });
      }
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
          if (!currentCategories.some(c => c.name === newCategory)) {
            updateActiveAccountData(prev => ({ ...prev, categories: [...prev.categories, { name: newCategory, type: 'custom' }] }));
            await addCategory(newCategory, 'custom');
          }
        }}
        categories={currentCategories}
        counts={categoryCounts}
        isProcessing={isSorting}
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
          updateActiveAccountData(prev => ({
            ...prev,
            categories: prev.categories.filter((c: any) => c.name !== cat),
            emails: prev.emails.map(e => e.smartCategory === cat ? { ...e, smartCategory: undefined } : e)
          }));
          await deleteCategory(cat);
        }}
        onRenameCategory={async (oldName, newName) => {
          updateActiveAccountData(prev => ({
            ...prev,
            categories: prev.categories.map((c: any) => c.name === oldName ? { ...c, name: newName } : c),
            emails: prev.emails.map(e => e.smartCategory === oldName ? { ...e, smartCategory: newName } : e)
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
          canSmartSort={canSmartSort}
          aiSettings={aiSettings}
        />

        {isSorting && <ProgressBar label={`AI sortiert Emails... (${aiSettings.provider})`} progress={sortProgress} />}

        <div className="flex-1 flex overflow-hidden">
          <EmailList
            emails={displayedEmails}
            selectedEmailId={selectedEmailId}
            selectedIds={selectedIds}
            onSelectEmail={handleSelectEmail}
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
            setData(prev => {
              const { [id]: _, ...rest } = prev;
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
