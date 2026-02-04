import React, { useState } from 'react';
import { ImapAccount } from '../../types';
import { PlusCircle, Trash2, Server, CheckCircle, AlertCircle, RefreshCw } from '../Icon';

interface AccountsTabProps {
  accounts: ImapAccount[];
  onAddAccount: (account: ImapAccount) => void;
  onRemoveAccount: (id: string) => void;
}

const AccountsTab: React.FC<AccountsTabProps> = ({ accounts, onAddAccount, onRemoveAccount }) => {
  const [isAdding, setIsAdding] = useState(false);

  // New Account Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newProvider, setNewProvider] = useState('gmx');
  const [newHost, setNewHost] = useState('imap.gmx.net');
  const [newPort, setNewPort] = useState(993);

  // Connection Test State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTestConnection = async () => {
    if (!newEmail || !newPassword) return;

    setTestStatus('testing');
    setTestMessage('');

    if (!window.electron) {
      setTestStatus('error');
      setTestMessage('Web Mode: Test nicht möglich');
      return;
    }

    try {
      const tempAccount: ImapAccount = {
        id: 'temp',
        name: newName,
        email: newEmail,
        username: newEmail,
        password: newPassword,
        provider: newProvider,
        imapHost: newHost,
        imapPort: newPort,
        color: 'blue',
      };

      const result = await window.electron.testConnection(tempAccount);
      if (result.success) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestMessage(result.error || 'Verbindung fehlgeschlagen');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Fehler beim Testen');
    }
  };

  const handleSaveAccount = () => {
    if (newName && newEmail && newPassword) {
      const colors = ['blue', 'green', 'purple', 'amber', 'rose', 'indigo'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      onAddAccount({
        id: `acc-${Date.now()}`,
        name: newName,
        email: newEmail,
        username: newEmail, // Default username to email
        password: newPassword,
        provider: newProvider,
        imapHost: newHost,
        imapPort: newPort,
        color: randomColor,
      });
      setIsAdding(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Verbundene Konten</h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <PlusCircle className="w-4 h-4" />
            Konto hinzufügen
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-4">
          <h4 className="text-sm font-semibold text-slate-700">Neues Konto verbinden</h4>

          {/* Provider Selection */}
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Anbieter</label>
              <div className="flex gap-2">
                {['gmx', 'webde', 'gmail', 'other'].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setNewProvider(p);
                      if (p === 'gmx') {
                        setNewHost('imap.gmx.net');
                        setNewPort(993);
                      }
                      if (p === 'webde') {
                        setNewHost('imap.web.de');
                        setNewPort(993);
                      }
                      if (p === 'gmail') {
                        setNewHost('imap.gmail.com');
                        setNewPort(993);
                      }
                      if (p === 'other') {
                        setNewHost('');
                      }
                    }}
                    className={`px-3 py-2 rounded-md text-sm border ${
                      newProvider === p
                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p === 'gmx' ? 'GMX' : p === 'webde' ? 'Web.de' : p === 'gmail' ? 'Gmail' : 'Andere'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Name (Anzeige)</label>
              <input
                type="text"
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-none placeholder-slate-400"
                placeholder="z.B. Arbeit"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Email Adresse</label>
              <input
                type="email"
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-none placeholder-slate-400"
                placeholder="name@gmx.de"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Passwort</label>
              <input
                type="password"
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-none placeholder-slate-400"
                placeholder="Email Passwort"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            {newProvider === 'other' && (
              <>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">IMAP Server</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-none placeholder-slate-400"
                    placeholder="imap.example.com"
                    value={newHost}
                    onChange={(e) => setNewHost(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Port</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-none placeholder-slate-400"
                    placeholder="993"
                    value={newPort}
                    onChange={(e) => setNewPort(parseInt(e.target.value))}
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />}
                {testStatus === 'success' && (
                  <div className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" /> <span>Verbunden</span>
                  </div>
                )}
                {testStatus === 'error' && (
                  <div className="flex items-center gap-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" /> <span>{testMessage}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTestConnection}
                  disabled={!newEmail || !newPassword || testStatus === 'testing'}
                  className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border border-blue-200 rounded hover:border-blue-300 transition-colors disabled:opacity-50"
                >
                  Verbindung testen
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveAccount}
                  disabled={!newEmail || !newPassword}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Speichern & Verbinden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-200 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-${acc.color}-500`}
              >
                {acc.name.charAt(0)}
              </div>
              <div>
                <div className="font-medium text-slate-900">{acc.name}</div>
                <div className="text-sm text-slate-500 flex items-center gap-1">
                  {acc.email}
                  <span className="w-1 h-1 rounded-full bg-slate-300 mx-1"></span>
                  <Server className="w-3 h-3" /> {acc.imapHost || 'imap.gmx.net'}
                </div>
              </div>
            </div>
            {accounts.length > 1 && (
              <button
                onClick={() => onRemoveAccount(acc.id)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Konto entfernen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountsTab;
