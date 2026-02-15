import React from 'react';
import { Trash2 } from '../Icon';
import { useDialogContext } from '../../contexts/DialogContext';

const GeneralTab: React.FC = () => {
  const dialog = useDialogContext();

  const handleResetDatabase = async () => {
    const confirmed = await dialog.confirm({
      title: 'Datenbank zurücksetzen',
      message: 'Achtung: Dies löscht alle gespeicherten Emails und Konten! Fortfahren?',
      confirmText: 'Zurücksetzen',
      cancelText: 'Abbrechen',
      variant: 'danger',
    });

    if (confirmed) {
      if (window.electron) await window.electron.resetDb();
      window.location.reload();
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
