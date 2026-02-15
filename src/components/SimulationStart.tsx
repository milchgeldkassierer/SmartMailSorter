import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, ShieldAlert } from 'lucide-react';

interface Props {
  onStart: (apiKey: string) => void;
  isConnecting: boolean;
}

const SimulationStart: React.FC<Props> = ({ onStart, isConnecting }) => {
  const { t } = useTranslation();
  // We don't ask for API Key here anymore because it's env based,
  // but we keep the button to trigger the "login".

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-700 p-8 text-center">
          <Mail className="w-16 h-16 text-white mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">{t('simulationStart.title')}</h1>
          <p className="text-blue-200 mt-2">{t('simulationStart.subtitle')}</p>
        </div>

        <div className="p-8">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>{t('simulationStart.simulationModeTitle')}</strong> {t('simulationStart.simulationModeDescription')}
              </p>
            </div>
          </div>

          <p className="text-slate-600 mb-6 text-sm">{t('simulationStart.description')}</p>

          <button
            onClick={() => onStart('')}
            disabled={isConnecting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t('simulationStart.connecting')}</span>
              </>
            ) : (
              t('simulationStart.connectButton')
            )}
          </button>
        </div>

        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-xs text-slate-400">{t('simulationStart.poweredBy')}</p>
        </div>
      </div>
    </div>
  );
};

export default SimulationStart;
