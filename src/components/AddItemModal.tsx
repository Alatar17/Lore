import React, { useState, useRef, useEffect } from 'react';
import { ArchiveItem, Category, GameStatus, MainTabType } from '../types';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import { optimizeImageFile } from '../utils/imageOptimizer';
import {
  X,
  Upload,
  Plus,
  Calendar,
  Star,
  Clock,
  Trophy,
  ClipboardPaste,
  Check,
  Tv,
  Bookmark,
  Brain,
  HelpCircle,
  ImageIcon,
} from 'lucide-react';

interface AddItemModalProps {
  mainTab: MainTabType;
  categories: Category[];
  activeCatId: string | null;
  activeSub: string | null;
  onAdd: (newItem: ArchiveItem) => void;
  onClose: () => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  mainTab,
  categories,
  activeCatId,
  activeSub,
  onAdd,
  onClose,
}) => {
  const isGame = mainTab === 'game';
  const defaultCat =
    categories.find((c) => c.id === activeCatId) ||
    categories[0] || { id: 'genel', name: 'Genel', subgroups: [] };

  const [title, setTitle] = useState('');
  const [cat, setCat] = useState(defaultCat.id);
  const [sub, setSub] = useState<string | null>(activeSub || null);
  const [rating, setRating] = useState<number>(8);
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [desc, setDesc] = useState('');
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  // Media Specific
  const [watching, setWatching] = useState(false);
  const [following, setFollowing] = useState(false);

  // Game Specific
  const [status, setStatus] = useState<GameStatus>('Oynanıyor');
  const [achPercent, setAchPercent] = useState<number | null>(null);
  const [achMax, setAchMax] = useState<number>(100);
  const [hours, setHours] = useState<number>(0);

  // Common
  const [anki, setAnki] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedCatObj = categories.find((c) => c.id === cat);
  const palette = isGame ? GAME_COLORS : MEDIA_COLORS;
  const baseColor = palette[cat] || '#3b82f6';

  const applyImageBase64 = async (rawInput: File | Blob | string) => {
    try {
      const optimized = await optimizeImageFile(rawInput, 800, 1200, 0.88);
      setThumbnail(optimized);
      setPasteNotice('Resim başarıyla eklendi!');
      setTimeout(() => setPasteNotice(null), 2500);
    } catch {
      if (typeof rawInput === 'string') {
        setThumbnail(rawInput);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyImageBase64(file);
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
            await applyImageBase64(blob);
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
            applyImageBase64(file);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      window.alert('Lütfen bir başlık girin.');
      return;
    }

    const newItem: ArchiveItem = {
      id: `${mainTab}_${Date.now()}`,
      mainTab,
      title: title.trim(),
      cat,
      sub: sub || null,
      rating,
      date,
      desc: desc.trim(),
      thumbnail,
      watching: !isGame ? watching : undefined,
      following: !isGame ? following : undefined,
      status: isGame ? status : undefined,
      achPercent: isGame ? achPercent : undefined,
      achMax: isGame ? achMax : undefined,
      hours: isGame ? hours : undefined,
      anki,
      tier: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onAdd(newItem);
    onClose();
  };

  return (
    <div
      id="add-item-modal-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="add-item-modal-box"
        className="relative w-full max-w-2xl bg-[#131722] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="text-slate-300 font-semibold">{isGame ? '🎮 Yeni Oyun Ekle' : '🎬 Yeni Medya Ekle'}</span>
            <span>/</span>
            <span className="text-blue-300 font-semibold">{selectedCatObj?.name || cat}</span>
            {sub && (
              <>
                <span>/</span>
                <span className="text-slate-200">{sub}</span>
              </>
            )}
          </div>

          <button
            id="close-add-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: 2 Columns like ItemDetailModal */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          {/* Top Section: Poster + Main Info */}
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Poster column */}
            <div className="w-36 sm:w-44 shrink-0 mx-auto sm:mx-0 flex flex-col items-center gap-2">
              <div
                className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-white/15 shadow-md flex items-center justify-center text-center p-3"
                style={{
                  backgroundColor: thumbnail ? '#0b0e14' : `${baseColor}22`,
                  borderColor: thumbnail ? 'rgba(255,255,255,0.15)' : `${baseColor}60`,
                }}
              >
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt="Afiş Önizleme"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-neutral-400 p-2">
                    <ImageIcon className="w-8 h-8 opacity-40" />
                    <span className="text-[11px] font-medium leading-tight">
                      {title ? title : 'Afiş Önizleme'}
                    </span>
                  </div>
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
                    <span>{thumbnail ? 'Değiştir' : 'Afiş Yükle'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-[11px] font-medium text-blue-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Panodaki resmi yapıştır (Ctrl+V)"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                  </button>
                </div>

                {thumbnail && (
                  <button
                    type="button"
                    onClick={() => setThumbnail(undefined)}
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
                  id="add-title-input"
                  type="text"
                  required
                  placeholder={isGame ? 'Örn: Elden Ring' : 'Örn: Attack on Titan'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-black/30 text-white font-semibold border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* Category & Subgroup Selectors */}
              <div className={`grid gap-2.5 ${selectedCatObj?.subgroups.length ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Kategori
                  </label>
                  <select
                    id="add-category-select"
                    value={cat}
                    onChange={(e) => {
                      setCat(e.target.value);
                      setSub(null);
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

                {/* Subgroup Selector */}
                {selectedCatObj && selectedCatObj.subgroups.length > 0 && (
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                      Alt-Grup
                    </label>
                    <select
                      id="add-subgroup-select"
                      value={sub || ''}
                      onChange={(e) => setSub(e.target.value || null)}
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
                    id="add-rating-select"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
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
                  <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-neutral-400" /> Tarih
                  </label>
                  <div className="flex items-center gap-1.5">
                    {date === '??' || date === '??.??' ? (
                      <div className="flex-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl px-2.5 py-2 text-xs font-semibold flex items-center justify-between">
                        <span>Tarih Bilinmiyor (??)</span>
                      </div>
                    ) : (
                      <input
                        id="add-date-input"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="flex-1 bg-black/40 text-neutral-200 border border-white/10 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-neutral-400"
                      />
                    )}
                    <button
                      type="button"
                      id="toggle-add-unknown-date-btn"
                      onClick={() => {
                        if (date === '??' || date === '??.??' || date === '') {
                          setDate(new Date().toISOString().split('T')[0]);
                        } else {
                          setDate('??');
                        }
                      }}
                      title="Ne zaman izlediğimi / oynadığımı hatırlamıyorum (Tarih Bilinmiyor: ??)"
                      className={`h-[34px] px-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center cursor-pointer shrink-0 ${
                        date === '??' || date === '??.??'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Media Options */}
              {!isGame && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white">
                    <input
                      id="add-watching-cb"
                      type="checkbox"
                      checked={watching}
                      onChange={(e) => setWatching(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0 cursor-pointer"
                    />
                    <Tv className="w-3.5 h-3.5 text-cyan-400" />
                    <span>İzlenen listesinde (Aktif izleniyor)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white">
                    <input
                      id="add-following-cb"
                      type="checkbox"
                      checked={following}
                      onChange={(e) => setFollowing(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                    <span>Takip listesinde (Yeni sezon/bölüm bekleniyor)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white">
                    <input
                      id="add-anki-cb"
                      type="checkbox"
                      checked={anki}
                      onChange={(e) => setAnki(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <Brain className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Anki Destesine Eklendi</span>
                  </label>
                </div>
              )}

              {/* Game Options */}
              {isGame && (
                <div className="pt-2 border-t border-white/10 space-y-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                      Oyun Durumu
                    </label>
                    <select
                      id="add-game-status-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as GameStatus)}
                      className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="Oynanıyor">Oynanıyor</option>
                      <option value="Tamamlandı">Tamamlandı</option>
                      <option value="%100 Başarım">%100 Başarım</option>
                      <option value="Yarım Bırakıldı">Yarım Bırakıldı</option>
                      <option value="Oynanacak">Oynanacak</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" /> Saat
                      </label>
                      <input
                        id="add-hours-input"
                        type="number"
                        min="0"
                        placeholder="Örn: 45"
                        value={hours || ''}
                        onChange={(e) => setHours(Number(e.target.value))}
                        className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-amber-400" /> Başarım (%)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          id="add-ach-input"
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Örn: 85"
                          value={achPercent ?? ''}
                          onChange={(e) => setAchPercent(e.target.value ? Number(e.target.value) : null)}
                          className="flex-1 bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setAchPercent(100)}
                          title="%100 Başarım yap"
                          className="px-2 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-lg border border-amber-500/30 cursor-pointer"
                        >
                          %100
                        </button>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white pt-1">
                    <input
                      id="add-game-anki-cb"
                      type="checkbox"
                      checked={anki}
                      onChange={(e) => setAnki(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <Brain className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Anki Destesine Eklendi</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Description / Notes */}
          <div className="pt-2 border-t border-white/10">
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Açıklama / Kişisel Notlar
            </label>
            <textarea
              id="add-desc-textarea"
              rows={3}
              placeholder="Yapım hakkında notlarınız, incelemeniz veya hatırlatıcı detaylar..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-blue-500 custom-scrollbar resize-none"
            />
          </div>

          {/* Modal Footer / Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              İptal
            </button>
            <button
              id="submit-add-item-btn"
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Arşive Ekle</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
