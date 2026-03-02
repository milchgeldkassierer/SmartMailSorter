import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download, ArrowRight, History, Trash, Search } from './Icon';
import { CategorizationFeedback } from '../types';
import { CategoryIcon } from './Icon';
import { formatDateTime } from '../utils/formatLocale';

interface FeedbackHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

const FeedbackHistoryModal: React.FC<FeedbackHistoryModalProps> = ({ isOpen, onClose, accountId }) => {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<CategorizationFeedback[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<CategorizationFeedback[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!window?.electron?.getCategorizationFeedback) {
        if (mountedRef.current) {
          setFeedback([]);
          setFilteredFeedback([]);
        }
        return;
      }
      const data = await window.electron.getCategorizationFeedback(accountId, 100);
      if (mountedRef.current) {
        setFeedback(data);
        setFilteredFeedback(data);
      }
    } catch (error) {
      console.error('Failed to load feedback history:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [accountId]);

  // Load feedback data when modal opens
  useEffect(() => {
    if (isOpen && accountId) {
      loadFeedback();
    }
  }, [isOpen, accountId, loadFeedback]);

  // Filter feedback based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFeedback(feedback);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = feedback.filter(
        (item) =>
          (item.subject ?? '').toLowerCase().includes(query) ||
          (item.sender ?? '').toLowerCase().includes(query) ||
          (item.senderEmail ?? '').toLowerCase().includes(query) ||
          (item.originalCategory ?? '').toLowerCase().includes(query) ||
          (item.correctedCategory ?? '').toLowerCase().includes(query)
      );
      setFilteredFeedback(filtered);
    }
  }, [searchQuery, feedback]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showClearConfirm) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, showClearConfirm]);

  const handleExport = async () => {
    try {
      if (!accountId || !window?.electron?.exportCategorizationFeedback) return;
      const data = await window.electron.exportCategorizationFeedback(accountId);

      // Create export object with metadata
      const exportData = {
        exportDate: new Date().toISOString(),
        accountId: accountId,
        feedbackCount: data.length,
        feedback: data,
      };

      // Create blob and download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `ai-feedback-${accountId}-${new Date().toISOString().split('T')[0]}.json`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export feedback:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      if (!accountId || !window?.electron?.clearCategorizationFeedback) return;
      await window.electron.clearCategorizationFeedback(accountId);
      if (mountedRef.current) {
        setFeedback([]);
        setFilteredFeedback([]);
        setShowClearConfirm(false);
      }
    } catch (error) {
      console.error('Failed to clear feedback:', error);
    }
  };

  const formatDateValue = (timestamp: number) => {
    return formatDateTime(timestamp) ?? new Date(timestamp).toLocaleString();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !showClearConfirm) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-history-title"
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-blue-500" />
            <h2 id="feedback-history-title" className="text-xl font-bold text-slate-800">
              {t('feedbackHistory.title')}
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

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('feedbackHistory.searchPlaceholder')}
              aria-label={t('feedbackHistory.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500">{t('feedbackHistory.loading')}</div>
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <History className="w-12 h-12 mb-3 text-slate-300" />
              <p className="text-lg font-medium">
                {searchQuery ? t('feedbackHistory.noResults') : t('feedbackHistory.noFeedback')}
              </p>
              {!searchQuery && <p className="text-sm mt-2">{t('feedbackHistory.noFeedbackHint')}</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      {t('feedbackHistory.columns.date')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      {t('feedbackHistory.columns.subject')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      {t('feedbackHistory.columns.sender')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      {t('feedbackHistory.columns.correction')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      {t('feedbackHistory.columns.confidence')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeedback.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                        {formatDateValue(item.correctedAt)}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-800">
                        <div className="max-w-xs truncate" title={item.subject}>
                          {item.subject}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        <div className="max-w-xs">
                          <div className="font-medium truncate" title={item.sender}>
                            {item.sender}
                          </div>
                          <div className="text-xs text-slate-500 truncate" title={item.senderEmail}>
                            {item.senderEmail}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded text-xs">
                            <CategoryIcon category={item.originalCategory} className="w-3 h-3" />
                            <span className="text-slate-700">{item.originalCategory}</span>
                          </div>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <div className="flex items-center gap-1.5 bg-blue-100 px-2 py-1 rounded text-xs">
                            <CategoryIcon category={item.correctedCategory} className="w-3 h-3" />
                            <span className="text-blue-700 font-medium">{item.correctedCategory}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {item.confidence !== null
                          ? `${Math.min(100, Math.max(0, Math.round(item.confidence * 100)))}%`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-100 bg-slate-50">
          <div className="text-sm text-slate-600">{t('feedbackHistory.totalCount', { count: feedback.length })}</div>
          <div className="flex items-center gap-3">
            {feedback.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {t('feedbackHistory.export')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash className="w-4 h-4" />
                  {t('feedbackHistory.clearAll')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/30">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-confirm-title"
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md"
          >
            <h3 id="clear-confirm-title" className="text-lg font-bold text-slate-800 mb-3">
              {t('feedbackHistory.clearConfirm.title')}
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              {t('feedbackHistory.clearConfirm.message', { count: feedback.length })}
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                {t('feedbackHistory.clearConfirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackHistoryModal;
