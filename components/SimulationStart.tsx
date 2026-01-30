import React, { useState } from 'react';
import { Mail, ShieldAlert } from 'lucide-react';

interface Props {
  onStart: (apiKey: string) => void;
  isConnecting: boolean;
}

const SimulationStart: React.FC<Props> = ({ onStart, isConnecting }) => {
  // We don't ask for API Key here anymore because it's env based, 
  // but we keep the button to trigger the "login".
  
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-700 p-8 text-center">
          <Mail className="w-16 h-16 text-white mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">GMX AI Sorter</h1>
          <p className="text-blue-200 mt-2">Intelligent Email Categorization Prototype</p>
        </div>
        
        <div className="p-8">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6">
             <div className="flex items-start gap-3">
               <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
               <p className="text-sm text-amber-800">
                 <strong>Simulation Mode:</strong> Direct IMAP access is not possible from a browser. This app uses Gemini AI to generate realistic email data and demonstrate how the AI sorting algorithm functions.
               </p>
             </div>
          </div>

          <p className="text-slate-600 mb-6 text-sm">
            Klicken Sie auf "Verbinden", um den Simulator zu starten. Gemini generiert Beispiel-Emails und sortiert diese automatisch in die richtigen Ordner.
          </p>

          <button
            onClick={() => onStart("")}
            disabled={isConnecting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generiere Postfach...</span>
              </>
            ) : (
              "Mit Demo-Postfach verbinden"
            )}
          </button>
        </div>
        
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-xs text-slate-400">Powered by Gemini 3 Flash Preview</p>
        </div>
      </div>
    </div>
  );
};

export default SimulationStart;
