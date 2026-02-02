import { useState } from 'react';
import { Email, AISettings, DefaultEmailCategory, SortResult } from '../types';
import { categorizeBatchWithAI } from '../services/geminiService';

interface UseBatchOperationsProps {
  selectedIds: Set<string>;
  currentEmails: Email[];
  currentCategories: { name: string; type: string }[];
  aiSettings: AISettings;
  onDeleteEmail: (id: string) => Promise<void>;
  onClearSelection: () => void;
  onUpdateEmails: (updateFn: (emails: Email[]) => Email[]) => void;
  onUpdateCategories: (categories: { name: string; type: string }[]) => void;
  onOpenSettings: () => void;
}

interface UseBatchOperationsReturn {
  isSorting: boolean;
  sortProgress: number;
  canSmartSort: boolean;
  handleBatchDelete: () => Promise<void>;
  handleBatchSmartSort: () => Promise<void>;
}

export const useBatchOperations = ({
  selectedIds,
  currentEmails,
  currentCategories,
  aiSettings,
  onDeleteEmail,
  onClearSelection,
  onUpdateEmails,
  onUpdateCategories,
  onOpenSettings
}: UseBatchOperationsProps): UseBatchOperationsReturn => {
  const [isSorting, setIsSorting] = useState(false);
  const [sortProgress, setSortProgress] = useState(0);

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size} Emails wirklich löschen?`)) return;

    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map(id => onDeleteEmail(id)));
      onClearSelection();
    } catch (error) {
      console.error('Failed to delete emails:', error);
      alert('Einige Emails konnten nicht gelöscht werden');
    }
  };

  const handleBatchSmartSort = async () => {
    if (selectedIds.size === 0) return;
    if (!aiSettings.apiKey) {
      alert("Bitte AI Settings (API Key) konfigurieren!");
      onOpenSettings();
      return;
    }

    setIsSorting(true);
    setSortProgress(5);

    try {
      const emailsToSort = currentEmails.filter(e => selectedIds.has(e.id));

      const newCategoriesFound = new Set<string>();
      const emailResults = new Map<string, SortResult>();

      let processed = 0;
      const chunkSize = 5;

      for (let i = 0; i < emailsToSort.length; i += chunkSize) {
        const chunk = emailsToSort.slice(i, i + chunkSize);

        const enrichedChunk = await Promise.all(chunk.map(async (e) => {
          if ((e.body === undefined || e.body === '') && window.electron) {
            const content = await window.electron.getEmailContent(e.id);
            if (content) {
              return { ...e, body: content.body || '', bodyHtml: content.bodyHtml };
            }
          }
          return e;
        }));

        const categoryNames = currentCategories.map(c => c.name);
        const batchResults = await categorizeBatchWithAI(enrichedChunk, categoryNames, aiSettings);

        const results = enrichedChunk.map((email, index) => {
          const sortResult = batchResults[index];
          return { id: email.id, sortResult };
        });

        results.forEach(r => {
          if (r.sortResult.confidence > 0) {
            emailResults.set(r.id, r.sortResult);
            const cat = r.sortResult.categoryId;
            const exists = currentCategories.some(c => c.name === cat);
            if (!exists && !Object.values(DefaultEmailCategory).includes(cat as any)) {
              newCategoriesFound.add(cat);
            }
          }
        });

        processed += chunk.length;
        setSortProgress(5 + (processed / emailsToSort.length) * 85);
      }

      let allowedNewCategories = new Set<string>();

      if (newCategoriesFound.size > 0) {
        const newArr = Array.from(newCategoriesFound);
        const confirmed = confirm(
          `Die KI schlägt folgende neue Ordner vor:\n\n${newArr.join(', ')}\n\nSollen diese angelegt werden?\n(Bei 'Abbrechen' werden die Mails in 'Sonstiges' verschoben)`
        );

        if (confirmed) {
          allowedNewCategories = newCategoriesFound;
        }
      }

      interface EmailUpdate {
        emailId: string;
        category: string;
        summary: string;
        reasoning: string;
        confidence: number;
      }
      const updates: EmailUpdate[] = [];

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
          confidence: result.confidence
        });

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

      onUpdateEmails((emails) =>
        emails.map(email => {
          const update = updates.find(u => u.emailId === email.id);
          if (update) {
            return {
              ...email,
              smartCategory: update.category,
              aiSummary: update.summary,
              aiReasoning: update.reasoning,
              confidence: update.confidence
            };
          }
          return email;
        })
      );

      let newCats = [...currentCategories];
      allowedNewCategories.forEach(catName => {
        const exists = newCats.some(c => c.name === catName);
        if (!exists) {
          newCats.push({ name: catName, type: 'custom' });
          if (window.electron) window.electron.addCategory(catName, 'custom');
        }
      });
      onUpdateCategories(newCats);

      setSortProgress(100);
      await new Promise(r => setTimeout(r, 500));

    } catch (e) {
      console.error('Smart Sort Error:', e);
      alert(`Ein Fehler ist beim Sortieren aufgetreten: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
    } finally {
      setIsSorting(false);
      setSortProgress(0);
      onClearSelection();
    }
  };

  const canSmartSort = selectedIds.size > 0 && aiSettings.provider && aiSettings.apiKey;

  return {
    isSorting,
    sortProgress,
    canSmartSort,
    handleBatchDelete,
    handleBatchSmartSort
  };
};
