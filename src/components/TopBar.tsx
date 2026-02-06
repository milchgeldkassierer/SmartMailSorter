import React from 'react';
import SearchBar, { SearchConfig } from './SearchBar';
import { RefreshCw, Search, Filter } from './Icon';
import { DefaultEmailCategory } from '../types';

interface TopBarProps {
  selectedCategory: string;
  filteredEmailsCount: number;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchConfig: SearchConfig;
  onSearchConfigChange: (config: SearchConfig) => void;
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
  showUnsortedOnly,
  onToggleUnsorted,
  onSync,
  isSorting,
}) => {
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
                <span>Nur unsortierte</span>
              </button>
            )}
          </div>
        ) : (
          <h2 className="text-xl font-semibold text-blue-600 flex items-center gap-2 min-w-[150px]">
            <Search className="w-5 h-5" />
            Suchergebnisse
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
        <button
          onClick={onSync}
          disabled={isSorting}
          className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
          title="Emails abrufen"
        >
          <RefreshCw className={`w-3 h-3 ${isSorting ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
