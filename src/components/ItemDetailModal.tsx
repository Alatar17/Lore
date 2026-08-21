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
  CheckCircle2,
  Bookmark,
  Play,
  RotateCcw,
  Sparkles,
  ClipboardPaste,
  Check,
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
  const [formData, setFormData] = useState<ArchiveItem>({ ...item });
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGame = formData.mainTab === 'game';
  const palette = isGame ? GAME_COLORS : MEDIA_COLORS;
  const baseColor = palette[formData.cat] || '#3b82f6';
  const currentCategory = categories.find((c) => c.id === formData.cat);

  const applyImageBase64 = async (rawInput: File | Blob | string, fileName?: string) => {
    try {
      const optimized = await optimizeImageFile(rawInput, 800, 1200, 0.88);
      const updated = {
        ...formData,
        thumbnail: optimized,
        thumbnailFileName: fileName || `image_${Date.now()}.webp`,
      };
      setFormData(updated);
      onSave(updated);
      setPasteNotice('Resim başarıyla kaydedildi!');
      setTimeout(() => setPasteNotice(null), 2500);
    } catch {
      if (typeof rawInput === 'string') {
        const updated = {
          ...formData,
          thumbnail: rawInput,
          thumbnailFileName: fileName || `image_${Date.now()}.png`,
        };
        setFormData(updated);
        onSave(updated);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyImageBase64(file, file.name);
  };

  // Clipboard Paste Handler from Button (Navigator Clipboard API)
  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        // Fallback info
        window.alert('Lütfen Ctrl+V tuşlarına basarak doğrudan yapıştırın.');
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
        setPasteNotice('Panoda resim bulunamadı. Önce bir resmi kopyalayın.');
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
      // If the user is typing in a text input/textarea, only intercept if clipboard has image
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
  }, [formData]);

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
    const updated = { ...formData, thumbnail: undefined, thumbnailFileName: undefined };
    setFormData(updated);
    onSave(updated);
  };

  const handleChange = <K extends keyof ArchiveItem>(key: K, value: ArchiveItem[K]) => {
    const updated = { ...formData, [key]: value };
    setFormData(updated);
    onSave(updated);
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
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="detail-modal-box"
        className="relative w-full max-w-2xl bg-[#1e2027] border border-[#373d4d] rounded-2xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2d3240] bg-[#181a20]">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <span>{isGame ? '🎮 Oyun' : '🎬 Medya'}</span>
            <span>/</span>
            <span className="text-gray-200">{currentCategory?.name || formData.cat}</span>
            {formData.sub && (
              <>
                <span>/</span>
                <span className="text-blue-400">{formData.sub}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="delete-item-btn"
              onClick={handleDelete}
              title="Yapımı Sil"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              id="close-detail-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Top Section: Poster + Main Info */}
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Poster column */}
            <div className="w-36 sm:w-44 shrink-0 mx-auto sm:mx-0 flex flex-col items-center gap-2">
              <div
                className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-[#383e50] shadow-md flex items-center justify-center text-center p-3"
                style={{
                  backgroundColor: formData.thumbnail ? '#14151a' : `${baseColor}28`,
                  borderColor: formData.thumbnail ? '#383e50' : `${baseColor}60`,
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
                    id="upload-thumb-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#282c37] hover:bg-[#323746] border border-[#3e4556] text-[11px] font-medium text-gray-200 flex items-center justify-center gap-1 transition-colors"
                  >
                    <Upload className="w-3 h-3 text-blue-400" />
                    <span>{formData.thumbnail ? 'Dosya Seç' : 'Resim Seç'}</span>
                  </button>
                  {formData.thumbnail && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      title="Görseli Kaldır"
                      className="p-1.5 rounded-lg bg-[#282c37] hover:bg-red-900/30 border border-[#3e4556] text-gray-400 hover:text-red-400 text-[11px]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  id="paste-thumb-btn"
                  onClick={handlePasteFromClipboard}
                  className="w-full py-1.5 px-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-[11px] font-medium text-blue-300 flex items-center justify-center gap-1.5 transition-colors"
                  title="Panoya kopyalanmış resmi yapıştır (veya doğrudan Ctrl+V yapın)"
                >
                  <ClipboardPaste className="w-3 h-3 text-blue-400" />
                  <span>Panodan Yapıştır (Ctrl+V)</span>
                </button>
              </div>

              {pasteNotice && (
                <div className="w-full text-center text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded py-1 px-1.5 animate-fade-in flex items-center justify-center gap-1">
                  <Check className="w-2.5 h-2.5" />
                  <span>{pasteNotice}</span>
                </div>
              )}
            </div>

            {/* Info and Form Fields column */}
            <div className="flex-1 space-y-4">
              {/* Title input */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                  Başlık
                </label>
                <input
                  id="detail-title-input"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full bg-[#15171d] text-gray-100 font-semibold text-lg border border-[#353b4b] rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Category & Subgroup selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                    Kategori
                  </label>
                  <select
                    id="detail-category-select"
                    value={formData.cat}
                    onChange={(e) => {
                      const newCatId = e.target.value;
                      const newCat = categories.find((c) => c.id === newCatId);
                      setFormData({
                        ...formData,
                        cat: newCatId,
                        sub: newCat?.subgroups[0] || null,
                      });
                      onSave({
                        ...formData,
                        cat: newCatId,
                        sub: newCat?.subgroups[0] || null,
                      });
                    }}
                    className="w-full bg-[#15171d] text-gray-200 border border-[#353b4b] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subgroup */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                    Alt-Grup
                  </label>
                  <select
                    id="detail-subgroup-select"
                    value={formData.sub || ''}
                    disabled={!currentCategory?.subgroups.length}
                    onChange={(e) =>
                      handleChange('sub', e.target.value ? e.target.value : null)
                    }
                    className="w-full bg-[#15171d] text-gray-200 border border-[#353b4b] rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-40 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Yok / Genel</option>
                    {currentCategory?.subgroups.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rating & Date row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Rating (1-10 integer) */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1 flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Puan
                    (1-10)
                  </label>
                  <select
                    id="detail-rating-select"
                    value={formData.rating}
                    onChange={(e) => handleChange('rating', Number(e.target.value))}
                    className="w-full bg-[#15171d] text-amber-300 font-bold border border-[#353b4b] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num}>
                        ★ {num} / 10
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-400" /> Tarih
                  </label>
                  <input
                    id="detail-date-input"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleChange('date', e.target.value)}
                    className="w-full bg-[#15171d] text-gray-200 border border-[#353b4b] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Custom fields for Media */}
              {!isGame && (
                <div className="pt-2 border-t border-[#2d3240] space-y-2.5">
                  <label className="flex items-center gap-2.5 text-xs text-gray-200 cursor-pointer select-none hover:text-white">
                    <input
                      id="detail-watching-cb"
                      type="checkbox"
                      checked={!!formData.watching}
                      onChange={(e) => handleChange('watching', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0"
                    />
                    <span className="text-cyan-400">▶</span>
                    <span className="font-medium">İzlenen listesinde</span>
                    <span className="text-[11px] text-gray-400">
                      (Şu an aktif izlediğin yapımlar)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-gray-200 cursor-pointer select-none hover:text-white">
                    <input
                      id="detail-following-cb"
                      type="checkbox"
                      checked={!!formData.following}
                      onChange={(e) => handleChange('following', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-0"
                    />
                    <span className="text-amber-400">★</span>
                    <span className="font-medium">Takip listesinde</span>
                    <span className="text-[11px] text-gray-400">
                      (Bitti ama yeni sezon/bölüm bekleniyor)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-gray-200 cursor-pointer select-none hover:text-white">
                    <input
                      id="detail-anki-cb"
                      type="checkbox"
                      checked={!!formData.anki}
                      onChange={(e) => handleChange('anki', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-0"
                    />
                    <span className="text-emerald-400">🃏</span>
                    <span className="font-medium">Anki'ye işlendi</span>
                  </label>
                </div>
              )}

              {/* Custom fields for Game */}
              {isGame && (
                <div className="pt-2 border-t border-[#2d3240] space-y-3">
                  {/* Status Dropdown */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                      Durum
                    </label>
                    <select
                      id="detail-game-status-select"
                      value={formData.status || 'Oynanıyor'}
                      onChange={(e) =>
                        handleChange('status', e.target.value as GameStatus)
                      }
                      className="w-full bg-[#15171d] text-gray-200 border border-[#353b4b] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="Oynanıyor">🎮 Oynanıyor</option>
                      <option value="Tamamlandı">✅ Tamamlandı</option>
                      <option value="Yarım Bırakıldı">⏸ Yarım Bırakıldı</option>
                    </select>
                  </div>

                  {/* Achievements % + Max & Hours row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1 flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-emerald-400" /> Başarım % / Limit
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          id="detail-achpercent-input"
                          type="number"
                          min="0"
                          placeholder="--"
                          value={
                            formData.achPercent === null ||
                            formData.achPercent === undefined
                              ? ''
                              : formData.achPercent
                          }
                          onChange={(e) =>
                            handleChange(
                              'achPercent',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          className="w-16 bg-[#15171d] text-emerald-300 font-semibold border border-[#353b4b] rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-gray-400">/</span>
                        <input
                          id="detail-achmax-input"
                          type="number"
                          min="1"
                          title="Üst limit (varsayılan 100)"
                          value={formData.achMax ?? 100}
                          onChange={(e) =>
                            handleChange('achMax', Number(e.target.value) || 100)
                          }
                          className="w-16 bg-[#15171d] text-gray-300 border border-[#353b4b] rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1 flex items-center gap-1">
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
                        className="w-full bg-[#15171d] text-sky-300 font-semibold border border-[#353b4b] rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Anki for game */}
                  <label className="flex items-center gap-2.5 text-xs text-gray-200 cursor-pointer select-none hover:text-white">
                    <input
                      id="detail-anki-game-cb"
                      type="checkbox"
                      checked={!!formData.anki}
                      onChange={(e) => handleChange('anki', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-0"
                    />
                    <span className="text-emerald-400">🃏</span>
                    <span className="font-medium">Anki'ye işlendi</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Description & Notes Area */}
          <div className="pt-3 border-t border-[#2d3240]">
            <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
              Açıklama / Notlar
            </label>
            <textarea
              id="detail-desc-textarea"
              rows={4}
              value={formData.desc}
              onChange={(e) => handleChange('desc', e.target.value)}
              placeholder="Yıllar sonra hatırlamak için notlar, hisler, önemli detaylar..."
              className="w-full bg-[#15171d] text-gray-200 border border-[#353b4b] rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-blue-500 resize-y custom-scrollbar"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2d3240] bg-[#181a20]">
          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Değişiklikler otomatik kaydedilir
          </span>
          <button
            id="done-detail-btn"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
