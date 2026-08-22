import React, { useState, useRef, useEffect } from 'react';
import {
  AppData,
  Category,
  MainTabType,
  AppTheme,
  ViewSettings,
  ArchiveItem,
  TagFieldKey,
  MEDIA_TAG_FIELDS,
  GAME_TAG_FIELDS,
} from '../types';
import { createDefaultTierRows, INITIAL_DATA } from '../data/initialData';
import {
  downloadJsonFile,
  parseUploadedJson,
  downloadPhoneHtml,
} from '../utils/fileSystem';
import {
  getFieldScopedTags,
  getFieldScopedTagCounts,
  renameTagInItems,
  removeTagFromItems,
} from '../utils/tagUtils';
import {
  X,
  Plus,
  Trash2,
  FolderSync,
  Download,
  Upload,
  Smartphone,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Layers,
  Settings,
  Palette,
  Keyboard,
  Check,
  RotateCcw,
  Tags,
  Edit2,
  Film,
  Gamepad2,
  Building2,
  Clapperboard,
  Users,
} from 'lucide-react';

interface SettingsModalProps {
  appData: AppData;
  activeMainTab: MainTabType;
  dirHandle: FileSystemDirectoryHandle | null;
  viewSettings: ViewSettings;
  onUpdateViewSettings: (newSettings: Partial<ViewSettings>) => void;
  onConnectFolder: () => Promise<void>;
  onDisconnectFolder: () => void;
  onUpdateCategories: (mainTab: MainTabType, newCategories: Category[]) => void;
  onUpdateItems?: (newItems: ArchiveItem[]) => void;
  onReplaceAllData: (newData: AppData) => void;
  onClose: () => void;
}

interface ThemeOption {
  id: AppTheme;
  name: string;
  desc: string;
  bgPreview: string;
  accentPreview: string;
  cardPreview: string;
  borderPreview: string;
}

const THEMES: ThemeOption[] = [
  {
    id: 'pure-dark',
    name: 'Saf Siyah (OLED)',
    desc: 'Maksimum kontrast, zifiri siyah zemin (#000000) ve sade metalik çizgiler',
    bgPreview: 'bg-[#000000]',
    cardPreview: 'bg-[#0c0c0e]',
    accentPreview: 'bg-white',
    borderPreview: 'border-white/20',
  },
  {
    id: 'charcoal-gray',
    name: 'Koyu Gri (Dark Slate / Charcoal)',
    desc: 'Çok koyu, şık ve mat antrasit/gri zemin (#0f1115)',
    bgPreview: 'bg-[#0f1115]',
    cardPreview: 'bg-[#181b22]',
    accentPreview: 'bg-slate-300',
    borderPreview: 'border-slate-500/30',
  },
  {
    id: 'dark-slate',
    name: 'Grimsi Gri (Medium Slate)',
    desc: 'Biraz daha açık, dengeli ve derin grimsi zemin (#1a1d24)',
    bgPreview: 'bg-[#1a1d24]',
    cardPreview: 'bg-[#242832]',
    accentPreview: 'bg-blue-400',
    borderPreview: 'border-blue-500/30',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  appData,
  activeMainTab,
  dirHandle,
  viewSettings,
  onUpdateViewSettings,
  onConnectFolder,
  onDisconnectFolder,
  onUpdateCategories,
  onUpdateItems,
  onReplaceAllData,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'tags' | 'themes' | 'shortcuts' | 'storage'>('categories');
  const [settingsMainTab, setSettingsMainTab] = useState<MainTabType>(activeMainTab);
  const [tagFieldKey, setTagFieldKey] = useState<TagFieldKey>('firm');
  const [connecting, setConnecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTheme = viewSettings.theme || 'pure-dark';
  const cats = appData.categories[settingsMainTab] || [];

  // Active tag field list based on media/game
  const currentTagFields = settingsMainTab === 'media' ? MEDIA_TAG_FIELDS : GAME_TAG_FIELDS;

  // Make sure tagFieldKey matches active settingsMainTab
  useEffect(() => {
    if (settingsMainTab === 'media' && (tagFieldKey === 'developer')) {
      setTagFieldKey('firm');
    } else if (settingsMainTab === 'game' && (tagFieldKey === 'firm' || tagFieldKey === 'director' || tagFieldKey === 'actors')) {
      setTagFieldKey('developer');
    }
  }, [settingsMainTab, tagFieldKey]);

  // Tag Management Handlers
  const handleRenameTag = (oldTag: string) => {
    const newTag = window.prompt(`"${oldTag}" etiketini yeniden adlandır:`, oldTag);
    if (!newTag || !newTag.trim() || newTag.trim() === oldTag) return;

    if (!onUpdateItems) return;
    const updated = renameTagInItems(
      appData.items,
      settingsMainTab,
      tagFieldKey,
      oldTag,
      newTag.trim()
    );
    onUpdateItems(updated);
  };

  const handleDeleteTag = (tagToDelete: string) => {
    const countsMap = getFieldScopedTagCounts(appData.items, settingsMainTab, tagFieldKey);
    const count = countsMap.get(tagToDelete) || 0;
    const ok = window.confirm(
      `"${tagToDelete}" etiketini bu alandaki ${count} yapımın tümünden silmek istediğinize emin misiniz?`
    );
    if (!ok) return;

    if (!onUpdateItems) return;
    const updated = removeTagFromItems(
      appData.items,
      settingsMainTab,
      tagFieldKey,
      tagToDelete
    );
    onUpdateItems(updated);
  };

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Category Actions
  const handleRenameCategory = (catId: string, currentName: string) => {
    const newName = window.prompt('Kategori adı:', currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;

    const updated = cats.map((c) =>
      c.id === catId ? { ...c, name: newName.trim() } : c
    );
    onUpdateCategories(settingsMainTab, updated);
  };

  const handleToggleTierList = (cat: Category) => {
    if (!cat.tierEnabled) {
      // Enable tier list
      const updated = cats.map((c) =>
        c.id === cat.id
          ? {
              ...c,
              tierEnabled: true,
              tierRows: c.tierRows.length > 0 ? c.tierRows : createDefaultTierRows(),
            }
          : c
      );
      onUpdateCategories(settingsMainTab, updated);
    } else {
      // Disabling tier list: check if placed cards exist
      const hasPlaced = appData.items.some(
        (it) => it.mainTab === settingsMainTab && it.cat === cat.id && it.tier
      );
      if (hasPlaced) {
        const ok = window.confirm(
          `"${cat.name}" kategorisinde yerleştirilmiş kartlar var. Kapatırsan tüm yerleştirmeler havuza geri dönecek. Emin misin?`
        );
        if (!ok) return;
      }
      const updated = cats.map((c) =>
        c.id === cat.id ? { ...c, tierEnabled: false } : c
      );
      onUpdateCategories(settingsMainTab, updated);
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    const itemCount = appData.items.filter(
      (it) => it.mainTab === settingsMainTab && it.cat === cat.id
    ).length;

    if (itemCount > 0) {
      const ok = window.confirm(
        `"${cat.name}" kategorisinde ${itemCount} adet yapım var. Kategoriyi silersen bu yapımlar kategorisiz kalır. Emin misin?`
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(`"${cat.name}" kategorisini silmek istediğinize emin misiniz?`);
      if (!ok) return;
    }

    const updated = cats.filter((c) => c.id !== cat.id);
    onUpdateCategories(settingsMainTab, updated);
  };

  const handleAddSubgroup = (catId: string) => {
    const name = window.prompt('Yeni alt-grup adı (ör: Yerli, Yabancı, Shonen):');
    if (!name || !name.trim()) return;

    const updated = cats.map((c) => {
      if (c.id === catId) {
        if (c.subgroups.includes(name.trim())) {
          window.alert('Bu alt-grup zaten mevcut.');
          return c;
        }
        return { ...c, subgroups: [...c.subgroups, name.trim()] };
      }
      return c;
    });
    onUpdateCategories(settingsMainTab, updated);
  };

  const handleDeleteSubgroup = (catId: string, subName: string) => {
    const updated = cats.map((c) =>
      c.id === catId
        ? { ...c, subgroups: c.subgroups.filter((s) => s !== subName) }
        : c
    );
    onUpdateCategories(settingsMainTab, updated);
  };

  const handleAddCategory = () => {
    const name = window.prompt('Yeni kategori adı (ör: Belgesel, Korku, Souls):');
    if (!name || !name.trim()) return;

    const id = `cat_${Date.now()}`;
    const newCat: Category = {
      id,
      name: name.trim(),
      subgroups: [],
      tierEnabled: false,
      tierRows: [],
    };
    onUpdateCategories(settingsMainTab, [...cats, newCat]);
  };

  // Connect Folder
  const handleConnect = async () => {
    setConnecting(true);
    try {
      await onConnectFolder();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        window.alert('Klasör bağlantısı sırasında hata: ' + (err.message || err));
      }
    } finally {
      setConnecting(false);
    }
  };

  // Upload JSON
  const handleUploadJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseUploadedJson(file);
      if (window.confirm(`Yedek dosyasından ${data.items?.length || 0} yapım yüklenecek. Mevcut verilerin üzerine yazılsın mı?`)) {
        onReplaceAllData(data);
        window.alert('Veriler başarıyla yüklendi!');
      }
    } catch (err: any) {
      window.alert('Geçersiz dosya: ' + (err.message || err));
    }
  };

  return (
    <div
      id="settings-modal-overlay"
      className={`fixed inset-0 z-50 ${
        viewSettings.backdropBlur !== false
          ? 'bg-black/75 backdrop-blur-sm'
          : 'bg-transparent backdrop-blur-none pointer-events-auto'
      } flex items-center justify-center p-3 sm:p-6 overflow-y-auto transition-all duration-200`}
      onClick={onClose}
    >
      <div
        id="settings-modal-box"
        className="relative w-full max-w-3xl h-[85vh] max-h-[92vh] min-h-[560px] bg-[#12151f] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-black/30">
          <h3 className="font-semibold text-base text-slate-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" />
            Ayarlar
          </h3>
          <button
            id="close-settings-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-white/10 px-4 pt-2 gap-1.5 bg-black/20 overflow-x-auto">
          <button
            id="tab-btn-categories"
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-400 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Kategoriler
          </button>

          <button
            id="tab-btn-tags"
            onClick={() => setActiveTab('tags')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'tags'
                ? 'border-blue-500 text-blue-400 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tags className="w-3.5 h-3.5" /> Etiketler (Alan Bazlı)
          </button>

          <button
            id="tab-btn-themes"
            onClick={() => setActiveTab('themes')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'themes'
                ? 'border-blue-500 text-blue-400 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" /> Temalar (Test)
          </button>

          <button
            id="tab-btn-shortcuts"
            onClick={() => setActiveTab('shortcuts')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'shortcuts'
                ? 'border-blue-500 text-blue-400 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" /> Kısayollar (Shortcuts)
          </button>

          <button
            id="tab-btn-storage"
            onClick={() => setActiveTab('storage')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'storage'
                ? 'border-blue-500 text-blue-400 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" /> Veri & Dosya Sistemi
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {/* TAB 1: CATEGORIES */}
          {activeTab === 'categories' && (
            <div>
              {/* Media / Game toggle in settings */}
              <div className="flex gap-2 mb-4 p-1 bg-black/40 rounded-xl border border-white/10 w-fit">
                <button
                  id="settings-media-tab-btn"
                  onClick={() => setSettingsMainTab('media')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    settingsMainTab === 'media'
                      ? 'bg-white/15 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🎬 Medya Kategorileri
                </button>
                <button
                  id="settings-game-tab-btn"
                  onClick={() => setSettingsMainTab('game')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    settingsMainTab === 'game'
                      ? 'bg-white/15 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🎮 Oyun Kategorileri
                </button>
              </div>

              {/* Categories list */}
              <div className="space-y-3">
                {cats.map((c) => {
                  const itemCount = appData.items.filter(
                    (it) => it.mainTab === settingsMainTab && it.cat === c.id
                  ).length;

                  return (
                    <div
                      key={c.id}
                      id={`manage-cat-${c.id}`}
                      className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        {/* Name + Item count */}
                        <div
                          onClick={() => handleRenameCategory(c.id, c.name)}
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <span className="font-semibold text-sm text-slate-100 group-hover:text-blue-400 transition-colors">
                            {c.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            ({itemCount} yapım)
                          </span>
                          <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            ✎ Adı Değiştir
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white">
                            <input
                              type="checkbox"
                              checked={c.tierEnabled}
                              onChange={() => handleToggleTierList(c)}
                              className="rounded border-white/20 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-black/40"
                            />
                            <span>Tier List Aktif</span>
                          </label>

                          <button
                            onClick={() => handleDeleteCategory(c)}
                            title="Kategoriyi Sil"
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Subgroups */}
                      <div className="pt-2 border-t border-white/5">
                        <div className="text-[11px] text-slate-400 mb-1.5 font-medium flex items-center justify-between">
                          <span>Alt Gruplar:</span>
                          <button
                            onClick={() => handleAddSubgroup(c.id)}
                            className="text-blue-400 hover:text-blue-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Alt Grup Ekle
                          </button>
                        </div>

                        {c.subgroups && c.subgroups.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {c.subgroups.map((sub) => (
                              <span
                                key={sub}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200"
                              >
                                {sub}
                                <button
                                  onClick={() => handleDeleteSubgroup(c.id, sub)}
                                  className="text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                                  title="Alt grubu kaldır"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">
                            Tanımlı alt grup yok.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  id="add-new-category-btn"
                  onClick={handleAddCategory}
                  className="w-full py-2.5 border border-dashed border-white/20 hover:border-blue-500/50 rounded-xl text-slate-300 hover:text-blue-400 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-blue-500/5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Yeni Kategori Ekle ({settingsMainTab === 'media' ? 'Medya' : 'Oyun'})
                </button>
              </div>
            </div>
          )}

          {/* TAB: TAGS (FIELD-SCOPED) */}
          {activeTab === 'tags' && (
            <div className="space-y-4">
              {/* Media / Game toggle */}
              <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/10 w-fit">
                <button
                  onClick={() => {
                    setSettingsMainTab('media');
                    setTagFieldKey('firm');
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    settingsMainTab === 'media'
                      ? 'bg-white/15 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" /> Medya Etiketleri
                </button>
                <button
                  onClick={() => {
                    setSettingsMainTab('game');
                    setTagFieldKey('developer');
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    settingsMainTab === 'game'
                      ? 'bg-white/15 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5" /> Oyun Etiketleri
                </button>
              </div>

              {/* Field selector tabs */}
              <div className="flex gap-1.5 border-b border-white/10 pb-2 overflow-x-auto">
                {currentTagFields.map((field) => (
                  <button
                    key={field.key}
                    onClick={() => setTagFieldKey(field.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      tagFieldKey === field.key
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm'
                        : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-white/5'
                    }`}
                  >
                    <span>{field.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full text-slate-400 font-mono">
                      {getFieldScopedTags(appData.items, settingsMainTab, field.key).length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Active Field Tags List */}
              {(() => {
                const tagsList = getFieldScopedTags(appData.items, settingsMainTab, tagFieldKey);
                const tagCounts = getFieldScopedTagCounts(appData.items, settingsMainTab, tagFieldKey);

                if (tagsList.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Bu alanda kayıtlı etiket bulunmuyor. Yapım detayından etiket ekleyebilirsiniz.
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {tagsList.map((tag) => (
                      <div
                        key={tag}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-xs font-medium text-slate-200 truncate group-hover:text-blue-300 transition-colors">
                            {tag}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-slate-400 shrink-0 font-mono font-semibold">
                            {tagCounts.get(tag) || 0} yapım
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleRenameTag(tag)}
                            title="Etiketi Yeniden Adlandır"
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag)}
                            title="Etiketi Sil (Tüm yapımlardan kaldırılır)"
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: THEMES (TEST) */}
          {activeTab === 'themes' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-200">
                💡 <span className="font-semibold">Tema & Görünüm Ayarları:</span> Farklı renk temalarını deneyebilir, arka plan bulanıklığını açıp kapatabilirsiniz.
              </div>

              {/* Backdrop Blur Toggle */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    Arka Plan Bulanıklığı
                  </span>
                  <p className="text-xs text-slate-400">
                    Açıkken pencerelerin arkasını hafif buzlu/bulanık yapar; kapalıyken arkadaki temanın net görünmesini sağlar.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={viewSettings.backdropBlur !== false}
                    onChange={(e) => onUpdateViewSettings({ backdropBlur: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {THEMES.map((th) => {
                  const isSelected = currentTheme === th.id;
                  return (
                    <div
                      key={th.id}
                      onClick={() => onUpdateViewSettings({ theme: th.id })}
                      className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 relative ${
                        isSelected
                          ? 'border-blue-500 bg-white/10 shadow-lg shadow-blue-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                          {th.name}
                        </span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        {th.desc}
                      </p>

                      {/* Mini preview bar */}
                      <div className={`p-2.5 rounded-lg ${th.bgPreview} border ${th.borderPreview} flex items-center gap-2`}>
                        <div className={`w-8 h-8 rounded ${th.cardPreview} border border-white/10 flex items-center justify-center`}>
                          <div className={`w-3 h-3 rounded-full ${th.accentPreview}`} />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="h-2 w-16 rounded bg-white/20" />
                          <div className="h-1.5 w-10 rounded bg-white/10" />
                        </div>
                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${th.accentPreview}`}>
                          Örnek
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300">
                ⌨️ <span className="font-semibold text-slate-100">Klavye Kısayolları:</span> Herhangi bir modal veya yazı kutusunda olmadığınızda bu tuşlara basarak hızlı aksiyon alabilirsiniz.
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-slate-100">Medya Ana Sayfası</span>
                    <p className="text-xs text-slate-400">Nerede olursanız olun Medya Ana Sayfasına götürür</p>
                  </div>
                  <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                    1
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-slate-100">Oyun Ana Sayfası</span>
                    <p className="text-xs text-slate-400">Nerede olursanız olun Oyun Ana Sayfasına götürür</p>
                  </div>
                  <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                    2
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-slate-100">İzlenen & Takip Listesi</span>
                    <p className="text-xs text-slate-400">İzlenen & Takip Listesi vitrinini açar</p>
                  </div>
                  <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                    3
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-slate-100">Akıllı ESC / Ayarlar</span>
                    <p className="text-xs text-slate-400">Pencere açıksa kapatır; ekranda açık pencere yoksa doğrudan Ayarlar'ı açar</p>
                  </div>
                  <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                    ESC
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-slate-100">Yeni Yapım Ekle (FAB)</span>
                    <p className="text-xs text-slate-400">Yeni dizi, film, anime veya oyun ekleme penceresini açar</p>
                  </div>
                  <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                    W
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-slate-100">Tam Ekran Aç / Kapat</span>
                    <p className="text-xs text-slate-400">Uygulamayı tam ekrana geçirir veya tam ekrandan çıkar</p>
                  </div>
                  <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                    SPACE
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-slate-100">Izgara / Tier List Görünüm Değiştir</span>
                    <p className="text-xs text-slate-400">Aktif kategoride tier list açıksa görünümler arasında geçiş yapar</p>
                  </div>
                  <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                    TAB
                  </kbd>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: STORAGE & FILE SYSTEM */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              {/* Directory Status Box */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Yerel Klasör Senkronizasyonu
                  </span>
                  {dirHandle ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle className="w-3.5 h-3.5" /> Bağlı: {dirHandle.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <AlertCircle className="w-3.5 h-3.5" /> Klasör Bağlı Değil
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {dirHandle
                    ? `Verileriniz bilgisayarınızdaki "${dirHandle.name}" klasörüne anlık olarak JSON ve görseller halinde yazılıyor.`
                    : 'Bilgisayarınızdan bir klasör seçerek yapımlarınızın ve afişlerinizin doğrudan sabit diskinizde saklanmasını sağlayabilirsiniz.'}
                </p>

                <div className="flex gap-2 pt-1">
                  {dirHandle ? (
                    <button
                      id="disconnect-dir-btn"
                      onClick={onDisconnectFolder}
                      className="py-2 px-3.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Klasör Bağlantısını Kes
                    </button>
                  ) : (
                    <button
                      id="connect-dir-btn"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                    >
                      <FolderSync className="w-4 h-4" />
                      {connecting ? 'Bağlanıyor...' : 'Klasör Seç & Bağla'}
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile HTML Export Box */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-slate-100">
                    Mobil / Telefon Görünümü HTML Çıktısı
                  </h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tüm arşivinizi, afişlerin gömülü olduğu tek bir bağımsız <code className="text-emerald-300">arsiv_mobil.html</code> dosyası olarak indirebilir, telefonunuza atıp internetsiz açabilirsiniz.
                </p>
                <button
                  id="download-phone-html-btn"
                  onClick={() => downloadPhoneHtml(appData)}
                  className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  arsiv_mobil.html İndir
                </button>
              </div>

              {/* JSON Backup / Restore */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-400" />
                  JSON Yedek Al / Geri Yükle
                </h4>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadJson}
                  accept=".json"
                  className="hidden"
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    id="download-json-backup-btn"
                    onClick={() => downloadJsonFile(appData)}
                    className="py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" /> JSON İndir
                  </button>

                  <button
                    id="upload-json-backup-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" /> JSON Yükle
                  </button>
                </div>
              </div>

              {/* Sample Data Reset / Reload */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  Örnek / Zengin Test Verilerini Yeniden Yükle
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  50 Medya (Anime, Dizi, Film, Belgesel) ve 50 Oyun (RPG, FPS, Metroidvania, Aksiyon, Strateji) içeren 100 yapımlık zengin arşivi yükler.
                </p>
                <button
                  id="reset-sample-data-btn"
                  onClick={() => {
                    if (window.confirm('Tüm yapımlar güncel 50 Medya ve 50 Oyun içeren 100 yapımlık zengin arşivle sıfırlanacak. Onaylıyor musunuz?')) {
                      onReplaceAllData(INITIAL_DATA);
                    }
                  }}
                  className="py-2 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  50 Medya + 50 Oyun Arşivini Yükle
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-black/30 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Yapım Arşivim • File System Access API
          </span>
          <button
            id="close-settings-footer-btn"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
