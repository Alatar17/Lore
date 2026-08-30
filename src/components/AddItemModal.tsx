import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArchiveItem, Category, GameStatus, MainTabType } from '../types';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import { optimizeImageFile } from '../utils/imageOptimizer';
import { TagInputBox } from './TagInputBox';
import { getFieldScopedTags, getFieldScopedTagCounts } from '../utils/tagUtils';
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
  Sparkles,
  HelpCircle,
  Building2,
  Clapperboard,
  Users,
  Tags,
  PauseCircle,
  Megaphone,
} from 'lucide-react';

interface AddItemModalProps {
  mainTab: MainTabType;
  categories: Category[];
  activeCatId: string | null;
  activeSub: string | null;
  allItems?: ArchiveItem[];
  onAdd: (newItem: ArchiveItem) => void;
  onClose: () => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  mainTab,
  categories,
  activeCatId,
  activeSub,
  allItems = [],
  onAdd,
  onClose,
}) => {
  const isGame = mainTab === 'game';
  const defaultCat =
    categories.find((c) => c.id === activeCatId) ||
    categories[0] || { id: 'genel', name: 'Genel', subgroups: [] };

  const validDefaultSub =
    activeSub && defaultCat.subgroups?.includes(activeSub) ? activeSub : null;

  const [title, setTitle] = useState('');
  const [cat, setCat] = useState(defaultCat.id);
  const [sub, setSub] = useState<string | null>(validDefaultSub);
  const [rating, setRating] = useState<number>(8);
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [desc, setDesc] = useState('');
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  // Field-Scoped Tags state
  const [firm, setFirm] = useState<string[]>([]);
  const [director, setDirector] = useState<string[]>([]);
  const [actors, setActors] = useState<string[]>([]);
  const [developer, setDeveloper] = useState<string[]>([]);
  const [genre, setGenre] = useState<string[]>([]);

  // Available field-scoped tags and count maps for autocomplete
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

  // Media Specific
  const [watching, setWatching] = useState(false);
  const [following, setFollowing] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [expectedDate, setExpectedDate] = useState('');
  const [followNotes, setFollowNotes] = useState('');
  const [showFollowDetails, setShowFollowDetails] = useState(false);

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
      window.alert('Lütfen yapım başlığı girin.');
      return;
    }

    const newItem: ArchiveItem = {
      id: `${mainTab}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      mainTab,
      cat,
      sub: sub || null,
      title: title.trim(),
      rating,
      date: date || '??',
      desc: desc.trim(),
      thumbnail,
      // Media tags
      firm: !isGame && firm.length > 0 ? firm : undefined,
      director: !isGame && director.length > 0 ? director : undefined,
      actors: !isGame && actors.length > 0 ? actors : undefined,
      // Game tags
      developer: isGame && developer.length > 0 ? developer : undefined,
      // Common tags
      genre: genre.length > 0 ? genre : undefined,
      // Media flags
      watching: !isGame ? watching : undefined,
      following: !isGame ? following : undefined,
      dropped: !isGame ? dropped : undefined,
      expectedDate: !isGame && expectedDate.trim() ? expectedDate.trim() : undefined,
      followNotes: !isGame && followNotes.trim() ? followNotes.trim() : undefined,
      // Game flags
      status: isGame ? status : undefined,
      achPercent: isGame ? achPercent : undefined,
      achMax: isGame ? achMax : undefined,
      hours: isGame ? hours : undefined,
      // Common
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
      id="add-modal-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="add-modal-box"
        className="relative w-full max-w-2xl bg-[#131722] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/40">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="p-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Plus className="w-3.5 h-3.5" />
            </span>
            <span>Yeni {isGame ? 'Oyun' : 'Medya'} Ekle</span>
          </h2>
          <button
            id="close-add-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* TOP SECTION: Left Compact Poster (with top-right X and bottom buttons) + Right Info & Notes */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Left: Compact Poster Column */}
            <div className="w-28 sm:w-32 shrink-0 mx-auto sm:mx-0 flex flex-col gap-1.5">
              <div
                className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-white/15 shadow-md flex items-center justify-center text-center group"
                style={{
                  backgroundColor: thumbnail ? '#0b0e14' : `${baseColor}22`,
                  borderColor: thumbnail ? 'rgba(255,255,255,0.15)' : `${baseColor}60`,
                }}
              >
                {thumbnail ? (
                  <>
                    <img
                      src={thumbnail}
                      alt={title || 'Kapak Resmi'}
                      className="w-full h-full object-cover rounded-xl"
                    />
                    {/* Top-Right "X" icon to remove image */}
                    <button
                      type="button"
                      onClick={() => setThumbnail(undefined)}
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
                    {title || 'Resim Yok'}
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
                  <span>{thumbnail ? 'Değiştir' : 'Yükle'}</span>
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
                  id="add-title-input"
                  type="text"
                  required
                  placeholder={isGame ? 'Örn: Elden Ring' : 'Örn: Vinland Saga'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                    id="add-category-select"
                    value={cat}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      setCat(newCat);
                      setSub(null);
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
                      id="add-subgroup-select"
                      value={sub || ''}
                      onChange={(e) => setSub(e.target.value || null)}
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
                    id="add-rating-select"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
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
                    {date === '??' || date === '??.??' ? (
                      <div
                        className={`flex-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold flex items-center justify-between transition-opacity ${
                          isGame && status === 'Oynanıyor'
                            ? 'bg-amber-500/5 text-amber-300/40 border border-amber-500/15 opacity-40 pointer-events-none'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        <span>Bilinmiyor (??)</span>
                      </div>
                    ) : (
                      <input
                        id="add-date-input"
                        type="date"
                        value={date}
                        disabled={isGame && status === 'Oynanıyor'}
                        onChange={(e) => setDate(e.target.value)}
                        className={`flex-1 border rounded-xl px-2 py-1.5 text-xs focus:outline-none transition-all ${
                          isGame && status === 'Oynanıyor'
                            ? 'bg-black/50 text-neutral-500 border-white/5 opacity-40 cursor-not-allowed pointer-events-none select-none'
                            : 'bg-black/40 text-neutral-200 border-white/10 focus:border-neutral-400'
                        }`}
                      />
                    )}
                    <button
                      type="button"
                      id="toggle-add-unknown-date-btn"
                      disabled={isGame && status === 'Oynanıyor'}
                      onClick={() => {
                        if (date === '??' || date === '??.??' || date === '') {
                          setDate(new Date().toISOString().split('T')[0]);
                        } else {
                          setDate('??');
                        }
                      }}
                      title="Tarih Bilinmiyor (??)"
                      className={`h-[30px] px-2 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center shrink-0 ${
                        isGame && status === 'Oynanıyor'
                          ? 'opacity-40 cursor-not-allowed pointer-events-none bg-white/5 text-neutral-500 border-white/5'
                          : date === '??' || date === '??.??'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-pointer'
                          : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white hover:bg-white/10 cursor-pointer'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Description & Notes Area (Top Section next to Poster) */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                  Açıklama / Notlar
                </label>
                <textarea
                  id="add-desc-textarea"
                  rows={3}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
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
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="add-watching-cb"
                    type="checkbox"
                    checked={watching}
                    onChange={(e) => setWatching(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <Tv className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-xs">İzlenen</span>
                </label>

                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="add-following-cb"
                    type="checkbox"
                    checked={following}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFollowing(checked);
                      if (checked) {
                        setShowFollowDetails(true);
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs">Takip</span>
                  {following && (
                    <button
                      type="button"
                      id="btn-toggle-add-follow-details"
                      title={showFollowDetails ? 'Gelişme kutusunu gizle' : 'Takip ve çıkış bilgilerini düzenle'}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowFollowDetails(!showFollowDetails);
                      }}
                      className={`ml-auto p-1 rounded-md transition-colors cursor-pointer ${
                        showFollowDetails
                          ? 'text-sky-400 bg-sky-500/20'
                          : 'text-slate-400 hover:text-sky-300 hover:bg-white/10'
                      }`}
                    >
                      <Megaphone className="w-3 h-3" />
                    </button>
                  )}
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="add-dropped-cb"
                    type="checkbox"
                    checked={dropped}
                    onChange={(e) => setDropped(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-rose-500 focus:ring-0 cursor-pointer"
                  />
                  <PauseCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="text-xs">Yarım Bırakıldı</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="add-anki-cb"
                    type="checkbox"
                    checked={anki}
                    onChange={(e) => setAnki(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs">Anki</span>
                </label>
              </div>

              {/* Takip Listesi Gelişmeleri & Beklenen Tarih Kutusu (Takip aktifken ve butona tıklandığında açılır, bilgiler asla silinmez) */}
              {following && showFollowDetails && (
                <div
                  id="add-follow-info-box"
                  className="mt-2.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                      <Megaphone className="w-3.5 h-3.5 text-sky-400" />
                      <span>Takip Notları & Beklenen Çıkış Tarihi</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFollowDetails(false)}
                      className="text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Gizle
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-sky-400" /> Beklenen Dönem
                      </label>
                      <input
                        id="add-expected-date-input"
                        type="text"
                        value={expectedDate}
                        onChange={(e) => setExpectedDate(e.target.value)}
                        placeholder="Örn: 2027 başı, 2026 Güz, TBA..."
                        className="w-full bg-black/40 text-slate-100 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-400/60 transition-colors placeholder:text-neutral-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Gelişme Notu / Açıklama
                      </label>
                      <textarea
                        id="add-follow-notes-input"
                        rows={4}
                        value={followNotes}
                        onChange={(e) => setFollowNotes(e.target.value)}
                        placeholder="Örn: 3. sezon duyuruldu, stüdyo değişti, prodüksiyon başladı..."
                        className="w-full bg-black/40 text-slate-100 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-400/60 transition-colors resize-y placeholder:text-neutral-500 custom-scrollbar min-h-[85px]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
            ) : (
              /* Game Status Options */
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5 items-center">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                    Oyun Durumu
                  </label>
                  <select
                    id="add-game-status-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as GameStatus)}
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
                      id="add-ach-input"
                      type="number"
                      min="0"
                      max={achMax}
                      placeholder="0"
                      value={achPercent ?? ''}
                      onChange={(e) =>
                        setAchPercent(
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
                      value={achMax}
                      onChange={(e) => setAchMax(Number(e.target.value) || 100)}
                      className="w-14 bg-black/30 text-slate-300 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-center focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-400" /> Oynanma (Saat)
                  </label>
                  <input
                    id="add-hours-input"
                    type="number"
                    min="0"
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value) || 0)}
                    className="w-full bg-black/30 text-sky-300 font-semibold border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
                    <input
                      id="add-anki-game-cb"
                      type="checkbox"
                      checked={anki}
                      onChange={(e) => setAnki(e.target.checked)}
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
                  tags={firm}
                  onChange={setFirm}
                  availableTags={availableFirmTags}
                  tagCounts={firmTagCounts}
                  icon={<Building2 className="w-3 h-3 text-purple-400" />}
                />
                <TagInputBox
                  label="Yönetmen"
                  placeholder="Örn: Christopher Nolan, Miyazaki..."
                  tags={director}
                  onChange={setDirector}
                  availableTags={availableDirectorTags}
                  tagCounts={directorTagCounts}
                  icon={<Clapperboard className="w-3 h-3 text-amber-400" />}
                />
                <TagInputBox
                  label="Oyuncular / Seslendirme"
                  placeholder="Örn: Kenjiro Tsuda, Cillian Murphy..."
                  tags={actors}
                  onChange={setActors}
                  availableTags={availableActorsTags}
                  tagCounts={actorsTagCounts}
                  icon={<Users className="w-3 h-3 text-sky-400" />}
                />
                <TagInputBox
                  label="Tür"
                  placeholder="Örn: Aksiyon, Dram, Bilim Kurgu, Seinen..."
                  tags={genre}
                  onChange={setGenre}
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
                  tags={developer}
                  onChange={setDeveloper}
                  availableTags={availableDevTags}
                  tagCounts={devTagCounts}
                  icon={<Building2 className="w-3 h-3 text-purple-400" />}
                />
                <TagInputBox
                  label="Tür"
                  placeholder="Örn: Souls-like, RPG, Açık Dünya, CRPG..."
                  tags={genre}
                  onChange={setGenre}
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
            id="save-add-form-btn"
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Kütüphaneye Ekle</span>
          </button>
        </div>
      </div>
    </div>
  );
};
