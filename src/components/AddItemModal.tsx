import React, { useState, useRef, useEffect } from 'react';
import { ArchiveItem, Category, GameStatus, MainTabType } from '../types';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
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
    categories.find((c) => c.id === activeCatId) || categories[0] || { id: 'genel', name: 'Genel', subgroups: [] };

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

  // Media
  const [watching, setWatching] = useState(false);
  const [following, setFollowing] = useState(false);

  // Game
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

  const applyImageBase64 = (base64: string) => {
    setThumbnail(base64);
    setPasteNotice('Resim yapıştırıldı!');
    setTimeout(() => setPasteNotice(null), 2500);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      applyImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        window.alert('Lütfen Ctrl+V tuşlarına basarak doğrudan yapıştırın.');
        return;
      }
      const items = await navigator.clipboard.read();
      let foundImage = false;
      for (const clipboardItem of items) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            const reader = new FileReader();
            reader.onload = () => {
              applyImageBase64(reader.result as string);
            };
            reader.readAsDataURL(blob);
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
            const reader = new FileReader();
            reader.onload = () => {
              applyImageBase64(reader.result as string);
            };
            reader.readAsDataURL(file);
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
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="add-item-modal-box"
        className="relative w-full max-w-xl bg-[#1e2027] border border-[#373d4d] rounded-2xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2d3240] bg-[#181a20]">
          <h3 className="font-semibold text-sm text-gray-100 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400" />
            {isGame ? 'Yeni Oyun Ekle' : 'Yeni Medya Ekle'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Başlık *
            </label>
            <input
              id="add-title-input"
              type="text"
              required
              placeholder={isGame ? 'Örn: Elden Ring' : 'Örn: Attack on Titan'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#14151a] text-gray-100 border border-[#353a47] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Category & Subgroup */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Kategori
              </label>
              <select
                id="add-category-select"
                value={cat}
                onChange={(e) => {
                  setCat(e.target.value);
                  setSub(null);
                }}
                className="w-full bg-[#14151a] text-gray-200 border border-[#353a47] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Alt-Grup
              </label>
              <select
                id="add-subgroup-select"
                value={sub || ''}
                disabled={!selectedCatObj?.subgroups.length}
                onChange={(e) => setSub(e.target.value || null)}
                className="w-full bg-[#14151a] text-gray-200 border border-[#353a47] rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-40 focus:outline-none focus:border-blue-500"
              >
                <option value="">Yok / Genel</option>
                {selectedCatObj?.subgroups.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rating & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Puan (1-10)
              </label>
              <select
                id="add-rating-select"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full bg-[#14151a] text-amber-300 font-bold border border-[#353a47] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={num}>
                    ★ {num} / 10
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-blue-400" /> Tarih
              </label>
              <input
                id="add-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#14151a] text-gray-200 border border-[#353a47] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Thumbnail / Afiş (Opsiyonel)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="add-thumb-btn"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-[#282c37] hover:bg-[#323746] border border-[#3e4556] text-xs font-medium text-gray-200 flex items-center gap-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>{thumbnail ? 'Dosya Değiştir' : 'Bilgisayardan Dosya Seç'}</span>
              </button>

              <button
                type="button"
                id="add-paste-btn"
                onClick={handlePasteFromClipboard}
                className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-medium text-blue-300 flex items-center gap-1.5 transition-colors"
                title="Panoya kopyalanmış resmi yapıştır (veya doğrudan Ctrl+V yapın)"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-blue-400" />
                <span>Panodan Yapıştır (Ctrl+V)</span>
              </button>

              {thumbnail && (
                <button
                  type="button"
                  onClick={() => setThumbnail(undefined)}
                  className="text-xs text-red-400 hover:underline px-1"
                >
                  Kaldır
                </button>
              )}
            </div>

            {pasteNotice && (
              <p className="mt-1.5 text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> {pasteNotice}
              </p>
            )}

            {thumbnail && (
              <div className="mt-2 flex items-center gap-2">
                <div className="w-12 h-16 rounded border border-gray-700 overflow-hidden shrink-0">
                  <img src={thumbnail} alt="Önizleme" className="w-full h-full object-cover" />
                </div>
                <span className="text-[11px] text-gray-400">Resim seçildi / yapıştırıldı</span>
              </div>
            )}
          </div>

          {/* Media Specific Checkboxes */}
          {!isGame && (
            <div className="pt-2 border-t border-[#2d3240] space-y-2">
              <label className="flex items-center gap-2 text-xs text-gray-200 cursor-pointer select-none hover:text-white">
                <input
                  id="add-watching-cb"
                  type="checkbox"
                  checked={watching}
                  onChange={(e) => setWatching(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0"
                />
                <span className="text-cyan-400">▶</span>
                <span>İzlenen listesinde (Aktif izleniyor)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-gray-200 cursor-pointer select-none hover:text-white">
                <input
                  id="add-following-cb"
                  type="checkbox"
                  checked={following}
                  onChange={(e) => setFollowing(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-0"
                />
                <span className="text-amber-400">★</span>
                <span>Takip listesinde (Yeni sezon/bölüm bekleniyor)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-gray-200 cursor-pointer select-none hover:text-white">
                <input
                  id="add-anki-cb"
                  type="checkbox"
                  checked={anki}
                  onChange={(e) => setAnki(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-0"
                />
                <span className="text-emerald-400">🃏</span>
                <span>Anki'ye işlendi</span>
              </label>
            </div>
          )}

          {/* Game Specific Fields */}
          {isGame && (
            <div className="pt-2 border-t border-[#2d3240] space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Durum
                </label>
                <select
                  id="add-game-status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as GameStatus)}
                  className="w-full bg-[#14151a] text-gray-200 border border-[#353a47] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="Oynanıyor">🎮 Oynanıyor</option>
                  <option value="Tamamlandı">✅ Tamamlandı</option>
                  <option value="Yarım Bırakıldı">⏸ Yarım Bırakıldı</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-emerald-400" /> Başarım % / Limit
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="add-achpercent-input"
                      type="number"
                      min="0"
                      placeholder="--"
                      value={achPercent ?? ''}
                      onChange={(e) =>
                        setAchPercent(
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                      className="w-16 bg-[#14151a] text-emerald-300 font-semibold border border-[#353a47] rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-gray-400">/</span>
                    <input
                      id="add-achmax-input"
                      type="number"
                      min="1"
                      value={achMax}
                      onChange={(e) => setAchMax(Number(e.target.value) || 100)}
                      className="w-16 bg-[#14151a] text-gray-300 border border-[#353a47] rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-400" /> Oynanma (Saat)
                  </label>
                  <input
                    id="add-hours-input"
                    type="number"
                    min="0"
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value) || 0)}
                    className="w-full bg-[#14151a] text-sky-300 font-semibold border border-[#353a47] rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-200 cursor-pointer select-none hover:text-white">
                <input
                  id="add-anki-game-cb"
                  type="checkbox"
                  checked={anki}
                  onChange={(e) => setAnki(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-0"
                />
                <span className="text-emerald-400">🃏</span>
                <span>Anki'ye işlendi</span>
              </label>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Açıklama / Not
            </label>
            <textarea
              id="add-desc-textarea"
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Yıllar sonra hatırlamak için notlar..."
              className="w-full bg-[#14151a] text-gray-200 border border-[#353a47] rounded-lg p-2.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2d3240]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#282c37] hover:bg-[#323746] text-gray-300 text-xs font-medium transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              id="submit-add-btn"
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Ekle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
