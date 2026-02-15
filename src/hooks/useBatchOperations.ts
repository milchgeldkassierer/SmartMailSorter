import { useState } from 'react';
import { Email, AISettings, DefaultEmailCategory, SortResult, Category } from '../types';
import { categorizeBatchWithAI } from '../services/geminiService';

interface DialogConfig {
  title: string;
  message: string;
  variant?: 'info' | 'warning' | 'danger' | 'success';
  confirmText?: string;
  cancelText?: string;
}

interface UseBatchOperationsProps {
  selectedIds: Set<string>;
  currentEmails: Email[];
  currentCategories: Category[];
  aiSettings: AISettings;
  onDeleteEmail: (id: string) => Promise<void>;
  onToggleRead: (id: string) => Promise<void>;
  onClearSelection: () => void;
  onUpdateEmails: (updateFn: (emails: Email[]) => Email[]) => void;
  onUpdateCategories: (categories: Category[]) => void;
  onOpenSettings: () => void;
  dialog: {
    confirm: (config: Omit<DialogConfig, 'type'>) => Promise<boolean>;
    alert: (config: Omit<DialogConfig, 'type'>) => Promise<void>;
  };
  onConfirmDelete?: (count: number) => Promise<boolean>;
  onConfirmNewCategories?: (categories: string[]) => Promise<boolean>;
}

interface UseBatchOperationsReturn {
  isSorting: boolean;
  sortProgress: number;
  canSmartSort: boolean;
  handleBatchDelete: () => Promise<void>;
  handleBatchSmartSort: () => Promise<void>;
  handleBatchMarkRead: () => Promise<void>;
}

export const useBatchOperations = ({
  selectedIds,
  currentEmails,
  currentCategories,
  aiSettings,
  onDeleteEmail,
  onToggleRead,
  onClearSelection,
  onUpdateEmails,
  onUpdateCategories,
  onOpenSettings,
  dialog,
  onConfirmDelete,
  onConfirmNewCategories,
}: UseBatchOperationsProps): UseBatchOperationsReturn => {
  const [isSorting, setIsSorting] = useState(false);
  const [sortProgress, setSortProgress] = useState(0);

  // Helper: Enrich emails with missing content
  const enrichEmailsWithContent = async (emails: Email[]): Promise<Email[]> => {
    return Promise.all(
      emails.map(async (e) => {
        if ((e.body === undefined || e.body === '') && window.electron) {
          const content = await window.electron.getEmailContent(e.id);
          if (content) {
            return { ...e, body: content.body || '', bodyHtml: content.bodyHtml ?? undefined };
          }
        }
        return e;
      })
    );
  };

  // Helper: Process emails in chunks with AI categorization
  const processEmailsInChunks = async (
    emailsToSort: Email[],
    onProgress: (progress: number) => void
  ): Promise<{ emailResults: Map<string, SortResult>; newCategories: Set<string> }> => {
    const newCategoriesFound = new Set<string>();
    const emailResults = new Map<string, SortResult>();
    let processed = 0;
    const chunkSize = 5;

    for (let i = 0; i < emailsToSort.length; i += chunkSize) {
      const chunk = emailsToSort.slice(i, i + chunkSize);
      const enrichedChunk = await enrichEmailsWithContent(chunk);

      const categoryNames = currentCategories.map((c) => c.name);
      const batchResults = await categorizeBatchWithAI(enrichedChunk, categoryNames, aiSettings);

      enrichedChunk.forEach((email, index) => {
        const sortResult = batchResults[index];
        if (sortResult.confidence > 0) {
          emailResults.set(email.id, sortResult);
          const cat = sortResult.categoryId;
          const exists = currentCategories.some((c) => c.name === cat);
          const categoryValues = Object.values(DefaultEmailCategory) as string[];
          if (!exists && !categoryValues.includes(cat)) {
            newCategoriesFound.add(cat);
          }
        }
      });

      processed += chunk.length;
      onProgress(5 + (processed / emailsToSort.length) * 85);
    }

    return { emailResults, newCategories: newCategoriesFound };
  };

  // Helper: Apply categorization updates to backend and state
  const applyCategorizationUpdates = async (
    emailResults: Map<string, SortResult>,
    newCategoriesFound: Set<string>,
    allowedNewCategories: Set<string>
  ): Promise<{ emailId: string; category: string; summary: string; reasoning: string; confidence: number }[]> => {
    const updates: { emailId: string; category: string; summary: string; reasoning: string; confidence: number }[] = [];

    for (const [emailId, result] of emailResults.entries()) {
      let finalCategory = result.categoryId;

      if (newCategoriesFound.has(finalCategory) && !allowedNewCategories.has(finalCategory)) {
        finalCategory = DefaultEmailCategory.OTHER;
      }

      updates.push({
        emailId,
        category: finalCategory,
        summary: result.summary,
        reasoning: result.reasoning,
        confidence: result.confidence,
      });

      if (window.electron) {
        await window.electron.updateEmailSmartCategory({
          emailId,
          category: finalCategory,
          summary: result.summary,
          reasoning: result.reasoning,
          confidence: result.confidence,
        });
      }
    }

    return updates;
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    // Use callback if provided, otherwise use dialog
    const confirmed = onConfirmDelete
      ? await onConfirmDelete(selectedIds.size)
      : await dialog.confirm({
          title: 'Emails löschen',
          message: `${selectedIds.size} Emails wirklich löschen?`,
          variant: 'danger',
          confirmText: 'Löschen',
          cancelText: 'Abbrechen',
        });

    if (!confirmed) return;

    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => onDeleteEmail(id)));
      onClearSelection();
    } catch (error) {
      console.error('Failed to delete emails:', error);
      await dialog.alert({
        title: 'Fehler',
        message: 'Einige Emails konnten nicht gelöscht werden',
        variant: 'danger',
      });
    }
  };

  const handleBatchMarkRead = async () => {
    if (selectedIds.size === 0) return;

    // Determine target read state: if any selected email is unread, mark all as read; else mark all as unread
    const selectedEmails = currentEmails.filter((e) => selectedIds.has(e.id));
    const hasUnread = selectedEmails.some((e) => !e.isRead);
    const targetReadState = hasUnread;

    const ids = Array.from(selectedIds);
    try {
      // Toggle read status for each email
      // Only toggle if the email's current state doesn't match target state
      await Promise.all(
        ids.map(async (id) => {
          const email = currentEmails.find((e) => e.id === id);
          if (email && email.isRead !== targetReadState) {
            await onToggleRead(id);
          }
        })
      );
      onClearSelection();
    } catch (error) {
      console.error('Failed to update read status:', error);
      await dialog.alert({
        title: 'Fehler',
        message: 'Einige Emails konnten nicht aktualisiert werden',
        variant: 'danger',
      });
    }
  };

  const handleBatchSmartSort = async () => {
    if (selectedIds.size === 0) return;
    if (!aiSettings.apiKey) {
      await dialog.alert({
        title: 'AI Settings erforderlich',
        message: 'Bitte AI Settings (API Key) konfigurieren!',
        variant: 'warning',
      });
      onOpenSettings();
      return;
    }

    setIsSorting(true);
    setSortProgress(5);

    try {
      const emailsToSort = currentEmails.filter((e) => selectedIds.has(e.id));

      // Process emails in chunks with AI
      const { emailResults, newCategories } = await processEmailsInChunks(emailsToSort, setSortProgress);

      // Confirm new categories with user
      let allowedNewCategories = new Set<string>();
      if (newCategories.size > 0) {
        const newArr = Array.from(newCategories);
        const confirmed = onConfirmNewCategories
          ? await onConfirmNewCategories(newArr)
          : await dialog.confirm({
              title: 'Neue Ordner vorgeschlagen',
              message: `Die KI schlägt folgende neue Ordner vor:\n\n${newArr.join(', ')}\n\nSollen diese angelegt werden?\n(Bei 'Abbrechen' werden die Mails in 'Sonstiges' verschoben)`,
              variant: 'info',
              confirmText: 'Anlegen',
              cancelText: 'Abbrechen',
            });

        if (confirmed) {
          allowedNewCategories = newCategories;
        }
      }

      // Apply updates to backend and collect update records
      const updates = await applyCategorizationUpdates(emailResults, newCategories, allowedNewCategories);

      // Update email state
      onUpdateEmails((emails) =>
        emails.map((email) => {
          const update = updates.find((u) => u.emailId === email.id);
          if (update) {
            return {
              ...email,
              smartCategory: update.category,
              aiSummary: update.summary,
              aiReasoning: update.reasoning,
              confidence: update.confidence,
            };
          }
          return email;
        })
      );

      // Add new categories
      let newCats = [...currentCategories];
      allowedNewCategories.forEach((catName) => {
        const exists = newCats.some((c) => c.name === catName);
        if (!exists) {
          newCats.push({ name: catName, type: 'custom' });
          if (window.electron) window.electron.addCategory(catName, 'custom');
        }
      });
      onUpdateCategories(newCats);

      setSortProgress(100);
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error('Smart Sort Error:', e);
      await dialog.alert({
        title: 'Fehler beim Sortieren',
        message: `Ein Fehler ist beim Sortieren aufgetreten: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`,
        variant: 'danger',
      });
    } finally {
      setIsSorting(false);
      setSortProgress(0);
      onClearSelection();
    }
  };

  const canSmartSort = Boolean(selectedIds.size > 0 && aiSettings.provider && aiSettings.apiKey);

  return {
    isSorting,
    sortProgress,
    canSmartSort,
    handleBatchDelete,
    handleBatchSmartSort,
    handleBatchMarkRead,
  };
};
