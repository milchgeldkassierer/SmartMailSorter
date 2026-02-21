import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal, X } from './Icon';
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

const OPERATOR_SUGGESTIONS: OperatorSuggestion[] = [
  { operator: 'from:', description: 'Filter by sender email', example: 'from:amazon' },
  { operator: 'to:', description: 'Filter by recipient email', example: 'to:me@example.com' },
  { operator: 'subject:', description: 'Search in subject line', example: 'subject:invoice' },
  { operator: 'category:', description: 'Filter by smart category', example: 'category:Rechnungen' },
  { operator: 'has:attachment', description: 'Emails with attachments', example: 'has:attachment' },
  { operator: 'before:', description: 'Emails before date', example: 'before:2026-01-01' },
  { operator: 'after:', description: 'Emails after date', example: 'after:2026-01-01' },
];

const SearchBar: React.FC<SearchBarProps> = ({ searchTerm, onSearchChange, config, onConfigChange }) => {
  const { t } = useTranslation();
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<OperatorSuggestion[]>([]);
  const filterRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
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
      return;
    }

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
          suggestion.description.toLowerCase().includes(currentWord)
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
  }, [searchTerm]);

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
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pl-10 pr-20 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 sm:text-sm transition-all shadow-sm"
          placeholder={t('searchBar.placeholder')}
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
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

      {/* Operator Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2"
        >
          <div className="p-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
              Search Operators
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
                    <span className="text-xs text-slate-400 group-hover:text-slate-500">
                      {suggestion.example}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {suggestion.description}
                  </div>
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
