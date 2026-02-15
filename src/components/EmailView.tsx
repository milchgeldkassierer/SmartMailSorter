import React, { useState, useEffect } from 'react';
import { Email, Attachment } from '../types';
import { CategoryIcon, BrainCircuit, Paperclip } from './Icon';
import { sanitizeHtml } from '../utils/sanitizeHtml';

interface EmailViewProps {
  email: Email | null;
}

const EmailView: React.FC<EmailViewProps> = ({ email }) => {
  const [showHtml, setShowHtml] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [_isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (email && email.hasAttachments && window.electron) {
      setIsLoadingAttachments(true);
      window.electron
        .getEmailAttachments(email.id)
        .then((atts: Attachment[]) => setAttachments(atts))
        .catch((err: unknown) => console.error(err))
        .finally(() => setIsLoadingAttachments(false));
    } else {
      setAttachments([]);
    }
    // Reset view to HTML preference on email switch
    setShowHtml(true);
  }, [email]);

  // Auto-hide error notification after 5 seconds with proper cleanup
  useEffect(() => {
    if (linkError) {
      const timeoutId = setTimeout(() => setLinkError(null), 5000);
      return () => clearTimeout(timeoutId);
    }
  }, [linkError]);

  if (!email) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <CategoryIcon category={'INBOX'} className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>Wähle eine Email aus, um Details zu sehen.</p>
        </div>
      </div>
    );
  }

  // If lazy loading content (check if body is undefined)
  if (email.body === undefined && email.bodyHtml === undefined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <p>Lade Inhalt...</p>
      </div>
    );
  }

  // Toggle availability
  const hasHtml = !!email.bodyHtml;

  // Handle clicks on links in email HTML content to open in external browser
  const handleLinkClick = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href && window.electron?.openExternal) {
      e.preventDefault();
      setLinkError(null);

      const result = await window.electron.openExternal(anchor.href);
      if (!result.success) {
        // Show user-friendly error message
        setLinkError(result.message || 'Failed to open link');
      }
    }
  };

  // Handle clicks on attachment items to open in system default application
  const handleAttachmentClick = async (attachmentId: string) => {
    if (window.electron?.openAttachment) {
      setLinkError(null);

      const result = await window.electron.openAttachment(attachmentId);
      if (!result.success) {
        // Show user-friendly error message
        setLinkError(result.message || 'Failed to open attachment');
      }
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      {/* Link Error Notification */}
      {linkError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 flex-shrink-0">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{linkError}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setLinkError(null)}
                className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white p-6 border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{email.subject}</h1>
          {email.confidence && (
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Confidence</span>
              <div className="flex items-center gap-1 text-blue-600 font-bold">
                <span>{Math.round(email.confidence * 100)}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
              {email.sender.charAt(0)}
            </div>
            <div>
              <div className="font-medium text-slate-900">
                {email.sender} <span className="text-slate-500 font-normal text-sm">&lt;{email.senderEmail}&gt;</span>
              </div>
              <div className="text-xs text-slate-500">{new Date(email.date).toLocaleString()}</div>
            </div>
          </div>

          {email.category && (
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <CategoryIcon category={email.category} className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">{email.category}</span>
            </div>
          )}
        </div>

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {attachments.map((att: Attachment) => (
              <div
                key={att.id}
                onClick={() => handleAttachmentClick(att.id)}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-md text-sm text-slate-700 cursor-pointer transition-colors"
                title={`Size: ${(att.size / 1024).toFixed(1)} KB`}
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span className="truncate max-w-[200px]">{att.filename}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Analysis Box */}
      {email.aiReasoning && (
        <div className="m-6 mb-2 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-blue-700">
            <BrainCircuit className="w-5 h-5" />
            <h3 className="font-semibold text-sm">Gemini Analyse</h3>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{email.aiReasoning}</p>
        </div>
      )}

      {/* View Toggle (Text/HTML) */}
      {hasHtml && (
        <div className="px-6 py-2 flex justify-end">
          <div className="bg-white border border-slate-200 rounded-lg flex text-sm overflow-hidden shadow-sm">
            <button
              onClick={() => setShowHtml(false)}
              className={`px-3 py-1 ${!showHtml ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Text
            </button>
            <div className="w-[1px] bg-slate-200"></div>
            <button
              onClick={() => setShowHtml(true)}
              className={`px-3 py-1 ${showHtml ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              HTML
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 pt-2">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-100 min-h-[50%]">
          {showHtml && email.bodyHtml ? (
            <div
              className="prose prose-slate max-w-none font-sans text-slate-800"
              onClick={handleLinkClick}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.bodyHtml) }}
            />
          ) : (
            <div className="prose prose-slate max-w-none whitespace-pre-wrap font-sans text-slate-800">
              {email.body}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailView;
