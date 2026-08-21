import React, { useState, useRef, useEffect } from 'react';
import { ArchiveItem, Category, GameStatus, MainTabType } from '../types';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import { optimizeImageFile } from '../utils/imageOptimizer';
import {
  X,
  Upload,
  Trash2,
  Calendar,
  Star,
  Clock,
  Trophy,
  ClipboardPaste,
  Check,
  Save,
  Tv,
  Bookmark,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface ItemDetailModalProps {
  item: ArchiveItem;
  categories: Category[];
  onSave: (updatedItem: ArchiveItem) => void;
  onDelete: (itemId: string) => void;
  onClose: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  categories,
  onSave,
  onDelete,
  onClose,
}) => {
  // Local state for all fields - ONLY applied when "Kaydet" is clicked!
  const [formData, setFormData] = useState<ArchiveItem>({ ...item });
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGame = formData.mainTab === 'game';
  const palette = isGame ? GAME_COLORS : MEDIA_COLORS;
  const baseColor = palette[formData.cat] || '#3b82f6';
  const selectedCatObj = categories.find((c) => c.id === formData.cat);

  const applyImageBase64 = async (rawInput: File | Blob | string, fileName?: string) => {
    try {
      const optimized = await optimizeImageFile(rawInput, 800, 1200, 0.88);
      setFormData((prev) => ({
        ...prev,
        thumbnail: optimized,
        thumbnailFileName: fileName || `image_${Date.now()}.webp`,
      }));
      setPasteNotice('Resim seçildi (Kaydet ile uygulanır)');
      setTimeout(() => setPasteNotice(null), 2500);
    } catch {
      if (typeof rawInput === 'string') {
        setFormData((prev) => ({
          ...prev,
          thumbnail: rawInput,
          thumbnailFileName: fileName || `image_${Date.now()}.png`,
        }));
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyImageBase64(file, file.name);
  };

  // Clipboard Paste Handler from Button
  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        window.alert('Lütfen doğrudan Ctrl+V tuşlarına basarak yapıştırın.');
        return;
      }
      const items = await navigator.clipboard.read();
      let foundImage = false;
      for (const clipboardItem of items) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            await applyImageBase64(blob, 'clipboard-paste.png');
            foundImage = true;
            break;
          }
        }
        if (foundImage) break;
      }
      if (!foundImage) {
        setPasteNotice('Panoda resim bulunamadı.');
        setTimeout(() => setPasteNotice(null), 3000);
      }
    } catch (err) {
      console.warn('Clipboard API error:', err);
      setPasteNotice('Panoya erişilemedi. Doğrudan Ctrl+V yapabilirsiniz.');
      setTimeout(() => setPasteNotice(null), 3000);
    }
  };

  // Global Ctrl+V Paste Listener for the Modal Window
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            applyImageBase64(file, file.name || 'clipboard-paste.png');
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, []);

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

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, thumbnail: undefined, thumbnailFileName: undefined }));
  };

  const handleChange = <K extends keyof ArchiveItem>(key: K, value: ArchiveItem[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Save changes explicitly
  const handleSaveForm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.title.trim()) {
      window.alert('Başlık boş bırakılamaz.');
      return;
    }
    onSave({
      ...formData,
      updatedAt: Date.now(),
    });
  };

  const handleDelete = () => {
    if (window.confirm(`"${formData.title}" arşivden silinecek. Emin misiniz?`)) {
      onDelete(formData.id);
      onClose();
    }
  };

  return (
    <div
      id="detail-modal-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="detail-modal-box"
        className="relative w-full max-w-2xl bg-[#131722] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="text-slate-300 font-semibold">{isGame ? '🎮 Oyun' : '🎬 Medya'}</span>
            <span>/</span>
            <span className="text-blue-300 font-semibold">{selectedCatObj?.name || formData.cat}</span>
            {formData.sub && (
              <>
                <span>/</span>
                <span className="text-slate-200">{formData.sub}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="delete-item-btn"
              onClick={handleDelete}
              title="Yapımı Sil"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              id="close-detail-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSaveForm} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          {/* Top Section: Poster + Main Info */}
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Poster column */}
            <div className="w-36 sm:w-44 shrink-0 mx-auto sm:mx-0 flex flex-col items-center gap-2">
              <div
                className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-white/15 shadow-md flex items-center justify-center text-center p-3"
                style={{
                  backgroundColor: formData.thumbnail ? '#0b0e14' : `${baseColor}22`,
                  borderColor: formData.thumbnail ? 'rgba(255,255,255,0.15)' : `${baseColor}60`,
                }}
              >
                {formData.thumbnail ? (
                  <img
                    src={formData.thumbnail}
                    alt={formData.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    className="text-xs font-semibold px-2"
                    style={{ color: `${baseColor}ee` }}
                  >
                    {formData.title}
                  </span>
                )}
              </div>

              {/* Upload / Change thumbnail buttons */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3 h-3 text-blue-400" />
                    <span>{formData.thumbnail ? 'Değiştir' : 'Dosya Seç'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-[11px] font-medium text-blue-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Panodaki resmi yapıştır"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                  </button>
                </div>

                {formData.thumbnail && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="text-[11px] text-red-400 hover:underline text-center py-0.5 cursor-pointer"
                  >
                    Resmi Kaldır
                  </button>
                )}

                {pasteNotice && (
                  <p className="text-[10px] text-emerald-400 text-center flex items-center justify-center gap-1">
                    <Check className="w-3 h-3" /> {pasteNotice}
                  </p>
                )}
              </div>
            </div>

            {/* Main Form Fields */}
            <div className="flex-1 space-y-3.5">
              {/* Title */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Başlık *
                </label>
                <input
                  id="detail-title-input"
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full bg-black/30 text-white font-semibold border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Category & Subgroup Selectors */}
              <div className={`grid gap-2.5 ${selectedCatObj?.subgroups.length ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Kategori
                  </label>
                  <select
                    id="detail-category-select"
                    value={formData.cat}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        cat: newCat,
                        sub: null,
                      }));
                    }}
                    className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subgroup Selector - ONLY visible if category has subgroups */}
                {selectedCatObj && selectedCatObj.subgroups.length > 0 && (
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                      Alt-Grup
                    </label>
                    <select
                      id="detail-subgroup-select"
                      value={formData.sub || ''}
                      onChange={(e) => handleChange('sub', e.target.value || null)}
                      className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="" className="bg-slate-900 text-white">Yok / Genel</option>
                      {selectedCatObj.subgroups.map((s) => (
                        <option key={s} value={s} className="bg-slate-900 text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Rating & Date */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Puan (1-10)
                  </label>
                  <select
                    id="detail-rating-select"
                    value={formData.rating}
                    onChange={(e) => handleChange('rating', Number(e.target.value))}
                    className="w-full bg-black/30 text-amber-300 font-bold border border-white/10 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num} className="bg-slate-900 text-amber-300">
                        ★ {num} / 10
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-400" /> Tarih
                    </label>
                    <button
                      type="button"
                      id="toggle-unknown-date-btn"
                      onClick={() => {
                        if (formData.date === '??.??' || formData.date === '') {
                          handleChange('date', new Date().toISOString().split('T')[0]);
                        } else {
                          handleChange('date', '??.??');
                        }
                      }}
                      title="Ne zaman izlediğimi / oynadığımı hatırlamıyorum (Tarih Bilinmiyor: ??.??)"
                      className={`p-1 rounded-md border text-[11px] transition-all flex items-center justify-center cursor-pointer ${
                        formData.date === '??.??'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                          : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {formData.date === '??.??' ? (
                    <div className="w-full bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl px-2.5 py-1.5 text-xs font-semibold flex items-center justify-between">
                      <span>Tarih Bilinmiyor (??.??)</span>
                    </div>
                  ) : (
                    <input
                      id="detail-date-input"
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleChange('date', e.target.value)}
                      className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              </div>

              {/* Media Options */}
              {!isGame && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white">
                    <input
                      id="detail-watching-cb"
                      type="checkbox"
                      checked={!!formData.watching}
                      onChange={(e) => handleChange('watching', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0 cursor-pointer"
                    />
                    <Tv className="w-3.5 h-3.5 text-cyan-400" />
                    <span>İzlenen listesinde (Aktif izleniyor)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white">
                    <input
                      id="detail-following-cb"
                      type="checkbox"
                      checked={!!formData.following}
                      onChange={(e) => handleChange('following', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                    <span>Takip listesinde (Yeni sezon/bölüm bekleniyor)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white">
                    <input
                      id="detail-anki-cb"
                      type="checkbox"
                      checked={!!formData.anki}
                      onChange={(e) => handleChange('anki', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Anki'ye işlendi</span>
                  </label>
                </div>
              )}

              {/* Game Options */}
              {isGame && (
                <div className="pt-2 border-t border-white/10 space-y-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                      Durum
                    </label>
                    <select
                      id="detail-game-status-select"
                      value={formData.status || 'Oynanıyor'}
                      onChange={(e) => handleChange('status', e.target.value as GameStatus)}
                      className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="Oynanıyor" className="bg-slate-900 text-white">🎮 Oynanıyor</option>
                      <option value="Tamamlandı" className="bg-slate-900 text-white">✅ Tamamlandı</option>
                      <option value="Yarım Bırakıldı" className="bg-slate-900 text-white">⏸ Yarım Bırakıldı</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-amber-400" /> Başarım (%)
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          id="detail-ach-input"
                          type="number"
                          min="0"
                          max={formData.achMax || 100}
                          placeholder="0"
                          value={formData.achPercent ?? ''}
                          onChange={(e) =>
                            handleChange(
                              'achPercent',
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          className="w-full bg-black/30 text-amber-300 font-semibold border border-white/10 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-slate-400 text-xs">/</span>
                        <input
                          type="number"
                          min="1"
                          title="Üst limit"
                          value={formData.achMax ?? 100}
                          onChange={(e) =>
                            handleChange('achMax', Number(e.target.value) || 100)
                          }
                          className="w-16 bg-black/30 text-slate-300 border border-white/10 rounded-xl px-2 py-1 text-xs text-center focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-sky-400" /> Oynanma (Saat)
                      </label>
                      <input
                        id="detail-hours-input"
                        type="number"
                        min="0"
                        value={formData.hours ?? 0}
                        onChange={(e) =>
                          handleChange('hours', Number(e.target.value) || 0)
                        }
                        className="w-full bg-black/30 text-sky-300 font-semibold border border-white/10 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Anki for game */}
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white">
                    <input
                      id="detail-anki-game-cb"
                      type="checkbox"
                      checked={!!formData.anki}
                      onChange={(e) => handleChange('anki', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Anki'ye işlendi</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Description & Notes Area */}
          <div className="pt-2 border-t border-white/10">
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
              Açıklama / Notlar
            </label>
            <textarea
              id="detail-desc-textarea"
              rows={3}
              value={formData.desc}
              onChange={(e) => handleChange('desc', e.target.value)}
              placeholder="Yıllar sonra hatırlamak için notlar, hisler, önemli detaylar..."
              className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-blue-500 resize-y custom-scrollbar"
            />
          </div>
        </form>

        {/* Footer with Explicit Action Buttons */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-white/10 bg-black/40">
          <button
            id="save-detail-form-btn"
            type="button"
            onClick={() => handleSaveForm()}
            className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Kaydet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
