import React, { useState, useRef } from 'react';
import { AppData, Category, MainTabType, TierRow } from '../types';
import { createDefaultTierRows } from '../data/initialData';
import {
  downloadJsonFile,
  parseUploadedJson,
  downloadPhoneHtml,
} from '../utils/fileSystem';
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
  FolderOpen,
} from 'lucide-react';

interface SettingsModalProps {
  appData: AppData;
  activeMainTab: MainTabType;
  dirHandle: FileSystemDirectoryHandle | null;
  onConnectFolder: () => Promise<void>;
  onDisconnectFolder: () => void;
  onUpdateCategories: (mainTab: MainTabType, newCategories: Category[]) => void;
  onReplaceAllData: (newData: AppData) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  appData,
  activeMainTab,
  dirHandle,
  onConnectFolder,
  onDisconnectFolder,
  onUpdateCategories,
  onReplaceAllData,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'storage'>('categories');
  const [settingsMainTab, setSettingsMainTab] = useState<MainTabType>(activeMainTab);
  const [connecting, setConnecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cats = appData.categories[settingsMainTab] || [];

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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="settings-modal-box"
        className="relative w-full max-w-xl bg-[#1a1c22] border border-[#373d4d] rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2d3240] bg-[#15171d]">
          <h3 className="font-semibold text-base text-gray-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" />
            Ayarlar
          </h3>
          <button
            id="close-settings-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-[#2d3240] px-5 pt-2 gap-2 bg-[#15171d]">
          <button
            id="tab-btn-categories"
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-400 bg-[#1e2028]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Kategoriler
          </button>
          <button
            id="tab-btn-storage"
            onClick={() => setActiveTab('storage')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'storage'
                ? 'border-blue-500 text-blue-400 bg-[#1e2028]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" /> Veri & Dosya Sistemi
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {activeTab === 'categories' ? (
            <div>
              {/* Media / Game toggle in settings */}
              <div className="flex gap-2 mb-4 p-1 bg-[#131419] rounded-xl border border-[#2d3240] w-fit">
                <button
                  id="settings-media-tab-btn"
                  onClick={() => setSettingsMainTab('media')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    settingsMainTab === 'media'
                      ? 'bg-[#252a37] text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  🎬 Medya Kategorileri
                </button>
                <button
                  id="settings-game-tab-btn"
                  onClick={() => setSettingsMainTab('game')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    settingsMainTab === 'game'
                      ? 'bg-[#252a37] text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
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
                      className="p-3.5 rounded-xl bg-[#161820] border border-[#2d3240] space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Name + Item count */}
                        <div
                          onClick={() => handleRenameCategory(c.id, c.name)}
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <span className="font-semibold text-sm text-gray-100 group-hover:text-blue-400 transition-colors">
                            {c.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({itemCount} yapım)
                          </span>
                          <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            ✎ Adı Değiştir
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer select-none hover:text-white">
                            <input
                              type="checkbox"
                              checked={c.tierEnabled}
                              onChange={() => handleToggleTierList(c)}
                              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0"
                            />
                            <span>Tier List</span>
                          </label>

                          <button
                            id={`del-cat-${c.id}`}
                            onClick={() => handleDeleteCategory(c)}
                            title="Kategoriyi Sil"
                            className="p-1 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Subgroups chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#252834]">
                        <span className="text-[11px] text-gray-400 mr-1">
                          Alt-gruplar:
                        </span>
                        {c.subgroups.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#222632] border border-[#363c4d] text-xs text-gray-300"
                          >
                            <span>{s}</span>
                            <button
                              onClick={() => handleDeleteSubgroup(c.id, s)}
                              className="text-gray-400 hover:text-red-400 text-xs leading-none"
                              title="Alt-grubu kaldır"
                            >
                              ×
                            </button>
                          </span>
                        ))}

                        <button
                          id={`add-sub-${c.id}`}
                          onClick={() => handleAddSubgroup(c.id)}
                          className="px-2 py-0.5 rounded-md border border-dashed border-[#3e4659] text-gray-400 hover:text-blue-400 hover:border-blue-400 text-xs flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Alt-grup Ekle
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add category button */}
              <button
                id="add-new-category-btn"
                onClick={handleAddCategory}
                className="w-full mt-4 py-2.5 rounded-xl border border-dashed border-[#383e50] hover:border-blue-500 hover:bg-blue-500/5 text-gray-300 hover:text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" /> + Yeni Kategori Ekle
              </button>
            </div>
          ) : (
            /* Tab 2: Storage & File System Access */
            <div className="space-y-4">
              {/* File System Access Box */}
              <div className="p-4 rounded-xl bg-[#161820] border border-[#2d3240] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-100 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-amber-400" />
                      Yerel Klasör Bağlantısı (File System Access API)
                    </h4>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Kullanıcı bilgisayarındaki bir klasörü seçtiğinde veriler{' '}
                      <code className="text-amber-300">yapim-arsivim-data.json</code>{' '}
                      olarak kaydedilir ve yüklenen resimler o klasörde tutulur.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#111216] border border-[#262a35] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {dirHandle ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-emerald-300">
                          Bağlı Klasör: {dirHandle.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs text-gray-300">
                          Henüz yerel klasör bağlanmadı (Tarayıcı hafızasında saklanıyor)
                        </span>
                      </>
                    )}
                  </div>

                  {dirHandle ? (
                    <button
                      onClick={onDisconnectFolder}
                      className="px-2.5 py-1 rounded bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 text-red-300 text-xs font-medium transition-colors"
                    >
                      Bağlantıyı Kes
                    </button>
                  ) : (
                    <button
                      id="connect-dir-btn"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow"
                    >
                      <FolderSync className="w-3.5 h-3.5" />
                      <span>{connecting ? 'Seçiliyor...' : 'Klasör Seç'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Standalone Mobile HTML Export Box */}
              <div className="p-4 rounded-xl bg-[#161820] border border-[#2d3240] space-y-3">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm text-gray-100">
                      Telefon İçin Dışa Aktar (Tek Dosya HTML)
                    </h4>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Tüm verilerini ve görsellerini internet gerektirmeyen, tek bir{' '}
                      <code className="text-emerald-300">.html</code> dosyasına
                      paketler. Bu dosyayı LocalSend veya WhatsApp ile telefonuna atıp
                      Chrome'da doğrudan açabilirsin (Salt okunur mobil arayüz).
                    </p>
                  </div>
                </div>

                <button
                  id="export-phone-html-btn"
                  onClick={() => downloadPhoneHtml(appData)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow"
                >
                  <Smartphone className="w-4 h-4" /> Telefon İçin HTML İndir
                </button>
              </div>

              {/* JSON Backup & Restore */}
              <div className="p-4 rounded-xl bg-[#161820] border border-[#2d3240] space-y-3">
                <h4 className="font-semibold text-sm text-gray-100 flex items-center gap-2">
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
                    className="py-2 px-3 rounded-lg bg-[#242834] hover:bg-[#2e3342] border border-[#383e50] text-xs font-medium text-gray-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" /> JSON İndir
                  </button>

                  <button
                    id="upload-json-backup-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2 px-3 rounded-lg bg-[#242834] hover:bg-[#2e3342] border border-[#383e50] text-xs font-medium text-gray-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" /> JSON Yükle
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2d3240] bg-[#15171d] flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            Yapım Arşivim v1.0 • File System Access API
          </span>
          <button
            id="close-settings-footer-btn"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#282c37] hover:bg-[#323746] text-gray-200 text-xs font-medium transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
