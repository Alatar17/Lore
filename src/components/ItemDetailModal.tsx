import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArchiveItem, Category, GameStatus } from '../types';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import { optimizeImageFile } from '../utils/imageOptimizer';
import { TagInputBox } from './TagInputBox';
import { getFieldScopedTags, getFieldScopedTagCounts } from '../utils/tagUtils';
import {
  X,
  Upload,
  Calendar,
  Star,
  Clock,
  Trophy,
  ClipboardPaste,
  Check,
  Tv,
  Bookmark,
  Sparkles,
  HelpCircle,
  Building2,
  Clapperboard,
  Users,
  Tags,
  Trash2,
  Save,
  PauseCircle,
} from 'lucide-react';

interface ItemDetailModalProps {
  item: ArchiveItem;
  categories: Category[];
  allItems?: ArchiveItem[];
  isReadOnly?: boolean;
  onSave: (updatedItem: ArchiveItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  categories,
  allItems = [],
  isReadOnly = false,
  onSave,
  onDelete,
  onClose,
}) => {
  // Ensure valid category and subgroup upon initialization
  const [formData, setFormData] = useState<ArchiveItem>(() => {
    let cat = item.cat;
    let sub = item.sub;
    const catObj = categories.find((c) => c.id === cat);
    if (!catObj && categories.length > 0) {
      cat = categories[0].id;
      sub = null;
    } else if (catObj) {
      if (sub && !catObj.subgroups.includes(sub)) {
        sub = null;
      }
    }
    return { ...item, cat, sub };
  });
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-sync category if categories list updates or current cat becomes invalid
  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === formData.cat)) {
      setFormData((prev) => ({
        ...prev,
        cat: categories[0].id,
        sub: null,
      }));
    }
  }, [categories, formData.cat]);

  const isGame = formData.mainTab === 'game';
  const selectedCatObj = categories.find((c) => c.id === formData.cat);
  const palette = isGame ? GAME_COLORS : MEDIA_COLORS;
  const baseColor = palette[formData.cat] || '#3b82f6';

  // Field-scoped tag lists and count maps
  const availableFirmTags = useMemo(
    () => getFieldScopedTags(allItems, 'media', 'firm'),
    [allItems]
  );
  const firmTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'media', 'firm'),
    [allItems]
  );

  const availableDirectorTags = useMemo(
    () => getFieldScopedTags(allItems, 'media', 'director'),
    [allItems]
  );
  const directorTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'media', 'director'),
    [allItems]
  );

  const availableActorsTags = useMemo(
    () => getFieldScopedTags(allItems, 'media', 'actors'),
    [allItems]
  );
  const actorsTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'media', 'actors'),
    [allItems]
  );

  const availableMediaGenreTags = useMemo(
    () => getFieldScopedTags(allItems, 'media', 'genre'),
    [allItems]
  );
  const mediaGenreTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'media', 'genre'),
    [allItems]
  );

  const availableDevTags = useMemo(
    () => getFieldScopedTags(allItems, 'game', 'developer'),
    [allItems]
  );
  const devTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'game', 'developer'),
    [allItems]
  );

  const availableGameGenreTags = useMemo(
    () => getFieldScopedTags(allItems, 'game', 'genre'),
    [allItems]
  );
  const gameGenreTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'game', 'genre'),
    [allItems]
  );

  const applyImageBase64 = async (rawInput: File | Blob | string, name?: string) => {
    try {
      const optimized = await optimizeImageFile(rawInput, 800, 1200, 0.88);
      setFormData((prev) => ({
        ...prev,
        thumbnail: optimized,
        thumbnailFileName: name || prev.thumbnailFileName || 'image.png',
      }));
      setPasteNotice('Resim güncellendi!');
      setTimeout(() => setPasteNotice(null), 2500);
    } catch {
      if (typeof rawInput === 'string') {
        setFormData((prev) => ({
          ...prev,
          thumbnail: rawInput,
          thumbnailFileName: name || prev.thumbnailFileName || 'image.png',
        }));
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyImageBase64(file, file.name);
  };

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
      console.warn('Clipboard error:', err);
      setPasteNotice('Panoya erişilemedi. Doğrudan Ctrl+V yapabilirsiniz.');
      setTimeout(() => setPasteNotice(null), 3000);
    }
  };

  // Global Ctrl+V Paste Listener
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
      className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="detail-modal-box"
        className="relative w-full max-w-2xl bg-[#131722] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="text-slate-300 font-semibold">{isGame ? '🎮 Oyun' : '🎬 Medya'}</span>
            <span>/</span>
            <span className="text-blue-300 font-semibold">{selectedCatObj?.name || 'Kategorisiz'}</span>
            {formData.sub && (
              <>
                <span>/</span>
                <span className="text-slate-200">{formData.sub}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Delete button (only on desktop/large screens or non-readonly) */}
            {!isReadOnly && (
              <button
                id="delete-item-btn"
                onClick={handleDelete}
                title="Yapımı Sil"
                className="hidden sm:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
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
        <form onSubmit={handleSaveForm} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* TOP SECTION: Left Compact Poster (with top-right X and bottom buttons) + Right Info & Notes */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Left: Compact Poster Column */}
            <div className="w-28 sm:w-32 shrink-0 mx-auto sm:mx-0 flex flex-col gap-1.5">
              <div
                className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-white/15 shadow-md flex items-center justify-center text-center group"
                style={{
                  backgroundColor: formData.thumbnail ? '#0b0e14' : `${baseColor}22`,
                  borderColor: formData.thumbnail ? 'rgba(255,255,255,0.15)' : `${baseColor}60`,
                }}
              >
                {formData.thumbnail ? (
                  <>
                    <img
                      src={formData.thumbnail}
                      alt={formData.title}
                      className="w-full h-full object-cover rounded-xl"
                    />
                    {/* Top-Right "X" icon to remove image */}
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      title="Resmi Kaldır"
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 hover:bg-red-600 text-white/80 hover:text-white shadow transition-all cursor-pointer z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <span
                    className="text-[11px] font-semibold px-2"
                    style={{ color: `${baseColor}ee` }}
                  >
                    {formData.title || 'Resim Yok'}
                  </span>
                )}
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />

              {/* Below Poster: Text + Icon Buttons (Yükle / Yapıştır) */}
              <div className="grid grid-cols-2 gap-1 w-full">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-slate-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Resim Dosyası Seç"
                >
                  <Upload className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>{formData.thumbnail ? 'Değiştir' : 'Yükle'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-[10px] font-semibold text-blue-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Panodaki resmi yapıştır (Ctrl+V)"
                >
                  <ClipboardPaste className="w-3 h-3 shrink-0" />
                  <span>Yapıştır</span>
                </button>
              </div>

              {pasteNotice && (
                <p className="text-[9px] text-emerald-400 text-center flex items-center justify-center gap-1">
                  <Check className="w-2.5 h-2.5" /> {pasteNotice}
                </p>
              )}
            </div>

            {/* Right: Main Fields + Notes */}
            <div className="flex-1 w-full space-y-2.5">
              {/* Title */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                  Başlık *
                </label>
                <input
                  id="detail-title-input"
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full bg-black/30 text-white font-semibold border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Category & Subgroup Selectors */}
              <div className={`grid gap-2 ${selectedCatObj?.subgroups.length ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
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
                    className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-neutral-400">(Kategorisiz / Havuz)</option>
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
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                      Alt-Grup
                    </label>
                    <select
                      id="detail-subgroup-select"
                      value={formData.sub || ''}
                      onChange={(e) => handleChange('sub', e.target.value || null)}
                      className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Puan (1-10)
                  </label>
                  <select
                    id="detail-rating-select"
                    value={formData.rating}
                    onChange={(e) => handleChange('rating', Number(e.target.value))}
                    className="w-full bg-black/30 text-amber-300 font-bold border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num} className="bg-slate-900 text-amber-300">
                        ★ {num} / 10
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-neutral-400" /> Tarih
                  </label>
                  <div className="flex items-center gap-1">
                    {formData.date === '??' || formData.date === '??.??' ? (
                      <div
                        className={`flex-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold flex items-center justify-between transition-opacity ${
                          isGame && formData.status === 'Oynanıyor'
                            ? 'bg-amber-500/5 text-amber-300/40 border border-amber-500/15 opacity-40 pointer-events-none'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        <span>Bilinmiyor (??)</span>
                      </div>
                    ) : (
                      <input
                        id="detail-date-input"
                        type="date"
                        value={formData.date}
                        disabled={isGame && formData.status === 'Oynanıyor'}
                        onChange={(e) => handleChange('date', e.target.value)}
                        className={`flex-1 border rounded-xl px-2 py-1.5 text-xs focus:outline-none transition-all ${
                          isGame && formData.status === 'Oynanıyor'
                            ? 'bg-black/50 text-neutral-500 border-white/5 opacity-40 cursor-not-allowed pointer-events-none select-none'
                            : 'bg-black/40 text-neutral-200 border-white/10 focus:border-neutral-400'
                        }`}
                      />
                    )}
                    <button
                      type="button"
                      id="toggle-unknown-date-btn"
                      disabled={isGame && formData.status === 'Oynanıyor'}
                      onClick={() => {
                        if (formData.date === '??' || formData.date === '??.??' || formData.date === '') {
                          handleChange('date', new Date().toISOString().split('T')[0]);
                        } else {
                          handleChange('date', '??');
                        }
                      }}
                      title="Tarih Bilinmiyor (??)"
                      className={`h-[30px] px-2 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center shrink-0 ${
                        isGame && formData.status === 'Oynanıyor'
                          ? 'opacity-40 cursor-not-allowed pointer-events-none bg-white/5 text-neutral-500 border-white/5'
                          : formData.date === '??' || formData.date === '??.??'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-pointer'
                          : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white hover:bg-white/10 cursor-pointer'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Description & Notes Area (Moved Up to Top Section next to Poster) */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                  Açıklama / Notlar
                </label>
                <textarea
                  id="detail-desc-textarea"
                  rows={3}
                  value={formData.desc}
                  onChange={(e) => handleChange('desc', e.target.value)}
                  placeholder="Yıllar sonra hatırlamak için notlar, hisler, önemli detaylar..."
                  className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl p-2.5 text-xs leading-relaxed focus:outline-none focus:border-blue-500 resize-y custom-scrollbar min-h-[82px]"
                />
              </div>
            </div>
          </div>

          {/* DIVIDER LINE */}
          <div className="border-t border-white/10 pt-1" />

          {/* MIDDLE SECTION: STATUS CONTROLS */}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              DURUM
            </label>
            {!isGame ? (
              /* Media Status Options (İzlenen, Takip, Yarım Bırakıldı, Anki) */
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="detail-watching-cb"
                    type="checkbox"
                    checked={!!formData.watching}
                    onChange={(e) => handleChange('watching', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <Tv className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-xs">İzlenen</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="detail-following-cb"
                    type="checkbox"
                    checked={!!formData.following}
                    onChange={(e) => handleChange('following', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs">Takip</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="detail-dropped-cb"
                    type="checkbox"
                    checked={!!formData.dropped}
                    onChange={(e) => handleChange('dropped', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-rose-500 focus:ring-0 cursor-pointer"
                  />
                  <PauseCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="text-xs">Yarım Bırakıldı</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="detail-anki-cb"
                    type="checkbox"
                    checked={!!formData.anki}
                    onChange={(e) => handleChange('anki', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs">Anki</span>
                </label>
              </div>
            ) : (
              /* Game Status Options */
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5 items-center">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                    Oyun Durumu
                  </label>
                  <select
                    id="detail-game-status-select"
                    value={formData.status || 'Oynanıyor'}
                    onChange={(e) => handleChange('status', e.target.value as GameStatus)}
                    className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Oynanıyor" className="bg-slate-900 text-white">🎮 Oynanıyor</option>
                    <option value="Tamamlandı" className="bg-slate-900 text-white">✅ Tamamlandı</option>
                    <option value="Yarım Bırakıldı" className="bg-slate-900 text-white">⏸ Yarım Bırakıldı</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
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
                      className="w-full bg-black/30 text-amber-300 font-semibold border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
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
                      className="w-14 bg-black/30 text-slate-300 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-center focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
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
                    className="w-full bg-black/30 text-sky-300 font-semibold border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
                    <input
                      id="detail-anki-game-cb"
                      type="checkbox"
                      checked={!!formData.anki}
                      onChange={(e) => handleChange('anki', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs">Anki'ye İşlendi</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Prominent Separator between Status and Field-Scoped Tags */}
          <div className="border-t-2 border-white/20 my-3" />

          {/* BOTTOM SECTION: FIELD-SCOPED TAGS (En Altta, Tam Genişlik) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Tags className="w-3.5 h-3.5 text-blue-400" />
              <span>Etiketler & Alanlar</span>
            </div>

            {!isGame ? (
              /* Media Tag Fields: Firma, Yönetmen, Oyuncular, Tür */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TagInputBox
                  label="Firma / Stüdyo"
                  placeholder="Örn: MAPPA, WIT Studio, Ufotable..."
                  tags={formData.firm || []}
                  onChange={(newTags) => handleChange('firm', newTags)}
                  availableTags={availableFirmTags}
                  tagCounts={firmTagCounts}
                  icon={<Building2 className="w-3 h-3 text-purple-400" />}
                />
                <TagInputBox
                  label="Yönetmen"
                  placeholder="Örn: Christopher Nolan, Miyazaki..."
                  tags={formData.director || []}
                  onChange={(newTags) => handleChange('director', newTags)}
                  availableTags={availableDirectorTags}
                  tagCounts={directorTagCounts}
                  icon={<Clapperboard className="w-3 h-3 text-amber-400" />}
                />
                <TagInputBox
                  label="Oyuncular / Seslendirme"
                  placeholder="Örn: Kenjiro Tsuda, Cillian Murphy..."
                  tags={formData.actors || []}
                  onChange={(newTags) => handleChange('actors', newTags)}
                  availableTags={availableActorsTags}
                  tagCounts={actorsTagCounts}
                  icon={<Users className="w-3 h-3 text-sky-400" />}
                />
                <TagInputBox
                  label="Tür"
                  placeholder="Örn: Aksiyon, Dram, Bilim Kurgu, Seinen..."
                  tags={formData.genre || []}
                  onChange={(newTags) => handleChange('genre', newTags)}
                  availableTags={availableMediaGenreTags}
                  tagCounts={mediaGenreTagCounts}
                  icon={<Tags className="w-3 h-3 text-emerald-400" />}
                />
              </div>
            ) : (
              /* Game Tag Fields: Geliştirici, Tür */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TagInputBox
                  label="Geliştirici / Stüdyo"
                  placeholder="Örn: FromSoftware, CD Projekt RED, Larian..."
                  tags={formData.developer || []}
                  onChange={(newTags) => handleChange('developer', newTags)}
                  availableTags={availableDevTags}
                  tagCounts={devTagCounts}
                  icon={<Building2 className="w-3 h-3 text-purple-400" />}
                />
                <TagInputBox
                  label="Tür"
                  placeholder="Örn: Souls-like, RPG, Açık Dünya, CRPG..."
                  tags={formData.genre || []}
                  onChange={(newTags) => handleChange('genre', newTags)}
                  availableTags={availableGameGenreTags}
                  tagCounts={gameGenreTagCounts}
                  icon={<Tags className="w-3 h-3 text-emerald-400" />}
                />
              </div>
            )}
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
