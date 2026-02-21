import React, { useState, useEffect } from 'react';
import { Trash2 } from '../Icon';
import { useOptionalDialogContext } from '../../contexts/DialogContext';

const MIN_SYNC_INTERVAL = 2;
const MAX_SYNC_INTERVAL = 30;

const GeneralTab: React.FC = () => {
  const dialog = useOptionalDialogContext();
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(0);
  const [inputValue, setInputValue] = useState<string>('');

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

  useEffect(() => {
    setInputValue(autoSyncInterval > 0 ? String(autoSyncInterval) : '');
  }, [autoSyncInterval]);

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
      updateInterval(MIN_SYNC_INTERVAL);
    }
  };

  const handleDecrement = () => {
    if (autoSyncInterval > MIN_SYNC_INTERVAL) {
      updateInterval(autoSyncInterval - 1);
    }
  };

  const handleIncrement = () => {
    if (autoSyncInterval < MAX_SYNC_INTERVAL) {
      updateInterval(autoSyncInterval + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (inputValue === '' || isNaN(parsed)) {
      updateInterval(autoSyncInterval);
    } else {
      updateInterval(Math.max(MIN_SYNC_INTERVAL, Math.min(MAX_SYNC_INTERVAL, parsed)));
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
        if (window.electron) {
          const result = await window.electron.resetDb();
          if (result && typeof result === 'object' && !result.success) {
            const msg = result.message || 'Datenbank konnte nicht zurückgesetzt werden.';
            if (dialog) {
              await dialog.alert({ title: 'Hinweis', message: msg });
            } else {
              alert(msg);
            }
            return;
          }
        }
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
              <span className="text-sm text-slate-600">Alle</span>
              <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={autoSyncInterval <= MIN_SYNC_INTERVAL}
                  className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  −
                </button>
                <input
                  type="number"
                  min={MIN_SYNC_INTERVAL}
                  max={MAX_SYNC_INTERVAL}
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  aria-label="Synchronisationsintervall in Minuten"
                  className="w-12 text-center text-sm text-slate-700 border-x border-slate-300 py-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={autoSyncInterval >= MAX_SYNC_INTERVAL}
                  className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-slate-600">Minuten</span>
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
