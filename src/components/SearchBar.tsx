import React, { useState, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, X } from './Icon';

export interface SearchConfig {
  searchSender: boolean;
  searchSubject: boolean;
  searchBody: boolean;
  logic: 'AND' | 'OR';
}

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  config: SearchConfig;
  onConfigChange: (config: SearchConfig) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchTerm, onSearchChange, config, onConfigChange }) => {
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pl-10 pr-20 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 sm:text-sm transition-all shadow-sm"
          placeholder="Suchen..."
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
            title="Suchfilter"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Advanced Filter Popover */}
      {showFilters && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Suchfelder</h3>

          <div className="space-y-2 mb-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
              <input
                type="checkbox"
                checked={config.searchSender}
                onChange={() => handleToggle('searchSender')}
                className="rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              Absender
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
              <input
                type="checkbox"
                checked={config.searchSubject}
                onChange={() => handleToggle('searchSubject')}
                className="rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              Betreff
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
              <input
                type="checkbox"
                checked={config.searchBody}
                onChange={() => handleToggle('searchBody')}
                className="rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              Inhalt (Body)
            </label>
          </div>

          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 pt-3 border-t border-slate-100">
            Logik
          </h3>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => onConfigChange({ ...config, logic: 'AND' })}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                config.logic === 'AND' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              UND (Alle)
            </button>
            <button
              onClick={() => onConfigChange({ ...config, logic: 'OR' })}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                config.logic === 'OR' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ODER
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
