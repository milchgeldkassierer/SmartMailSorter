import React from 'react';
import { Email } from '../types';
import { BrainCircuit, Trash2, Mail, MailOpen, Star, Paperclip } from './Icon';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  selectedIds: Set<string>;
  onSelectEmail: (id: string) => void;
  onRowClick: (id: string, e: React.MouseEvent) => void;
  onToggleSelection: (id: string, shiftKey: boolean) => void;
  onDeleteEmail: (id: string) => void;
  onToggleRead: (id: string) => void;
  onToggleFlag: (id: string) => void;
  isLoading: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmailId,
  selectedIds,
  onSelectEmail,
  onRowClick,
  onToggleSelection,
  onDeleteEmail,
  onToggleRead,
  onToggleFlag,
  isLoading,
  onLoadMore,
  hasMore,
}) => {
  const [visibleCount, setVisibleCount] = React.useState(50);

  // Reset visible count when list changes (e.g. folder change)
  React.useEffect(() => {
    setVisibleCount(50);
  }, [emails]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white border-r border-slate-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="w-80 md:w-96 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col items-center justify-center p-8 text-slate-400">
        <p>Keine Emails in diesem Ordner.</p>
      </div>
    );
  }

  return (
    <div className="w-80 md:w-96 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Emails ({emails.length})</h2>
      </div>
      <div
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          const target = e.currentTarget;
          if (target.scrollHeight - target.scrollTop <= target.clientHeight + 200) {
            // Near bottom
            if (visibleCount < emails.length) {
              setVisibleCount((prev) => Math.min(emails.length, prev + 50));
            }
          }
        }}
      >
        {emails.slice(0, visibleCount).map((email) => {
          const isSelected = selectedIds.has(email.id);
          return (
            <div
              key={email.id}
              onClick={(e) => {
                console.log('EmailList: Clicked row', email.id);
                onRowClick(email.id, e);
              }}
              className={`group relative p-4 pl-12 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedEmailId === email.id
                  ? 'bg-blue-50 border-l-4 border-l-blue-600'
                  : 'border-l-4 border-l-transparent'
              } ${isSelected ? 'bg-blue-50/50' : ''}`}
            >
              {/* Selection Checkbox (Absolute Left) */}
              <div
                className="absolute left-4 top-5 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelection(email.id, e.shiftKey);
                }}
              >
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-300 text-transparent group-hover:border-slate-400'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Action Bar - Visible on Hover or if Flagged */}
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {/* Star: Visible if flagged OR on group hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(email.id);
                  }}
                  className={`p-1.5 rounded-full transition-all ${
                    email.isFlagged
                      ? 'text-yellow-400 opacity-100'
                      : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 hover:text-yellow-400'
                  }`}
                  title={email.isFlagged ? 'Markierung entfernen' : 'Markieren'}
                >
                  <Star className={`w-4 h-4 ${email.isFlagged ? 'fill-current' : ''}`} />
                </button>

                {/* Delete & Read: Visible only on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg pl-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleRead(email.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-200 rounded-full"
                    title={email.isRead ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
                  >
                    {email.isRead ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteEmail(email.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-start mb-1 pr-6">
                <span
                  className={`font-medium truncate max-w-[65%] ${email.isRead ? 'text-slate-600' : 'text-slate-900'}`}
                >
                  {email.sender}
                </span>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {new Date(email.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div
                className={`text-sm mb-1 truncate pr-8 flex items-center gap-2 ${email.isRead ? 'text-slate-500' : 'text-slate-800 font-medium'}`}
              >
                <span className="truncate">{email.subject}</span>
                {email.hasAttachments && <Paperclip className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
              </div>

              <div className="text-xs text-slate-400 line-clamp-2">{email.body}</div>

              {email.aiSummary && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded w-fit">
                  <BrainCircuit className="w-3 h-3" />
                  <span className="truncate max-w-[200px]">{email.aiSummary}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Load More Button */}
        {hasMore && onLoadMore && (
          <div className="p-4 flex justify-center pb-8">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLoadMore();
              }}
              className="px-6 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-full text-sm font-medium transition-colors border border-slate-200 shadow-sm hover:shadow-md w-full"
            >
              Mehr laden...
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailList;
