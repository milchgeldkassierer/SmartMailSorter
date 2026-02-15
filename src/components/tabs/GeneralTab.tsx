import React from 'react';
import { Trash2 } from '../Icon';
import { useDialogContext, type UseDialogReturn } from '../../contexts/DialogContext';

function useDialogSafe(): UseDialogReturn | null {
  try {
    return useDialogContext();
  } catch {
    return null;
  }
}

const GeneralTab: React.FC = () => {
  const dialog = useDialogSafe();

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
    <div className="text-center py-10 space-y-4">
      <h3 className="text-lg font-medium text-slate-800">Datenverwaltung</h3>
      <button
        onClick={handleResetDatabase}
        className="flex items-center gap-2 mx-auto px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Datenbank komplett zurücksetzen & neu starten
      </button>
    </div>
  );
};

export default GeneralTab;
