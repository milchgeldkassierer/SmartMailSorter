import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Filter, CheckCircle } from './Icon';

interface SavedFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, query: string) => void;
  initialName?: string;
  initialQuery?: string;
  mode?: 'create' | 'edit';
}

const SavedFilterDialog: React.FC<SavedFilterDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  initialQuery = '',
  mode = 'create',
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [query, setQuery] = useState(initialQuery);
  const [errors, setErrors] = useState<{ name?: string; query?: string }>({});

  // Reset form when dialog opens/closes or initial values change
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setQuery(initialQuery);
      setErrors({});
    }
  }, [isOpen, initialName, initialQuery]);

  // Handle escape key to close dialog
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validateForm = (): boolean => {
    const newErrors: { name?: string; query?: string } = {};

    if (!name.trim()) {
      newErrors.name = t('savedFilterDialog.errors.nameRequired');
    }

    if (!query.trim()) {
      newErrors.query = t('savedFilterDialog.errors.queryRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(name.trim(), query.trim());
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <Filter className="w-6 h-6 text-blue-500" />
            <h2 id="dialog-title" className="text-xl font-bold text-slate-800">
              {mode === 'edit' ? t('savedFilterDialog.editTitle') : t('savedFilterDialog.createTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            data-testid="close-button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Filter Name Input */}
          <div>
            <label htmlFor="filter-name" className="block text-sm font-medium text-slate-700 mb-2">
              {t('savedFilterDialog.nameLabel')}
            </label>
            <input
              id="filter-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) {
                  setErrors({ ...errors, name: undefined });
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('savedFilterDialog.namePlaceholder')}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-500' : 'border-slate-300'
              }`}
              autoFocus
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Filter Query Input */}
          <div>
            <label htmlFor="filter-query" className="block text-sm font-medium text-slate-700 mb-2">
              {t('savedFilterDialog.queryLabel')}
            </label>
            <input
              id="filter-query"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (errors.query) {
                  setErrors({ ...errors, query: undefined });
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('savedFilterDialog.queryPlaceholder')}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.query ? 'border-red-500' : 'border-slate-300'
              }`}
            />
            {errors.query && <p className="mt-1 text-sm text-red-600">{errors.query}</p>}
          </div>

          {/* Help Text */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs text-slate-600">{t('savedFilterDialog.helpText')}</p>
          </div>
        </div>

        {/* Footer with buttons */}
        <div className="flex items-center justify-end gap-3 p-6 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {mode === 'edit' ? t('savedFilterDialog.updateButton') : t('savedFilterDialog.saveButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavedFilterDialog;
