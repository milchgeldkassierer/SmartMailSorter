import React from 'react';
import { Trash2 } from '../Icon';

const GeneralTab: React.FC = () => {
  return (
    <div className="text-center py-10 space-y-4">
      <h3 className="text-lg font-medium text-slate-800">Datenverwaltung</h3>
      <button
        onClick={async () => {
          if (confirm('Achtung: Dies löscht alle gespeicherten Emails und Konten! Fortfahren?')) {
            if (window.electron) await window.electron.resetDb();
            window.location.reload();
          }
        }}
        className="flex items-center gap-2 mx-auto px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Datenbank komplett zurücksetzen & neu starten
      </button>
    </div>
  );
};

export default GeneralTab;
