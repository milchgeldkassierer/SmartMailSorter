import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  CategoryIcon,
  Trash2,
  Settings,
  ChevronDown,
  ChevronUp,
  Server,
  PlusCircle,
  Folder,
  FolderOpen,
  Archive,
  Clock,
  Star,
} from './Icon';
import { ImapAccount, DefaultEmailCategory, Category, SYSTEM_FOLDERS, FLAGGED_FOLDER } from '../types';
import { formatTimeAgo, formatNumber } from '../utils/formatTimeAgo';
import { useDialogContext } from '../contexts/DialogContext';

interface SidebarProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onAddCategory: (cat: string) => void;
  categories: Category[];
  counts: Record<string, number>;
  // Account Props
  accounts: ImapAccount[];
  activeAccountId: string;
  onSwitchAccount: (id: string) => void;
  onOpenSettings: () => void;
  // Category Actions
  onDeleteCategory: (cat: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  // Drag & Drop Props
  onDropEmails?: (emailIds: string[], targetCategory: string, targetType: 'folder' | 'smart') => void;
  dropTargetCategory?: string | null;
  isDraggingEmails?: boolean;
  onCategoryDragOver?: (categoryName: string, event: React.DragEvent) => void;
  onCategoryDragLeave?: (event: React.DragEvent) => void;
  // Accessibility: move selected emails via context menu
  selectedEmailCount?: number;
  onMoveSelectedToCategory?: (targetCategory: string, targetType: 'folder' | 'smart') => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  onAddCategory,
  categories,
  counts,
  accounts,
  activeAccountId,
  onSwitchAccount,
  onOpenSettings,
  onDeleteCategory,
  onRenameCategory,
  onDropEmails,
  dropTargetCategory,
  isDraggingEmails,
  onCategoryDragOver,
  onCategoryDragLeave,
  selectedEmailCount,
  onMoveSelectedToCategory,
}) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; category: string } | null>(null);
  const dialog = useDialogContext();

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];

  // Helper function to translate category names
  const getCategoryDisplayName = (categoryName: string): string => {
    // Try to get translation from categories namespace
    const key = `categories.${categoryName}`;
    const translated = t(key, { ns: 'categories', defaultValue: categoryName });
    // If translation key equals the result, return the original name (custom category)
    return translated === key ? categoryName : translated;
  };

  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsAdding(false);
    }
  };

  const setIsAddingCategory = () => setIsAdding(true);

  // Sort function: Standard -> Physical -> Smart -> Other

  const standardCategories = categories.filter((c) => SYSTEM_FOLDERS.includes(c.name));

  // Physical Folders (type='folder')
  // Should NOT include system folders (which are standard)
  const physicalFolders = categories.filter((c) => c.type === 'folder' && !standardCategories.includes(c));

  // Smart Categories (type='custom' or 'system')
  const smartCategories = categories.filter(
    (c) =>
      (c.type === 'custom' || c.type === 'system') &&
      !standardCategories.includes(c) &&
      c.name !== DefaultEmailCategory.OTHER
  );

  // Subfolders (Legacy/Migration Support - if any appear as custom but start with Posteingang/)
  // Actually, physicalFolders usually cover "Posteingang/Work".
  // Let's rely on type='folder' primarily.

  // Sort by name
  physicalFolders.sort((a, b) => a.name.localeCompare(b.name));
  smartCategories.sort((a, b) => a.name.localeCompare(b.name));

  // Sort subfolders purely by name
  // physicalFolders.sort... already done
  // otherCustom.sort... already done

  const handleDragOver = (cat: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onCategoryDragOver?.(cat, e);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    onCategoryDragLeave?.(e);
  };

  const handleDrop = (e: React.DragEvent, category: string, targetType: 'folder' | 'smart') => {
    e.preventDefault();
    const emailIdsJson = e.dataTransfer.getData('application/x-email-ids');
    if (emailIdsJson && onDropEmails) {
      try {
        const emailIds = JSON.parse(emailIdsJson) as string[];
        onDropEmails(emailIds, category, targetType);
      } catch {
        // Invalid data, ignore
      }
    }
  };

  const getDropTargetClasses = (cat: string) => {
    if (!isDraggingEmails) return '';
    if (dropTargetCategory === cat) {
      return 'bg-blue-600/20 shadow-[inset_0_0_0_2px_rgba(59,130,246,0.6)] scale-[1.02] transition-all duration-150';
    }
    return 'bg-slate-800/30 shadow-[inset_0_0_0_1px_rgba(100,116,139,0.3)] transition-all duration-150';
  };

  const renderCategoryItem = (
    cat: string,
    displayName: string,
    icon: LucideIcon,
    depth = 0,
    targetType: 'folder' | 'smart' = 'smart'
  ) => {
    const isSelected = selectedCategory === cat;
    const count = counts[cat] || 0;

    return (
      <div
        key={cat}
        onClick={() => onSelectCategory(cat)}
        onContextMenu={(e) => handleContextMenu(e, cat)}
        onDragOver={(e) => handleDragOver(cat, e)}
        onDragEnter={(e) => {
          e.preventDefault();
          onCategoryDragOver?.(cat, e);
        }}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, cat, targetType)}
        aria-dropeffect={isDraggingEmails ? 'move' : 'none'}
        className={`
            flex items-center justify-between px-3 py-2 mx-2 rounded-md cursor-pointer transition-colors group relative
            ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}
            ${depth > 0 ? 'ml-6 border-l border-slate-700 pl-3' : ''}
            ${getDropTargetClasses(cat)}
          `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {React.createElement(icon, {
            size: 18,
            className: isSelected ? 'text-blue-200' : 'text-slate-500 group-hover:text-slate-300',
          })}
          <span className="truncate text-sm font-medium">{displayName}</span>
        </div>
        {count > 0 && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}
          >
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
                <div
                  className={`w-8 h-8 rounded-full bg-${activeAccount.color || 'blue'}-600 flex items-center justify-center text-white font-bold text-sm shadow-inner`}
                >
                  {activeAccount.name.charAt(0)}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{activeAccount.name}</div>
                  <div className="text-xs text-slate-400 truncate">{activeAccount.email}</div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>
                      {activeAccount.lastSyncTime
                        ? formatTimeAgo(activeAccount.lastSyncTime)
                        : t('sidebar.neverSynced')}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-left flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{t('sidebar.noAccount')}</div>
                <div className="text-xs text-slate-400 truncate">{t('sidebar.pleaseSetup')}</div>
              </div>
            )}
          </div>
          {isAccountMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Dropdown Menu */}
        {isAccountMenuOpen && (
          <div className="absolute left-4 top-20 w-56 bg-slate-800 rounded-xl shadow-xl border border-slate-700 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="py-1">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => {
                    onSwitchAccount(acc.id);
                    setIsAccountMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors ${
                    activeAccountId === acc.id ? 'text-white bg-slate-700/50' : 'text-slate-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-${acc.color}-600 flex items-center justify-center text-white text-xs`}
                  >
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
                  <span>{t('sidebar.manageAccounts')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {/* Standard Folders Group */}
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('sidebar.folders')}</div>
          <div className="space-y-1">
            {SYSTEM_FOLDERS.map((cat) => {
              const isActive = selectedCategory === cat;
              const count = counts[cat] || 0;

              return (
                <React.Fragment key={cat}>
                  <button
                    onClick={() => onSelectCategory(cat)}
                    onDragOver={(e) => handleDragOver(cat, e)}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      onCategoryDragOver?.(cat, e);
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, cat, 'folder')}
                    aria-dropeffect={isDraggingEmails ? 'move' : 'none'}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    } ${getDropTargetClasses(cat)}`}
                  >
                    <div className="flex items-center gap-3">
                      <CategoryIcon
                        category={cat}
                        className={`w-4 h-4 ${isActive ? 'text-blue-200' : 'text-slate-500'}`}
                      />
                      <span>{getCategoryDisplayName(cat)}</span>
                    </div>
                    {count > 0 && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>

                  {/* Physical Folders (Nested under Inbox) */}
                  {cat === DefaultEmailCategory.INBOX && physicalFolders.length > 0 && (
                    <div className="mt-1 mb-1">
                      {physicalFolders.map((c) =>
                        renderCategoryItem(c.name, c.name.replace('Posteingang/', ''), FolderOpen, 1, 'folder')
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Flagged/Starred Virtual View */}
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('sidebar.markings')}</div>
          <div className="space-y-1">{renderCategoryItem(FLAGGED_FOLDER, t('sidebar.starred'), Star)}</div>
        </div>

        {/* Smart Categories Group */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('sidebar.smartMailbox')}
            </span>
            <button
              onClick={setIsAddingCategory}
              className="text-slate-400 hover:text-blue-600 transition-colors"
              title={t('sidebar.createNewFolder')}
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {/* Smart Categories */}
            {smartCategories.length > 0 && (
              <div className="mb-2">
                <div className="px-3 text-[10px] text-slate-500 font-semibold uppercase mb-1">{t('sidebar.aiCategories')}</div>
                {smartCategories.map((category) => renderCategoryItem(category.name, getCategoryDisplayName(category.name), Folder))}
              </div>
            )}

            {/* Create new category drop zone (visible only when dragging) */}
            {isDraggingEmails && (
              <button
                type="button"
                tabIndex={0}
                onDragOver={(e) => handleDragOver('__new_category__', e)}
                onDragEnter={(e) => {
                  e.preventDefault();
                  onCategoryDragOver?.('__new_category__', e);
                }}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  e.preventDefault();
                  const emailIdsJson = e.dataTransfer.getData('application/x-email-ids');
                  if (emailIdsJson && onDropEmails) {
                    try {
                      const emailIds = JSON.parse(emailIdsJson) as string[];
                      onDropEmails(emailIds, '__new_category__', 'smart');
                    } catch {
                      // Invalid data, ignore
                    }
                  }
                }}
                aria-dropeffect="move"
                className={`flex items-center gap-3 px-3 py-2 mx-2 rounded-lg transition-all duration-150 ${
                  dropTargetCategory === '__new_category__'
                    ? 'bg-blue-600/20 shadow-[inset_0_0_0_2px_rgba(59,130,246,0.6)] text-blue-300'
                    : 'bg-slate-800/40 shadow-[inset_0_0_0_1px_rgba(100,116,139,0.25)] text-slate-500'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span className="text-sm">Neue Kategorie erstellen</span>
              </button>
            )}

            {/* Sonstiges */}
            {renderCategoryItem(DefaultEmailCategory.OTHER, t('sidebar.other'), Archive)}
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
                  placeholder={t('sidebar.namePlaceholder')}
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

          {!(Object.values(DefaultEmailCategory) as string[]).includes(contextMenu.category) &&
            contextMenu.category !== FLAGGED_FOLDER && (
              <>
                <button
                  onClick={async () => {
                    const category = contextMenu.category;
                    setContextMenu(null);
                    const newName = await dialog.prompt({
                      title: t('sidebar.renameCategory'),
                      message: t('sidebar.renameCategoryPrompt'),
                      defaultValue: category,
                      confirmText: t('common.rename'),
                      cancelText: t('common.cancel'),
                      variant: 'info',
                    });
                    if (newName && newName.trim()) onRenameCategory(category, newName.trim());
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                >
                  <div className="w-4 h-4" /> <span>{t('common.rename')}</span>
                </button>
                <div className="h-px bg-slate-700 my-1" />
                <button
                  onClick={async () => {
                    const category = contextMenu.category;
                    setContextMenu(null);
                    const confirmed = await dialog.confirm({
                      title: t('sidebar.deleteCategory'),
                      message: t('sidebar.deleteCategoryConfirm', { category }),
                      confirmText: t('common.delete'),
                      cancelText: t('common.cancel'),
                      variant: 'danger',
                    });
                    if (confirmed) {
                      onDeleteCategory(category);
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> <span>{t('common.delete')}</span>
                </button>
                <div className="h-px bg-slate-700 my-1" />
              </>
            )}

          {selectedEmailCount != null && selectedEmailCount > 0 && onMoveSelectedToCategory && (
            <>
              <button
                type="button"
                onClick={() => {
                  const category = contextMenu.category;
                  const catObj = categories.find((c) => c.name === category);
                  const targetType: 'folder' | 'smart' = catObj?.type === 'folder' ? 'folder' : 'smart';
                  setContextMenu(null);
                  onMoveSelectedToCategory(category, targetType);
                }}
                className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-blue-900/30 flex items-center gap-2"
              >
                <Folder className="w-4 h-4" />
                <span>Ausgewählte hierher verschieben ({selectedEmailCount})</span>
              </button>
              <div className="h-px bg-slate-700 my-1" />
            </>
          )}

          <button
            onClick={async () => {
              setContextMenu(null);
              await dialog.alert({
                title: t('sidebar.featureInDevelopment'),
                message: t('sidebar.iconSelectionComingSoon'),
                confirmText: t('common.ok'),
                variant: 'info',
              });
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
          >
            <div className="w-4 h-4" /> <span>{t('sidebar.changeIcon')}</span>
          </button>
        </div>
      )}

      {/* Storage Quota Visualization */}
      <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <div className="flex items-center gap-1.5">
            <Server className="w-3 h-3" />
            <span>{t('sidebar.storage')}</span>
          </div>
          {activeAccount && activeAccount.storageTotal ? (
            <span>
              {formatNumber((activeAccount.storageUsed || 0) / 1024, { maximumFractionDigits: 0 })} MB /{' '}
              {formatNumber(activeAccount.storageTotal / 1024 / 1024, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB (
              {formatNumber(((activeAccount.storageUsed || 0) / activeAccount.storageTotal) * 100, { maximumFractionDigits: 0 })}%)
            </span>
          ) : (
            <span>{t('common.unknown')}</span>
          )}
        </div>

        {activeAccount && activeAccount.storageTotal ? (
          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${(activeAccount.storageUsed || 0) / activeAccount.storageTotal > 0.9 ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{
                width: `${Math.min(100, ((activeAccount.storageUsed || 0) / activeAccount.storageTotal) * 100)}%`,
              }}
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
          title={t('common.settings')}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
