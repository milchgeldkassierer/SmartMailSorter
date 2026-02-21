import React, { useState, useEffect, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertCircle, AlertOctagon, CheckCircle } from './Icon';

export type DialogType = 'confirm' | 'alert' | 'prompt';
export type DialogVariant = 'info' | 'warning' | 'danger';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (value?: string) => void;
  type?: DialogType;
  variant?: DialogVariant;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
  placeholder?: string;
  // Auto-focus input for prompt dialogs. Defaults to true for better UX.
  // While autoFocus can disrupt screen reader navigation, for modal prompt
  // dialogs it's standard UX practice. Can be disabled if strict a11y is required.
  autoFocusInput?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type = 'confirm',
  variant = 'info',
  title,
  message,
  confirmText,
  cancelText,
  defaultValue = '',
  placeholder = '',
  autoFocusInput = true,
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(defaultValue);

  // Reset input value when dialog opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  // Handle escape key to close dialog
  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      if (type === 'prompt') {
        onConfirm(inputValue);
      } else {
        onConfirm();
      }
    }
    // Always call onClose after confirmation to ensure consistent behavior
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && type === 'prompt') {
      e.preventDefault();
      handleConfirm();
    }
  };

  // Get variant-specific styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertOctagon className="w-6 h-6 text-red-500" />,
          confirmButtonClass: 'bg-red-600 hover:bg-red-700 text-white',
          borderClass: 'border-red-100',
        };
      case 'warning':
        return {
          icon: <AlertCircle className="w-6 h-6 text-amber-500" />,
          confirmButtonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
          borderClass: 'border-amber-100',
        };
      case 'info':
      default:
        return {
          icon: <CheckCircle className="w-6 h-6 text-blue-500" />,
          confirmButtonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
          borderClass: 'border-blue-100',
        };
    }
  };

  const variantStyles = getVariantStyles();
  const defaultConfirmText =
    confirmText ||
    (type === 'alert' ? t('common.ok') : variant === 'danger' ? t('common.delete') : t('confirmDialog.confirm'));

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
        <div className={`flex items-center justify-between p-6 border-b ${variantStyles.borderClass}`}>
          <div className="flex items-center gap-3">
            {variantStyles.icon}
            <h2 id="dialog-title" className="text-xl font-bold text-slate-800">
              {title}
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
        <div className="p-6">
          <p className="text-slate-600 mb-4 whitespace-pre-wrap">{message}</p>

          {/* Input field for prompt type */}
          {type === 'prompt' && (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus={autoFocusInput}
            />
          )}
        </div>

        {/* Footer with buttons */}
        <div className="flex items-center justify-end gap-3 p-6 bg-slate-50 border-t border-slate-100">
          {type !== 'alert' && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition-colors"
            >
              {cancelText || t('common.cancel')}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${variantStyles.confirmButtonClass}`}
          >
            {defaultConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
