import React from 'react';
import { useTranslation } from 'react-i18next';
import SearchBar, { SearchConfig } from './SearchBar';
import { RefreshCw, Search, Filter, ChevronUp, ChevronDown, Clock, Mail, FileText } from './Icon';
import { DefaultEmailCategory, SortConfig, SortField } from '../types';

interface TopBarProps {
  selectedCategory: string;
  filteredEmailsCount: number;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchConfig: SearchConfig;
  onSearchConfigChange: (config: SearchConfig) => void;
  sortConfig: SortConfig;
  onSortConfigChange: (config: SortConfig) => void;
  showUnsortedOnly: boolean;
  onToggleUnsorted: () => void;
  onSync: () => void;
  isSorting: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  selectedCategory,
  filteredEmailsCount,
  searchTerm,
  onSearchChange,
  searchConfig,
  onSearchConfigChange,
  sortConfig,
  onSortConfigChange,
  showUnsortedOnly,
  onToggleUnsorted,
  onSync,
  isSorting,
}) => {
  const { t } = useTranslation();

  const getSortFieldLabel = (field: SortField): string => {
    switch (field) {
      case 'date':
        return t('topBar.sortFields.date');
      case 'sender':
        return t('topBar.sortFields.sender');
      case 'subject':
        return t('topBar.sortFields.subject');
    }
  };

  const getSortFieldIcon = (field: SortField) => {
    switch (field) {
      case 'date':
        return Clock;
      case 'sender':
        return Mail;
      case 'subject':
        return FileText;
    }
  };

  const handleSortFieldChange = (field: SortField) => {
    onSortConfigChange({ ...sortConfig, field });
  };

  const handleSortDirectionToggle = () => {
    onSortConfigChange({
      ...sortConfig,
      direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  return (
    <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4 flex-1">
        {!searchTerm ? (
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2 min-w-[150px]">
              {selectedCategory}
              <span className="ml-2 text-sm font-normal text-slate-500">({filteredEmailsCount})</span>
            </h2>

            {/* Unsorted Filter Toggle (Only in Inbox) */}
            {selectedCategory === DefaultEmailCategory.INBOX && (
              <button
                onClick={onToggleUnsorted}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                  showUnsortedOnly
                    ? 'bg-blue-100 text-blue-700 border-blue-200 font-medium'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-3 h-3" />
                <span>{t('topBar.onlyUnsorted')}</span>
              </button>
            )}
          </div>
        ) : (
          <h2 className="text-xl font-semibold text-blue-600 flex items-center gap-2 min-w-[150px]">
            <Search className="w-5 h-5" />
            {t('topBar.searchResults')}
            <span className="ml-2 text-sm font-normal text-slate-500">({filteredEmailsCount})</span>
          </h2>
        )}

        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          config={searchConfig}
          onConfigChange={onSearchConfigChange}
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Sort Controls */}
        <div className="flex items-center gap-1.5 border border-slate-200 rounded-md overflow-hidden">
          {/* Sort Field Buttons */}
          {(['date', 'sender', 'subject'] as SortField[]).map((field) => {
            const Icon = getSortFieldIcon(field);
            const isActive = sortConfig.field === field;
            return (
              <button
                type="button"
                key={field}
                onClick={() => handleSortFieldChange(field)}
                className={`text-xs px-2.5 py-1.5 transition-colors flex items-center gap-1.5 ${
                  isActive ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
                title={t('topBar.sortBy', { field: getSortFieldLabel(field) })}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{getSortFieldLabel(field)}</span>
              </button>
            );
          })}
        </div>

        {/* Sort Direction Toggle */}
        <button
          type="button"
          onClick={handleSortDirectionToggle}
          className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
          title={sortConfig.direction === 'asc' ? t('topBar.sortDirection.ascending') : t('topBar.sortDirection.descending')}
        >
          {sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <button
          onClick={onSync}
          disabled={isSorting}
          className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
          title={t('topBar.fetchEmails')}
        >
          <RefreshCw className={`w-3 h-3 ${isSorting ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
