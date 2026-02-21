import React, { useState, useEffect } from 'react';
import { Trash2 } from '../Icon';
import { useOptionalDialogContext } from '../../contexts/DialogContext';

const SYNC_INTERVAL_OPTIONS = [
  { value: 5, label: '5 Minuten' },
  { value: 10, label: '10 Minuten' },
  { value: 15, label: '15 Minuten' },
  { value: 30, label: '30 Minuten' },
];
const DEFAULT_SYNC_INTERVAL = 5;

const GeneralTab: React.FC = () => {
  const dialog = useOptionalDialogContext();
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(0);

  useEffect(() => {
    if (window.electron?.getAutoSyncInterval) {
      window.electron
        .getAutoSyncInterval()
        .then((interval: number) => {
          setAutoSyncInterval(interval);
        })
        .catch((err: unknown) => {
          console.error('Failed to load auto-sync interval:', err);
        });
    }
  }, []);

  const updateInterval = (value: number) => {
    const previousValue = autoSyncInterval;
    setAutoSyncInterval(value);
    if (window.electron?.setAutoSyncInterval) {
      window.electron.setAutoSyncInterval(value).catch((err: unknown) => {
        console.error('Failed to save sync interval:', err);
        setAutoSyncInterval(previousValue);
      });
    }
  };

  const handleToggleSync = () => {
    if (autoSyncInterval > 0) {
      updateInterval(0);
    } else {
      updateInterval(DEFAULT_SYNC_INTERVAL);
    }
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateInterval(Number(e.target.value));
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
    <div className="space-y-6">
      {/* Automatische Synchronisation */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-800">Automatische Synchronisation</h3>
        <p className="text-sm text-slate-500">
          Lege fest, in welchem Intervall E-Mails automatisch synchronisiert werden sollen.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleToggleSync}
            role="switch"
            aria-checked={autoSyncInterval > 0}
            aria-label="Automatische Synchronisation"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoSyncInterval > 0 ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoSyncInterval > 0 ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          {autoSyncInterval > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="auto-sync-interval" className="text-sm text-slate-600">
                Alle
              </label>
              <select
                id="auto-sync-interval"
                value={autoSyncInterval}
                onChange={handleIntervalChange}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {SYNC_INTERVAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {autoSyncInterval === 0 && <span className="text-sm text-slate-500">Deaktiviert</span>}
        </div>
      </div>

      {/* Datenverwaltung */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-800">Datenverwaltung</h3>
        <button
          onClick={handleResetDatabase}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Datenbank komplett zurücksetzen & neu starten
        </button>
      </div>
    </div>
  );
};

export default GeneralTab;
