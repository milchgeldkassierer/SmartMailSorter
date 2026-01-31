import React, { useState, useEffect } from 'react';
import { Email } from '../types';
import { CategoryIcon, BrainCircuit, Paperclip, FileText } from './Icon';

interface EmailViewProps {
  email: Email | null;
}

const EmailView: React.FC<EmailViewProps> = ({ email }) => {
  const [showHtml, setShowHtml] = useState(true);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

  useEffect(() => {
    if (email && email.hasAttachments && window.electron) {
      setIsLoadingAttachments(true);
      window.electron.getEmailAttachments(email.id)
        .then((atts: any) => setAttachments(atts))
        .catch((err: any) => console.error(err))
        .finally(() => setIsLoadingAttachments(false));
    } else {
      setAttachments([]);
    }
    // Reset view to HTML preference on email switch
    setShowHtml(true);
  }, [email]);

  if (!email) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <CategoryIcon category={"INBOX"} className="w-16 h-16 mx-auto mb-4 opacity-20" />
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
  const handleLinkClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href && window.electron?.openExternal) {
      e.preventDefault();
      window.electron.openExternal(anchor.href);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
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
              <div className="text-xs text-slate-500">
                {new Date(email.date).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <CategoryIcon category={email.category} className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">{email.category}</span>
          </div>
        </div>

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {attachments.map((att: any) => (
              <div key={att.id} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-md text-sm text-slate-700 cursor-pointer transition-colors" title={`Size: ${(att.size / 1024).toFixed(1)} KB`}>
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
          <p className="text-sm text-slate-700 leading-relaxed">
            {email.aiReasoning}
          </p>
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
              dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
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
