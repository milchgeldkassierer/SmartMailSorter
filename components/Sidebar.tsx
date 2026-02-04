import React, { useState } from 'react';
import {
  CategoryIcon, LogOut, Plus, Settings, ChevronDown, ChevronUp, Server, PlusCircle,
  Folder, FolderOpen, Archive, Send, Inbox, AlertOctagon, Trash2
} from './Icon';
import { ImapAccount, DefaultEmailCategory, LucideIcon } from '../types';

interface SidebarProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onAddCategory: (cat: string) => void;
  categories: { name: string, type: string }[];
  counts: Record<string, number>;
  isProcessing: boolean;
  onReset: () => void;

  // Account Props
  accounts: ImapAccount[];
  activeAccountId: string;
  onSwitchAccount: (id: string) => void;
  onOpenSettings: () => void;
  // Category Actions
  onDeleteCategory: (cat: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  onUpdateIcon?: (cat: string, icon: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  onAddCategory,
  categories,
  counts,
  isProcessing,
  onReset,
  accounts,
  activeAccountId,
  onSwitchAccount,
  onOpenSettings,
  onDeleteCategory,
  onRenameCategory,
  onUpdateIcon
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, category: string } | null>(null);

  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0];

  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim());
      setNewCategoryName("");
      setIsAdding(false);
    }
  };

  const setIsAddingCategory = () => setIsAdding(true);

  // Sort function: Standard -> Physical -> Smart -> Other

  const standardCategories = categories.filter(c => ['Posteingang', 'Gesendet', 'Spam', 'Papierkorb'].includes(c.name));

  // Physical Folders (type='folder')
  // Should NOT include system folders (which are standard)
  const physicalFolders = categories.filter(c => c.type === 'folder' && !standardCategories.includes(c));

  // Smart Categories (type='custom' or 'system')
  const smartCategories = categories.filter(c => (c.type === 'custom' || c.type === 'system') && !standardCategories.includes(c) && c.name !== DefaultEmailCategory.OTHER);

  // Subfolders (Legacy/Migration Support - if any appear as custom but start with Posteingang/)
  // Actually, physicalFolders usually cover "Posteingang/Work". 
  // Let's rely on type='folder' primarily.

  // Sort by name
  physicalFolders.sort((a, b) => a.name.localeCompare(b.name));
  smartCategories.sort((a, b) => a.name.localeCompare(b.name));

  // Sort subfolders purely by name
  // physicalFolders.sort... already done
  // otherCustom.sort... already done

  const renderCategoryItem = (cat: string, displayName: string, icon: LucideIcon, depth = 0) => {
    const isSelected = selectedCategory === cat;
    const count = counts[cat] || 0;

    return (
      <div
        key={cat}
        onClick={() => onSelectCategory(cat)}
        onContextMenu={(e) => handleContextMenu(e, cat)}
        className={`
            flex items-center justify-between px-3 py-2 mx-2 rounded-md cursor-pointer transition-colors group relative
            ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}
            ${depth > 0 ? 'ml-6 border-l border-slate-700 pl-3' : ''}
          `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {React.createElement(icon, { size: 18, className: isSelected ? 'text-blue-200' : 'text-slate-500 group-hover:text-slate-300' })}
          <span className="truncate text-sm font-medium">{displayName}</span>
        </div>
        {count > 0 && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
            {count}
          </span>
        )}
      </div>
    );
  };

  const handleContextMenu = (e: React.MouseEvent, category: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, category });
  };

  // Close context menu on global click
  React.useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-700 select-none">

      {/* Account Switcher Header */}
      <div className="p-4 border-b border-slate-800">
        <button
          onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800 transition-colors group"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {activeAccount ? (
              <>
                <div className={`w-8 h-8 rounded-full bg-${activeAccount.color || 'blue'}-600 flex items-center justify-center text-white font-bold text-sm shadow-inner`}>
                  {activeAccount.name.charAt(0)}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{activeAccount.name}</div>
                  <div className="text-xs text-slate-400 truncate">{activeAccount.email}</div>
                </div>
              </>
            ) : (
              <div className="text-left flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">Kein Konto</div>
                <div className="text-xs text-slate-400 truncate">Bitte einrichten</div>
              </div>
            )}
          </div>
          {isAccountMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Dropdown Menu */}
        {isAccountMenuOpen && (
          <div className="absolute left-4 top-20 w-56 bg-slate-800 rounded-xl shadow-xl border border-slate-700 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="py-1">
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => {
                    onSwitchAccount(acc.id);
                    setIsAccountMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors ${activeAccountId === acc.id ? 'text-white bg-slate-700/50' : 'text-slate-300'
                    }`}
                >
                  <div className={`w-6 h-6 rounded-full bg-${acc.color}-600 flex items-center justify-center text-white text-xs`}>
                    {acc.name.charAt(0)}
                  </div>
                  <span className="truncate">{acc.name}</span>
                  {activeAccountId === acc.id && <div className="w-2 h-2 rounded-full bg-blue-500 ml-auto" />}
                </button>
              ))}
              <div className="border-t border-slate-700 mt-1 pt-1">
                <button
                  onClick={() => {
                    onOpenSettings();
                    setIsAccountMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-slate-700 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>Konten verwalten</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">

        {/* Standard Folders Group */}
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Ordner
          </div>
          <div className="space-y-1">
            {[DefaultEmailCategory.INBOX, 'Gesendet', 'Spam', 'Papierkorb'].map(cat => {
              const isActive = selectedCategory === cat;
              const count = counts[cat] || 0;

              return (
                <React.Fragment key={cat}>
                  <button
                    onClick={() => onSelectCategory(cat)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <CategoryIcon category={cat} className={`w-4 h-4 ${isActive ? 'text-blue-200' : 'text-slate-500'}`} />
                      <span>{cat}</span>
                    </div>
                    {count > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'
                        }`}>
                        {count}
                      </span>
                    )}
                  </button>

                  {/* Physical Folders (Nested under Inbox) */}
                  {cat === DefaultEmailCategory.INBOX && physicalFolders.length > 0 && (
                    <div className="mt-1 mb-1">
                      {physicalFolders.map(c => renderCategoryItem(c.name, c.name.replace('Posteingang/', ''), FolderOpen, 1))}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Smart Categories Group */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Intelligentes Postfach
            </span>
            <button onClick={setIsAddingCategory} className="text-slate-400 hover:text-blue-600 transition-colors" title="Neuen Ordner erstellen">
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">

            {/* Smart Categories */}
            {smartCategories.length > 0 && (
              <div className="mb-2">
                <div className="px-3 text-[10px] text-slate-500 font-semibold uppercase mb-1">KI Kategorien</div>
                {smartCategories.map((category) => (
                  renderCategoryItem(category.name, category.name, Folder)
                ))}
              </div>
            )}

            {/* Sonstiges */}
            {renderCategoryItem(DefaultEmailCategory.OTHER, 'Sonstiges', Archive)}

          </div>

          {/* Add Category Input */}
          {isAdding && (
            <form onSubmit={handleAddNewCategory} className="px-3 mt-2">
              <div className="flex items-center gap-2 bg-slate-800 border border-blue-500 rounded-md px-2 py-1">
                <input
                  autoFocus
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onBlur={() => !newCategoryName && setIsAdding(false)}
                  placeholder="Name..."
                  className="bg-transparent border-none outline-none text-sm w-full min-w-0"
                />
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Context Menu Portal */}
      {contextMenu && (
        <div
          className="fixed bg-slate-800 border border-slate-700 shadow-xl rounded-lg py-1 z-50 min-w-[150px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 border-b border-slate-700 mb-1">
            {contextMenu.category}
          </div>

          {!Object.values(DefaultEmailCategory).includes(contextMenu.category) && (
            <>
              <button
                onClick={() => {
                  const newName = prompt("Neuer Name:", contextMenu.category);
                  if (newName && newName.trim()) onRenameCategory(contextMenu.category, newName.trim());
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
              >
                <div className="w-4 h-4" /> <span>Umbenennen</span>
              </button>
              <div className="h-px bg-slate-700 my-1" />
              <button
                onClick={() => {
                  if (confirm(`Ordner '${contextMenu.category}' wirklich löschen?`)) {
                    onDeleteCategory(contextMenu.category);
                  }
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> <span>Löschen</span>
              </button>
              <div className="h-px bg-slate-700 my-1" />
            </>
          )}

          <button
            onClick={() => {
              alert("Icon-Auswahl folgt bald!");
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
          >
            <div className="w-4 h-4" /> <span>Icon ändern</span>
          </button>
        </div>
      )}

      {/* Storage Quota Visualization */}
      <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <div className="flex items-center gap-1.5">
            <Server className="w-3 h-3" />
            <span>Speicher</span>
          </div>
          {activeAccount && activeAccount.storageTotal ? (
            <span>{Math.round((activeAccount.storageUsed || 0) / 1024)} MB / {Math.round(activeAccount.storageTotal / 1024 / 1024 * 100) / 100} GB ({Math.round(((activeAccount.storageUsed || 0) / activeAccount.storageTotal) * 100)}%)</span>
          ) : (
            <span>Unbekannt</span>
          )}
        </div>

        {activeAccount && activeAccount.storageTotal ? (
          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${((activeAccount.storageUsed || 0) / activeAccount.storageTotal) > 0.9 ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, ((activeAccount.storageUsed || 0) / activeAccount.storageTotal) * 100)}%` }}
            />
          </div>
        ) : (
          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-slate-600 w-full animate-pulse opacity-20" />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800 flex gap-2">
        <button
          onClick={onOpenSettings}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Einstellungen"
        >
          <Settings className="w-5 h-5" />
        </button>
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white px-3 py-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;