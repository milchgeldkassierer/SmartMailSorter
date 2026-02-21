import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal, X, Sparkles } from './Icon';
import { SearchConfig } from '../types';

// Re-export for backward compatibility
export type { SearchConfig };

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  config: SearchConfig;
  onConfigChange: (config: SearchConfig) => void;
}

interface OperatorSuggestion {
  operator: string;
  description: string;
  example: string;
}

interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

const MAX_HISTORY_ITEMS = 10;

const OPERATOR_SUGGESTIONS: OperatorSuggestion[] = [
  { operator: 'from:', description: 'searchBar.operators.from', example: 'from:amazon' },
  { operator: 'subject:', description: 'searchBar.operators.subject', example: 'subject:invoice' },
  { operator: 'category:', description: 'searchBar.operators.category', example: 'category:Rechnungen' },
  { operator: 'has:attachment', description: 'searchBar.operators.hasAttachment', example: 'has:attachment' },
  { operator: 'before:', description: 'searchBar.operators.before', example: 'before:2026-01-01' },
  { operator: 'after:', description: 'searchBar.operators.after', example: 'after:2026-01-01' },
];

const SearchBar: React.FC<SearchBarProps> = ({ searchTerm, onSearchChange, config, onConfigChange }) => {
  const { t } = useTranslation();
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<OperatorSuggestion[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [isAiConverting, setIsAiConverting] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load search history from IPC (SQLite-backed) on mount
  useEffect(() => {
    if (window.electron?.getSearchHistory) {
      window.electron
        .getSearchHistory()
        .then((history) => {
          setSearchHistory(
            history.map((h) => ({ query: h.query, timestamp: h.timestamp })).slice(0, MAX_HISTORY_ITEMS)
          );
        })
        .catch(() => {
          // Fallback: ignore IPC errors
        });
    }
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update operator suggestions based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      // Don't show history here - it's controlled by onFocus
      return;
    }

    // Hide history when typing
    setShowHistory(false);

    // Get the current word being typed (last word before cursor or after last space)
    const cursorPos = inputRef.current?.selectionStart || searchTerm.length;
    const beforeCursor = searchTerm.substring(0, cursorPos);
    const lastSpaceIndex = beforeCursor.lastIndexOf(' ');
    const currentWord = beforeCursor.substring(lastSpaceIndex + 1).toLowerCase();

    // Only show suggestions if typing a word that could be an operator
    if (currentWord.length > 0 && !currentWord.includes(':')) {
      const filtered = OPERATOR_SUGGESTIONS.filter(
        (suggestion) =>
          suggestion.operator.toLowerCase().startsWith(currentWord) ||
          t(suggestion.description).toLowerCase().includes(currentWord)
      );

      if (filtered.length > 0) {
        setFilteredSuggestions(filtered);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else if (currentWord === '' && lastSpaceIndex >= 0) {
      // Show all suggestions after a space
      setFilteredSuggestions(OPERATOR_SUGGESTIONS);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [searchTerm, t]);

  const addToSearchHistory = (query: string) => {
    if (!query.trim()) return;

    // Update local state optimistically
    const newHistory = [
      { query, timestamp: Date.now() },
      ...searchHistory.filter((item) => item.query !== query),
    ].slice(0, MAX_HISTORY_ITEMS);

    setSearchHistory(newHistory);

    // The backend IPC handler auto-records history via search-emails,
    // so no separate save call is needed here.
  };

  const handleSearchChange = (term: string) => {
    onSearchChange(term);
    // Add to history when search is executed (Enter key or manual trigger)
    // We'll add to history on blur or when suggestions are selected
  };

  const handleHistoryClick = (query: string) => {
    onSearchChange(query);
    setShowHistory(false);
    addToSearchHistory(query);
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    // Show history only if search is empty and we have history
    if (!searchTerm && searchHistory.length > 0) {
      setShowHistory(true);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm) {
      addToSearchHistory(searchTerm);
    }
  };

  const handleAiConvert = async () => {
    if (!searchTerm.trim() || !window.electron || isAiConverting) return;
    setIsAiConverting(true);
    try {
      const result = await window.electron.parseNaturalLanguageQuery(searchTerm);
      if (result && result !== searchTerm) {
        onSearchChange(result);
        addToSearchHistory(result);
      }
    } catch (error) {
      console.error('AI conversion failed:', error);
    } finally {
      setIsAiConverting(false);
    }
  };

  const handleSuggestionClick = (operator: string) => {
    const cursorPos = inputRef.current?.selectionStart || searchTerm.length;
    const beforeCursor = searchTerm.substring(0, cursorPos);
    const afterCursor = searchTerm.substring(cursorPos);
    const lastSpaceIndex = beforeCursor.lastIndexOf(' ');

    // Replace the current word with the operator
    const prefix = lastSpaceIndex >= 0 ? beforeCursor.substring(0, lastSpaceIndex + 1) : '';
    const newSearchTerm = prefix + operator + afterCursor;

    onSearchChange(newSearchTerm);
    setShowSuggestions(false);

    // Focus back on input and position cursor after the inserted operator
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = prefix.length + operator.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleToggle = (key: keyof SearchConfig) => {
    if (key === 'logic') {
      onConfigChange({ ...config, logic: config.logic === 'AND' ? 'OR' : 'AND' });
    } else {
      // Prevent disabling all fields
      const activeFields = [config.searchSender, config.searchSubject, config.searchBody].filter(Boolean).length;
      if (activeFields === 1 && config[key]) return;

      onConfigChange({ ...config, [key]: !config[key] });
    }
  };

  return (
    <div className="relative flex-1 max-w-xl mx-4" ref={filterRef}>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          className="block w-full pl-10 pr-20 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 sm:text-sm transition-all shadow-sm"
          placeholder={t('searchBar.placeholder')}
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {searchTerm && (
            <>
              <button
                onClick={handleAiConvert}
                disabled={isAiConverting}
                className={`p-1 rounded-full transition-colors ${
                  isAiConverting
                    ? 'text-blue-400 animate-pulse'
                    : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'
                }`}
                title={t('searchBar.aiConvert', 'AI: Convert to search operators')}
                aria-label={t('searchBar.aiConvert', 'AI: Convert to search operators')}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onSearchChange('')}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
                aria-label={t('searchBar.clearSearch', 'Clear search')}
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded-md transition-colors ${
              showFilters ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
            }`}
            title={t('searchBar.filters')}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search History Dropdown */}
      {showHistory && searchHistory.length > 0 && (
        <div
          ref={historyRef}
          className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2"
        >
          <div className="p-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
              {t('searchBar.recentSearches')}
            </div>
            <div className="space-y-1">
              {searchHistory.map((item, index) => (
                <button
                  key={`${item.timestamp}-${index}`}
                  onClick={() => handleHistoryClick(item.query)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700 group-hover:text-slate-900 truncate">{item.query}</span>
                    <span className="text-xs text-slate-400 group-hover:text-slate-500 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Operator Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2"
        >
          <div className="p-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
              {t('searchBar.searchOperators')}
            </div>
            <div className="space-y-1">
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion.operator}
                  onClick={() => handleSuggestionClick(suggestion.operator)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-semibold text-blue-600 group-hover:text-blue-700">
                      {suggestion.operator}
                    </code>
                    <span className="text-xs text-slate-400 group-hover:text-slate-500">{suggestion.example}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{t(suggestion.description)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filter Popover */}
      {showFilters && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            {t('searchBar.searchFields')}
          </h3>

          <div className="space-y-2 mb-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
              <input
                type="checkbox"
                checked={config.searchSender}
                onChange={() => handleToggle('searchSender')}
                className="rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              {t('searchBar.sender')}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
              <input
                type="checkbox"
                checked={config.searchSubject}
                onChange={() => handleToggle('searchSubject')}
                className="rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              {t('searchBar.subject')}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
              <input
                type="checkbox"
                checked={config.searchBody}
                onChange={() => handleToggle('searchBody')}
                className="rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              {t('searchBar.body')}
            </label>
          </div>

          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pt-3 border-t border-slate-100">
            {t('searchBar.logic')}
          </h3>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => onConfigChange({ ...config, logic: 'AND' })}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                config.logic === 'AND' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('searchBar.and')}
            </button>
            <button
              onClick={() => onConfigChange({ ...config, logic: 'OR' })}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                config.logic === 'OR' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('searchBar.or')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
