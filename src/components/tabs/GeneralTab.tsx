import React, { useState, useEffect } from 'react';
import { Trash2 } from '../Icon';
import { useOptionalDialogContext } from '../../contexts/DialogContext';

const SYNC_INTERVAL_OPTIONS = [
  { value: 0, label: 'Deaktiviert' },
  { value: 5, label: 'Alle 5 Minuten' },
  { value: 10, label: 'Alle 10 Minuten' },
  { value: 15, label: 'Alle 15 Minuten' },
  { value: 30, label: 'Alle 30 Minuten' },
];

const GeneralTab: React.FC = () => {
  const dialog = useOptionalDialogContext();
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(0);

  useEffect(() => {
    if (window.electron?.getAutoSyncInterval) {
      window.electron.getAutoSyncInterval().then((interval: number) => {
        setAutoSyncInterval(interval);
      });
    }
  }, []);

  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(e.target.value);
    setAutoSyncInterval(value);
    if (window.electron?.setAutoSyncInterval) {
      window.electron.setAutoSyncInterval(value);
    }
  };

  const handleResetDatabase = async () => {
    let confirmed = false;

    if (dialog) {
      confirmed = await dialog.confirm({
        title: 'Datenbank zurücksetzen',
        message: 'Achtung: Dies löscht alle gespeicherten Emails und Konten! Fortfahren?',
        confirmText: 'Zurücksetzen',
        cancelText: 'Abbrechen',
        variant: 'danger',
      });
    } else {
      confirmed = window.confirm('Achtung: Dies löscht alle gespeicherten Emails und Konten! Fortfahren?');
    }

    if (confirmed) {
      try {
        if (window.electron) await window.electron.resetDb();
        window.location.reload();
      } catch (error) {
        console.error('Failed to reset database:', error);
        const errorMessage = `Datenbank konnte nicht zurückgesetzt werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`;
        if (dialog) {
          await dialog.alert({
            title: 'Fehler',
            message: errorMessage,
            variant: 'danger',
          });
        } else {
          alert(errorMessage);
        }
      }
    }
  };

  return (
    <div className="space-y-8 py-6">
      {/* Automatische Synchronisation */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-800">Automatische Synchronisation</h3>
        <p className="text-sm text-slate-500">
          Lege fest, in welchem Intervall E-Mails automatisch synchronisiert werden sollen.
        </p>
        <div className="flex items-center gap-4">
          <select
            value={autoSyncInterval}
            onChange={handleIntervalChange}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {SYNC_INTERVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Datenverwaltung */}
      <div className="text-center space-y-4">
        <h3 className="text-lg font-medium text-slate-800">Datenverwaltung</h3>
        <button
          onClick={handleResetDatabase}
          className="flex items-center gap-2 mx-auto px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Datenbank komplett zurücksetzen & neu starten
        </button>
      </div>
    </div>
  );
};

export default GeneralTab;
