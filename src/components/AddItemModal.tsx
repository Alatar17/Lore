import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArchiveItem, Category, GameStatus, MainTabType, ItemCharacter } from '../types';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import { optimizeImageFile } from '../utils/imageOptimizer';
import { TagInputBox } from './TagInputBox';
import { getFieldScopedTags, getFieldScopedTagCounts } from '../utils/tagUtils';
import {
  X,
  Upload,
  Plus,
  Calendar,
  CalendarRange,
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
  Trash2,
  Image as ImageIcon,
  Layers,
  Info,
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
    isGame ? '' : new Date().toISOString().split('T')[0]
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

  // Takip kutularında (Beklenen Dönem veya Gelişme Notu) veri olup olmadığını kontrol eder
  const hasFollowData = !!(
    (expectedDate && expectedDate.trim().length > 0) ||
    (followNotes && followNotes.trim().length > 0)
  );

  // Additional New Fields (Release Year & Range)
  const [isYearRange, setIsYearRange] = useState(false);
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [characters, setCharacters] = useState<ItemCharacter[]>([]);

  // Series / Franchise (Bağlantılı Yapımlar)
  const [seriesName, setSeriesName] = useState('');
  const [seriesOrder, setSeriesOrder] = useState<string>('');
  const [showFranchiseTooltip, setShowFranchiseTooltip] = useState(false);

  // Series name suggestions for autocomplete
  const availableSeriesNames = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((i) => {
      if (i.seriesName && i.seriesName.trim()) {
        set.add(i.seriesName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [allItems]);

  // Actor Autocomplete Suggestions
  const allActorSuggestions = useMemo(() => {
    const set = new Set<string>();
    availableActorsTags.forEach((a) => {
      if (a && a.trim()) set.add(a.trim());
    });
    allItems.forEach((it) => {
      it.characters?.forEach((c) => {
        if (c.actor && c.actor.trim()) set.add(c.actor.trim());
      });
      it.actors?.forEach((a) => {
        if (a && a.trim()) set.add(a.trim());
      });
    });
    actors.forEach((a) => {
      if (a && a.trim()) set.add(a.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [availableActorsTags, allItems, actors]);

  const handleAddCharacter = () => {
    setCharacters((prev) => [...prev, { name: '', actor: '' }]);
  };

  const handleUpdateCharacter = (
    index: number,
    field: 'name' | 'actor' | 'image',
    value?: string
  ) => {
    setCharacters((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handlePasteCharacterImage = async (index: number) => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        setPasteNotice('Lütfen klavyeden Ctrl+V tuşlarına basarak yapıştırın.');
        setTimeout(() => setPasteNotice(null), 3000);
        return;
      }
      const items = await navigator.clipboard.read();
      let foundImage = false;
      for (const clipboardItem of items) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            const optimized = await optimizeImageFile(blob, 1200, 1600, 0.95);
            handleUpdateCharacter(index, 'image', optimized);
            foundImage = true;
            break;
          }
        }
        if (foundImage) break;
      }
      if (!foundImage) {
        setPasteNotice('Panoda kopyalanmış görsel bulunamadı.');
        setTimeout(() => setPasteNotice(null), 2500);
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
      setPasteNotice('Panodan okuma başarısız veya izin verilmedi.');
      setTimeout(() => setPasteNotice(null), 2500);
    }
  };

  const handleRemoveCharacter = (index: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
  };

  // Mutually exclusive toggle for media statuses
  const handleMediaStatusToggle = (type: 'watching' | 'following' | 'dropped') => {
    if (type === 'watching') {
      const next = !watching;
      setWatching(next);
      if (next) {
        setFollowing(false);
        setDropped(false);
        setDate('');
      }
    } else if (type === 'following') {
      const next = !following;
      setFollowing(next);
      if (next) {
        setWatching(false);
        setDropped(false);
        setShowFollowDetails(true);
        setDate('');
      }
    } else if (type === 'dropped') {
      const next = !dropped;
      setDropped(next);
      if (next) {
        setWatching(false);
        setFollowing(false);
      }
    }
  };

  // Game Specific
  const [status, setStatus] = useState<GameStatus>('Oynanıyor');
  const [achPercent, setAchPercent] = useState<number | null>(null);
  const [achMax, setAchMax] = useState<number>(100);
  const [hours, setHours] = useState<number>(0);

  const isDateDisabled = isGame
    ? status === 'Oynanıyor' || status === 'Oynanacak'
    : (watching || following);

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

  // Not: Escape tuşu ile kazara pencereyi kapatıp verilerin kaybolmasını engellemek için listener kaldırılmıştır.

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      window.alert('Lütfen yapım başlığı girin.');
      return;
    }

    const cleanedCharacters = characters
      .map((c) => ({
        name: c.name.trim(),
        actor: c.actor?.trim() || undefined,
        image: c.image || undefined,
      }))
      .filter((c) => c.name.length > 0);

    let computedReleaseYear: number | string | undefined = undefined;
    if (isYearRange) {
      const s = startYear.trim();
      const e = endYear.trim();
      if (s && e) {
        computedReleaseYear = `${s}–${e}`;
      } else if (s) {
        computedReleaseYear = `${s}–`;
      } else if (e) {
        computedReleaseYear = e;
      }
    } else {
      const s = startYear.trim();
      if (s) {
        computedReleaseYear = !isNaN(Number(s)) ? Number(s) : s;
      }
    }

    const newItem: ArchiveItem = {
      id: `${mainTab}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      mainTab,
      cat,
      sub: sub || null,
      title: title.trim(),
      rating,
      date: isDateDisabled ? '' : (date || '??'),
      releaseYear: computedReleaseYear,
      desc: desc.trim(),
      thumbnail,
      characters: cleanedCharacters.length > 0 ? cleanedCharacters : undefined,
      seriesName: seriesName.trim() || undefined,
      seriesOrder: seriesOrder !== '' && !isNaN(Number(seriesOrder)) ? Number(seriesOrder) : undefined,
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
                      <option value="" className="bg-slate-900 text-white">Yok</option>
                      {selectedCatObj.subgroups.map((s) => (
                        <option key={s} value={s} className="bg-slate-900 text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Rating, Release Year & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-start min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-1 h-5 mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 truncate">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                      <span>Puan (1-10)</span>
                    </label>
                  </div>
                  <select
                    id="add-rating-select"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full h-8 bg-black/30 text-amber-300 font-bold border border-white/10 rounded-xl px-2.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num} className="bg-slate-900 text-amber-300">
                        ★ {num} / 10
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 h-5 mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 truncate">
                      <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span>Yapım Yılı</span>
                    </label>
                    <button
                      type="button"
                      id="toggle-add-release-year-range-btn"
                      onClick={() => {
                        const next = !isYearRange;
                        setIsYearRange(next);
                        if (!next && !startYear && endYear) {
                          setStartYear(endYear);
                          setEndYear('');
                        }
                      }}
                      title={isYearRange ? 'Tek Yıl Moduna Dön' : 'Yıl Aralığı Modu'}
                      className={`p-0.5 rounded transition-colors cursor-pointer flex items-center justify-center ${
                        isYearRange
                          ? 'bg-blue-500/25 text-blue-400 border border-blue-500/40'
                          : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                      }`}
                    >
                      <CalendarRange className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                  </div>

                  {!isYearRange ? (
                    <input
                      id="add-release-year-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="Örn: 2024"
                      value={startYear}
                      onChange={(e) => setStartYear(e.target.value)}
                      className="w-full h-8 bg-black/30 text-slate-200 font-medium border border-white/10 rounded-xl px-2.5 text-xs focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    <div className="flex items-center gap-1 min-w-0">
                      <input
                        id="add-release-year-start"
                        type="text"
                        inputMode="numeric"
                        placeholder="Başlangıç"
                        value={startYear}
                        onChange={(e) => setStartYear(e.target.value)}
                        className="w-full min-w-0 h-8 bg-black/30 text-slate-200 font-medium border border-white/10 rounded-xl px-1.5 text-xs text-center focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-slate-500 font-bold text-xs shrink-0">—</span>
                      <input
                        id="add-release-year-end"
                        type="text"
                        placeholder="Bitiş"
                        value={endYear}
                        onChange={(e) => setEndYear(e.target.value)}
                        className="w-full min-w-0 h-8 bg-black/30 text-slate-200 font-medium border border-white/10 rounded-xl px-1.5 text-xs text-center focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1 h-5 mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 truncate">
                      <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span>{isGame ? 'Tamamlama Tarihi' : 'İzlenme Tarihi'}</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    {date === '??' || date === '??.??' ? (
                      <div
                        className={`flex-1 min-w-0 h-8 rounded-xl px-2.5 text-xs font-semibold flex items-center justify-between transition-opacity ${
                          isDateDisabled
                            ? 'bg-amber-500/5 text-amber-300/40 border border-amber-500/15 opacity-40 pointer-events-none select-none'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        <span className="truncate">{isDateDisabled ? 'Devam Ediyor (Kilitli)' : 'Bilinmiyor (??)'}</span>
                      </div>
                    ) : (
                      <input
                        id="add-date-input"
                        type={isDateDisabled ? 'text' : 'date'}
                        value={isDateDisabled ? '' : date}
                        disabled={isDateDisabled}
                        onChange={(e) => setDate(e.target.value)}
                        placeholder={isDateDisabled ? (isGame ? 'Oynanıyor (Kilitli)' : 'İzleniyor (Kilitli)') : ''}
                        className={`flex-1 min-w-0 h-8 border rounded-xl px-2 text-xs focus:outline-none transition-all ${
                          isDateDisabled
                            ? 'bg-black/50 text-neutral-500 border-white/5 opacity-50 cursor-not-allowed pointer-events-none select-none placeholder:text-neutral-500 placeholder:italic'
                            : 'bg-black/40 text-neutral-200 border-white/10 focus:border-neutral-400'
                        }`}
                      />
                    )}
                    <button
                      type="button"
                      id="toggle-add-unknown-date-btn"
                      disabled={isDateDisabled}
                      onClick={() => {
                        if (date === '??' || date === '??.??' || date === '') {
                          setDate(new Date().toISOString().split('T')[0]);
                        } else {
                          setDate('??');
                        }
                      }}
                      title={isDateDisabled ? 'Yapım tamamlanmadığı için tarih kilitlidir' : 'Tarih Bilinmiyor (??)'}
                      className={`h-8 w-8 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center shrink-0 ${
                        isDateDisabled
                          ? 'opacity-30 cursor-not-allowed pointer-events-none bg-white/5 text-neutral-500 border-white/5'
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
                  KONUSU
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
                    onChange={() => handleMediaStatusToggle('watching')}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <Tv className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-xs">İzleniyor...</span>
                </label>

                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="add-following-cb"
                    type="checkbox"
                    checked={following}
                    onChange={() => handleMediaStatusToggle('following')}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs">Takip</span>
                  {following && (
                    <button
                      type="button"
                      id="btn-toggle-add-follow-details"
                      title={
                        hasFollowData
                          ? showFollowDetails
                            ? 'Gelişme kutusunu gizle (Not/tarih mevcut)'
                            : 'Takip ve çıkış bilgilerini düzenle (Not/tarih mevcut)'
                          : showFollowDetails
                          ? 'Gelişme kutusunu gizle'
                          : 'Takip ve çıkış bilgilerini düzenle'
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowFollowDetails(!showFollowDetails);
                      }}
                      className={`ml-auto p-1 rounded-md transition-colors cursor-pointer border ${
                        hasFollowData
                          ? 'text-sky-400 bg-sky-500/20 hover:bg-sky-500/30 border-sky-500/40 shadow-xs'
                          : showFollowDetails
                          ? 'text-slate-200 bg-white/15 hover:bg-white/20 border-white/10'
                          : 'text-slate-400 hover:text-white hover:bg-white/10 border-transparent'
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
                    onChange={() => handleMediaStatusToggle('dropped')}
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
                    onChange={(e) => {
                      const next = e.target.value as GameStatus;
                      setStatus(next);
                      if (next === 'Oynanıyor' || next === 'Oynanacak') {
                        setDate('');
                      }
                    }}
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
                    onFocus={(e) => e.target.select()}
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

          {/* Prominent Separator between Tags and Characters */}
          <div className="border-t-2 border-white/20 my-4" />

          {/* KARAKTERLER & KADRO */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span>Karakterler & Kadro</span>
              </div>
              <button
                type="button"
                id="btn-add-char-row-add-modal"
                onClick={handleAddCharacter}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-semibold text-xs border border-sky-500/30 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Karakter Ekle</span>
              </button>
            </div>

            {/* Global Actor Autocomplete Datalist */}
            <datalist id="add-actor-autocomplete-list">
              {allActorSuggestions.map((act) => (
                <option key={act} value={act} />
              ))}
            </datalist>

            {/* Character Rows List */}
            {characters.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">
                Henüz eklenmiş bir karakter bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                {characters.map((char, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 group hover:border-white/20 transition-all"
                  >
                    {/* Karakter Görseli Seçici / Önizleme / Panodan Yapıştırma */}
                    <div className="relative shrink-0 flex items-center justify-center">
                      <input
                        type="file"
                        accept="image/*"
                        id={`add-char-img-${index}`}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const optimized = await optimizeImageFile(file, 1200, 1600, 0.95);
                              handleUpdateCharacter(index, 'image', optimized);
                            } catch (err) {
                              console.error(err);
                            }
                          }
                        }}
                      />
                      {char.image ? (
                        <div className="relative group/cavatar w-9 h-9 rounded-lg overflow-hidden border border-white/25 bg-black/50 shadow shrink-0">
                          <img
                            src={char.image}
                            alt={char.name || 'Karakter'}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateCharacter(index, 'image', undefined)}
                            title="Resmi Kaldır (Sil)"
                            className="absolute inset-0 bg-black/80 opacity-0 group-hover/cavatar:opacity-100 flex items-center justify-center text-rose-400 hover:text-rose-200 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <label
                            htmlFor={`add-char-img-${index}`}
                            title="PC'den Karakter Görseli Seç"
                            className="w-9 h-9 rounded-lg border border-dashed border-white/20 hover:border-sky-400/60 bg-black/30 hover:bg-sky-500/10 flex items-center justify-center text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </label>
                          <button
                            type="button"
                            onClick={() => handlePasteCharacterImage(index)}
                            title="Panodan Görsel Yapıştır (Kopyalanan Resmi Ekle)"
                            className="w-9 h-9 rounded-lg border border-dashed border-white/20 hover:border-emerald-400/60 bg-black/30 hover:bg-emerald-500/10 flex items-center justify-center text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
                          >
                            <ClipboardPaste className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Karakter İsmi (örn: Yuta Okkotsu)"
                        value={char.name}
                        onChange={(e) =>
                          handleUpdateCharacter(index, 'name', e.target.value)
                        }
                        className="w-full bg-black/40 text-slate-200 placeholder-slate-500 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-slate-500 text-xs hidden sm:inline">🎙️</span>
                      <input
                        type="text"
                        list="add-actor-autocomplete-list"
                        placeholder="Seslendiren / Oyuncu (örn: Kana Hanazawa)"
                        value={char.actor || ''}
                        onChange={(e) =>
                          handleUpdateCharacter(index, 'actor', e.target.value)
                        }
                        className="w-full bg-black/40 text-sky-300 placeholder-slate-500 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCharacter(index)}
                      title="Karakteri Sil"
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors self-end sm:self-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prominent Separator between Characters and Series */}
          <div className="border-t-2 border-white/20 my-4" />

          {/* SERİ / EVREN BİLGİSİ (Karakterler & Kadro Altında) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Seri / Evren Bağlantısı</span>
              <div className="relative inline-flex items-center group/ftip">
                <button
                  type="button"
                  onClick={() => setShowFranchiseTooltip(!showFranchiseTooltip)}
                  className="p-0.5 text-slate-400 hover:text-indigo-300 rounded transition-colors cursor-pointer"
                  title="Bilgi"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <div
                  className={`absolute left-6 top-1/2 -translate-y-1/2 z-50 w-64 p-2.5 rounded-xl bg-slate-900/95 border border-indigo-500/30 text-[11px] text-slate-200 font-normal leading-relaxed shadow-xl backdrop-blur-md transition-opacity pointer-events-none ${
                    showFranchiseTooltip ? 'opacity-100' : 'opacity-0 group-hover/ftip:opacity-100'
                  }`}
                >
                  Aynı evrene veya seriye ait yapımları (örn: film, anime, dizi, oyun) birbirine bağlamak için ortak bir seri adı belirleyin.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Seri / Evren Adı
                </label>
                <input
                  id="add-series-name-input"
                  type="text"
                  list="add-series-name-suggestions"
                  value={seriesName}
                  onChange={(e) => setSeriesName(e.target.value)}
                  placeholder="Örn: Jujutsu Kaisen, Harry Potter, Witcher..."
                  className="w-full bg-black/40 text-slate-100 border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-400 transition-colors placeholder:text-neutral-500"
                />
                <datalist id="add-series-name-suggestions">
                  {availableSeriesNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  İzleme / Seri Sırası
                </label>
                <input
                  id="add-series-order-input"
                  type="number"
                  step="any"
                  min="0"
                  value={seriesOrder}
                  onChange={(e) => setSeriesOrder(e.target.value)}
                  placeholder="Örn: 1, 2, 3..."
                  className="w-full bg-black/40 text-indigo-300 font-semibold border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-400 transition-colors placeholder:text-neutral-500"
                />
              </div>
            </div>
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
