import React from 'react';
import { Trash2, BrainCircuit, Mail, MailOpen, Star } from './Icon';
import { Email, AISettings } from '../types';

interface BatchActionBarProps {
  filteredEmails: Email[];
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onBatchDelete: () => void;
  onBatchMarkRead: () => void;
  onBatchFlag: () => void;
  onBatchSmartSort: () => void;
  canSmartSort: boolean;
  aiSettings: AISettings;
}

const BatchActionBar: React.FC<BatchActionBarProps> = ({
  filteredEmails,
  selectedIds,
  onSelectAll,
  onBatchDelete,
  onBatchMarkRead,
  onBatchFlag,
  onBatchSmartSort,
  canSmartSort,
  aiSettings,
}) => {
  const allSelected = filteredEmails.length > 0 && selectedIds.size === filteredEmails.length;

  // Determine if any selected email is unread
  const selectedEmails = filteredEmails.filter((e) => selectedIds.has(e.id));
  const hasUnread = selectedEmails.some((e) => !e.isRead);
  const markAsReadLabel = hasUnread ? 'Als gelesen' : 'Als ungelesen';
  const MarkAsReadIcon = hasUnread ? MailOpen : Mail;

  // Determine if any selected email is unflagged
  const hasUnflagged = selectedEmails.some((e) => !e.isFlagged);
  const flagLabel = hasUnflagged ? 'Markieren' : 'Entmarkieren';

  return (
    <div className="h-10 border-b border-slate-200 bg-slate-50 flex items-center px-6 gap-4">
      <div className="flex items-center gap-3 pl-2">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          checked={allSelected}
          onChange={onSelectAll}
        />

        {selectedIds.size > 0 && (
          <span className="text-sm font-medium text-slate-700 fade-in">{selectedIds.size} ausgewählt</span>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 ml-4 animate-in fade-in slide-in-from-left-2 duration-200">
          <button
            onClick={onBatchDelete}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-slate-700 text-sm rounded hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Löschen</span>
          </button>

          {/* Mark as Read/Unread Button */}
          <button
            onClick={onBatchMarkRead}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-slate-700 text-sm rounded hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
          >
            <MarkAsReadIcon className="w-4 h-4" />
            <span>{markAsReadLabel}</span>
          </button>

          {/* Flag/Unflag Button */}
          <button
            onClick={onBatchFlag}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-slate-700 text-sm rounded hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-colors"
          >
            <Star className="w-4 h-4" />
            <span>{flagLabel}</span>
          </button>

          {/* Smart Sort Button */}
          <button
            onClick={onBatchSmartSort}
            disabled={!canSmartSort}
            className={`flex items-center gap-1.5 px-3 py-1 border text-sm rounded transition-colors ${
              canSmartSort
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent hover:shadow-md hover:from-blue-700 hover:to-indigo-700'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
            title={
              !aiSettings.apiKey ? 'Bitte API Key in Einstellungen hinterlegen' : 'Ausgewählte Mails mit AI sortieren'
            }
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Smart Sortieren</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default BatchActionBar;
