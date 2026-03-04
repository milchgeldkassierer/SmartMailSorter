import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useTranslation } from 'react-i18next';
import { Email } from '../types';
import { BrainCircuit, Trash2, Mail, MailOpen, Star, Paperclip, Folder } from './Icon';
import { formatEmailDate } from '../utils/formatEmailDate';
import { displayName } from '../utils/displayName';
import { highlightMatches } from '../utils/highlightMatches';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  selectedIds: Set<string>;
  onRowClick: (id: string, e: React.MouseEvent) => void;
  onToggleSelection: (id: string, shiftKey: boolean) => void;
  onDeleteEmail: (id: string) => void;
  onToggleRead: (id: string) => void;
  onToggleFlag: (id: string) => void;
  isLoading: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  totalCount?: number;
  onDragStart?: (emailId: string, selectedIds: Set<string>, event: React.DragEvent) => void;
  onDragEnd?: () => void;
  draggedEmailIds?: string[];
  searchQuery?: string;
}

interface EmailRowProps {
  email: Email;
  selectedEmailId: string | null;
  isSelected: boolean;
  isDragged: boolean;
  onRowClick: (id: string, e: React.MouseEvent) => void;
  onToggleSelection: (id: string, shiftKey: boolean) => void;
  onDeleteEmail: (id: string) => void;
  onToggleRead: (id: string) => void;
  onToggleFlag: (id: string) => void;
  onDragStart?: (emailId: string, e: React.DragEvent) => void;
  onDragEnd?: () => void;
  draggable: boolean;
  searchQuery?: string;
}

const EmailRow = React.memo<EmailRowProps>(
  ({
    email,
    selectedEmailId,
    isSelected,
    isDragged,
    onRowClick,
    onToggleSelection,
    onDeleteEmail,
    onToggleRead,
    onToggleFlag,
    onDragStart,
    onDragEnd,
    draggable,
    searchQuery,
  }) => {
    const { t } = useTranslation();

    return (
      <div
        role="listitem"
        draggable={draggable}
        onDragStart={onDragStart ? (e) => onDragStart(email.id, e) : undefined}
        onDragEnd={onDragEnd}
        aria-grabbed={isDragged || undefined}
        onClick={(e) => onRowClick(email.id, e)}
        className={`group relative p-4 pl-12 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
          selectedEmailId === email.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'
        } ${isSelected ? 'bg-blue-50/50' : ''} ${isDragged ? 'opacity-50' : ''}`}
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
          {/* Delete & Read: Visible only on hover */}
          <div className="hidden group-hover:flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-lg pr-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleRead(email.id);
              }}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-200 rounded-full"
              title={email.isRead ? t('emailList.markUnread') : t('emailList.markRead')}
            >
              {email.isRead ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEmail(email.id);
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
              title={t('emailList.delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Star: Visible if flagged OR on group hover — last so it stays in place */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFlag(email.id);
            }}
            className={`p-1.5 rounded-full transition-all ${
              email.isFlagged
                ? 'text-yellow-400 opacity-100'
                : 'text-slate-400 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto hover:bg-slate-200 hover:text-yellow-400'
            }`}
            title={email.isFlagged ? t('emailList.unflag') : t('emailList.flag')}
          >
            <Star className={`w-4 h-4 ${email.isFlagged ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className={`flex items-baseline mb-1 gap-2 ${email.isFlagged ? 'pr-9' : ''}`}>
          <span className={`font-medium truncate min-w-0 ${email.isRead ? 'text-slate-600' : 'text-slate-900'}`}>
            {displayName(email.sender)}
          </span>
          <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0 ml-auto group-hover:invisible">
            {formatEmailDate(new Date(email.date).getTime()) ?? ''}
          </span>
        </div>

        <div
          className={`text-sm mb-1 truncate pr-8 flex items-center gap-2 ${email.isRead ? 'text-slate-500' : 'text-slate-800 font-medium'}`}
        >
          <span
            className="truncate"
            dangerouslySetInnerHTML={{
              __html: highlightMatches(email.subject, searchQuery),
            }}
          />
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
  }
);

EmailRow.displayName = 'EmailRow';

const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmailId,
  selectedIds,
  onRowClick,
  onToggleSelection,
  onDeleteEmail,
  onToggleRead,
  onToggleFlag,
  isLoading,
  onLoadMore,
  hasMore,
  totalCount,
  onDragStart,
  onDragEnd,
  draggedEmailIds,
  searchQuery,
}) => {
  const { t } = useTranslation();
  const dragImageRef = React.useRef<HTMLDivElement | null>(null);

  // Create persistent drag image element
  React.useEffect(() => {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;top:-1000px;left:-1000px;padding:6px 12px;background:#3b82f6;color:white;border-radius:6px;font-size:13px;font-weight:500;white-space:nowrap;pointer-events:none;z-index:9999;';
    document.body.appendChild(el);
    dragImageRef.current = el;
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  const handleDragStart = React.useCallback(
    (emailId: string, e: React.DragEvent) => {
      if (!onDragStart) return;
      const dragIds = selectedIds.has(emailId) ? selectedIds : new Set([emailId]);
      const count = dragIds.size;

      if (dragImageRef.current) {
        dragImageRef.current.textContent = t('emailList.dragCount', { count });
        e.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
      }

      e.dataTransfer.effectAllowed = 'move';
      onDragStart(emailId, dragIds, e);
    },
    [onDragStart, selectedIds, t]
  );

  const handleDragEnd = React.useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);

  const handleEndReached = React.useCallback(() => {
    if (hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, onLoadMore]);

  const displayCount = totalCount ?? emails.length;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white border-r border-slate-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div
        data-testid="empty-state"
        className="w-80 md:w-96 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col items-center justify-center p-8 text-slate-400"
      >
        <div className="text-center">
          <Folder className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">{t('emailList.noEmails')}</h3>
          <p className="text-sm text-slate-400">{t('emailList.emptyFolder')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 md:w-96 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">
          {t('emailList.emails')} ({displayCount})
        </h2>
      </div>
      <Virtuoso
        style={{ flex: 1 }}
        totalCount={emails.length}
        endReached={handleEndReached}
        overscan={200}
        itemContent={(index) => {
          const email = emails[index];
          const isSelected = selectedIds.has(email.id);
          const isDragged = draggedEmailIds?.includes(email.id) ?? false;
          return (
            <EmailRow
              email={email}
              selectedEmailId={selectedEmailId}
              isSelected={isSelected}
              isDragged={isDragged}
              onRowClick={onRowClick}
              onToggleSelection={onToggleSelection}
              onDeleteEmail={onDeleteEmail}
              onToggleRead={onToggleRead}
              onToggleFlag={onToggleFlag}
              onDragStart={onDragStart ? handleDragStart : undefined}
              onDragEnd={handleDragEnd}
              draggable={!!onDragStart}
              searchQuery={searchQuery}
            />
          );
        }}
      />
    </div>
  );
};

export default EmailList;
