import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ArchiveItem, MainTabType } from '../types';
import {
  X,
  Film,
  Gamepad2,
  BookOpen,
  Trophy,
  Clock,
  Tv,
  Bookmark,
  Building2,
  Clapperboard,
  Users,
  Tags,
  CheckCircle2,
  TrendingUp,
  Calendar,
  PauseCircle,
  Play,
  BookMarked,
  FileText,
  ChevronDown,
  Check,
} from 'lucide-react';

interface StatisticsModalProps {
  items: ArchiveItem[];
  categories?: Record<string, any[]>;
  initialTab?: MainTabType;
  onClose: () => void;
}

export const StatisticsModal: React.FC<StatisticsModalProps> = ({
  items = [],
  initialTab = 'media',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<MainTabType>(initialTab);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  // Close year dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        yearDropdownRef.current &&
        !yearDropdownRef.current.contains(e.target as Node)
      ) {
        setIsYearDropdownOpen(false);
      }
    };
    if (isYearDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isYearDropdownOpen]);

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

  // Extract all unique years present in items
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    items.forEach((item) => {
      if (item.date && item.date !== '??' && item.date !== '??.??') {
        const match = item.date.match(/^(\d{4})/);
        if (match && match[1]) {
          yearsSet.add(match[1]);
        }
      }
    });
    return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
  }, [items]);

  // Filter items for current tab AND selected year
  const tabItems = useMemo(() => {
    return items.filter((item) => {
      if (item.mainTab !== activeTab) return false;
      if (selectedYear !== 'all') {
        return item.date && item.date.startsWith(selectedYear);
      }
      return true;
    });
  }, [items, activeTab, selectedYear]);

  const isGame = activeTab === 'game';
  const isBook = activeTab === 'book';

  // 1. Core Summary Metrics
  const totalCount = tabItems.length;

  // Media Specific Summary
  const watchingCount = useMemo(
    () => tabItems.filter((i) => i.watching).length,
    [tabItems]
  );
  const followingCount = useMemo(
    () => tabItems.filter((i) => i.following).length,
    [tabItems]
  );
  const droppedMediaCount = useMemo(
    () => tabItems.filter((i) => i.dropped).length,
    [tabItems]
  );

  // Book Specific Summary
  const readingCount = useMemo(
    () => tabItems.filter((i) => i.reading).length,
    [tabItems]
  );
  const droppedBookCount = useMemo(
    () => tabItems.filter((i) => i.dropped).length,
    [tabItems]
  );
  const totalPagesRead = useMemo(() => {
    return tabItems.reduce((acc, curr) => acc + (curr.pageCount || 0), 0);
  }, [tabItems]);

  // Game Specific Summary
  const totalHours = useMemo(() => {
    return tabItems.reduce((acc, curr) => acc + (curr.hours || 0), 0);
  }, [tabItems]);

  const completedGamesCount = useMemo(
    () => tabItems.filter((i) => i.status === 'Tamamlandı').length,
    [tabItems]
  );

  const playingGamesCount = useMemo(
    () => tabItems.filter((i) => i.status === 'Oynanıyor').length,
    [tabItems]
  );

  const droppedGamesCount = useMemo(
    () => tabItems.filter((i) => i.status === 'Yarım Bırakıldı').length,
    [tabItems]
  );

  // 2. Helper to aggregate top tags with item count
  const getTopTagsWithStats = (field: keyof ArchiveItem, limit: number = 8) => {
    const statsMap = new Map<string, { count: number; totalScore: number }>();
    tabItems.forEach((item) => {
      const tags = item[field] as string[] | undefined;
      if (Array.isArray(tags)) {
        tags.forEach((tag) => {
          const trimmed = tag.trim();
          if (trimmed) {
            const current = statsMap.get(trimmed) || { count: 0, totalScore: 0 };
            statsMap.set(trimmed, {
              count: current.count + 1,
              totalScore: current.totalScore + (item.rating || 0),
            });
          }
        });
      }
    });

    return Array.from(statsMap.entries())
      .map(([name, stat]) => ({
        name,
        count: stat.count,
        avgScore: (stat.totalScore / stat.count).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count || Number(b.avgScore) - Number(a.avgScore))
      .slice(0, limit);
  };

  const topGenres = useMemo(() => getTopTagsWithStats('genre', 8), [tabItems]);
  const topFirms = useMemo(() => getTopTagsWithStats('firm', 6), [tabItems]);
  const topDevelopers = useMemo(() => getTopTagsWithStats('developer', 6), [tabItems]);
  const topAuthors = useMemo(() => getTopTagsWithStats('author', 6), [tabItems]);
  const topDirectors = useMemo(() => getTopTagsWithStats('director', 5), [tabItems]);
  const topActors = useMemo(() => getTopTagsWithStats('actors', 5), [tabItems]);

  const maxGenreCount = topGenres.length > 0 ? Math.max(...topGenres.map((g) => g.count)) : 1;

  return (
    <div
      id="statistics-modal-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="statistics-modal-box"
        className="relative w-full max-w-4xl bg-[#12151f] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col h-[900px] max-h-[96vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Centered Media/Game Switcher, Right: Year Selector & Close */}
        <div className="flex items-center justify-between px-2 sm:px-6 py-2 sm:py-3.5 border-b border-white/10 bg-black/40 gap-1 sm:gap-4">
          {/* Left spacing to balance right side on desktop */}
          <div className="w-28 hidden sm:block shrink-0" />

          {/* Centered Media / Game / Book Switcher */}
          <div className="flex p-0.5 bg-neutral-900 rounded-xl border border-white/15 shrink-0 sm:mx-auto">
            <button
              id="stats-tab-media-btn"
              onClick={() => setActiveTab('media')}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'media'
                  ? 'bg-neutral-800 text-white shadow-sm border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
              }`}
            >
              <Film className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-neutral-300" />
              <span>Medya</span>
            </button>
            <button
              id="stats-tab-game-btn"
              onClick={() => setActiveTab('game')}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'game'
                  ? 'bg-neutral-800 text-white shadow-sm border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
              }`}
            >
              <Gamepad2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-neutral-300" />
              <span>Oyun</span>
            </button>
            <button
              id="stats-tab-book-btn"
              onClick={() => setActiveTab('book')}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'book'
                  ? 'bg-neutral-800 text-white shadow-sm border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
              }`}
            >
              <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-neutral-300" />
              <span>Kitap</span>
            </button>
          </div>

          {/* Right Controls: Year Filter Dropdown + Close Button */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0 ml-auto sm:ml-0">
            {/* Custom Theme-Matched Year Dropdown */}
            <div ref={yearDropdownRef} className="relative">
              <button
                type="button"
                id="stats-year-select"
                onClick={() => setIsYearDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-[11px] sm:text-xs font-semibold text-slate-200 cursor-pointer"
                title="Yıl Seç"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                {/* Mobile text: Tümü veya 2026 */}
                <span className="sm:hidden">
                  {selectedYear === 'all' ? 'Tümü' : selectedYear}
                </span>
                {/* Desktop text: Tüm Yıllar veya 2026 Yılı */}
                <span className="hidden sm:inline">
                  {selectedYear === 'all' ? 'Tüm Yıllar' : `${selectedYear} Yılı`}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-0.5" />
              </button>

              {isYearDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 min-w-[130px] sm:min-w-[140px] py-1 bg-[#181b22] border border-white/15 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear('all');
                      setIsYearDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedYear === 'all'
                        ? 'bg-blue-600/20 text-blue-300 font-bold'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <span>Tüm Yıllar</span>
                    {selectedYear === 'all' && (
                      <Check className="w-3.5 h-3.5 text-blue-400" />
                    )}
                  </button>

                  {availableYears.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setSelectedYear(yr);
                        setIsYearDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        selectedYear === yr
                          ? 'bg-blue-600/20 text-blue-300 font-bold'
                        : 'text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      <span>{yr} Yılı</span>
                      {selectedYear === yr && (
                        <Check className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              id="close-stats-btn"
              onClick={onClose}
              className="p-1 sm:p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Kapat"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body - Fixed Height Container for layout stability */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6 min-h-[520px]">
          {/* 1. TOP SUMMARY CARDS */}
          {isBook ? (
            /* Book Top 4 Cards */
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* Total Books */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {selectedYear === 'all' ? 'Toplam Kitap' : `${selectedYear} Kitabı`}
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-white">{totalCount}</span>
                  <span className="text-xs text-slate-400">kitap</span>
                </div>
              </div>

              {/* Reading (Şu An Okunuyor) */}
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col justify-between">
                <span className="text-xs text-cyan-300 font-medium flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Şu An Okunuyor
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-cyan-300">{readingCount}</span>
                  <span className="text-xs text-cyan-400/80">kitap</span>
                </div>
              </div>

              {/* Dropped Books (Yarım Bırakılan) */}
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 flex flex-col justify-between">
                <span className="text-xs text-rose-300 font-bold flex items-center gap-1">
                  <PauseCircle className="w-3.5 h-3.5 text-rose-400" /> Yarım Bırakılan
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-rose-400">{droppedBookCount}</span>
                  <span className="text-xs text-rose-400/80">kitap</span>
                </div>
              </div>

              {/* Total Pages Read */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
                <span className="text-xs text-emerald-300 font-medium flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" /> Toplam Sayfa
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-300">{totalPagesRead.toLocaleString('tr-TR')}</span>
                  <span className="text-xs text-emerald-400/80">sayfa</span>
                </div>
              </div>
            </div>
          ) : !isGame ? (
            /* Media Top 4 Cards */
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* Total Media */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {selectedYear === 'all' ? 'Toplam Yapım' : `${selectedYear} Yapımı`}
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-white">{totalCount}</span>
                  <span className="text-xs text-slate-400">öğe</span>
                </div>
              </div>

              {/* Watching */}
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col justify-between">
                <span className="text-xs text-cyan-300 font-medium flex items-center gap-1">
                  <Tv className="w-3.5 h-3.5 text-cyan-400" /> Aktif İzlenen
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-cyan-300">{watchingCount}</span>
                  <span className="text-xs text-cyan-400/80">yapım</span>
                </div>
              </div>

              {/* Following */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between">
                <span className="text-xs text-amber-300 font-medium flex items-center gap-1">
                  <Bookmark className="w-3.5 h-3.5 text-amber-400" /> Takip Edilen
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-amber-300">{followingCount}</span>
                  <span className="text-xs text-amber-400/80">yapım</span>
                </div>
              </div>

              {/* Dropped Media (Yarım Bırakılan) */}
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 flex flex-col justify-between">
                <span className="text-xs text-rose-300 font-bold flex items-center gap-1">
                  <PauseCircle className="w-3.5 h-3.5 text-rose-400" /> Yarım Bırakılan
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-rose-400">{droppedMediaCount}</span>
                  <span className="text-xs text-rose-400/80">yapım</span>
                </div>
              </div>
            </div>
          ) : (
            /* Game Top 4 Cards: [Toplam Oyun] - [Tamamlanan] - [Yarım Bırakılan] - [Toplam Oynama Süresi] */
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* Total Games */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {selectedYear === 'all' ? 'Toplam Oyun' : `${selectedYear} Oyunu`}
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-white">{totalCount}</span>
                  <span className="text-xs text-slate-400">oyun</span>
                </div>
              </div>

              {/* Completed Games */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
                <span className="text-xs text-emerald-300 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Tamamlanan
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-300">{completedGamesCount}</span>
                  <span className="text-xs text-emerald-400/80">oyun</span>
                </div>
              </div>

              {/* Dropped Games (Yarım Bırakılan) */}
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 flex flex-col justify-between">
                <span className="text-xs text-rose-300 font-bold flex items-center gap-1">
                  <PauseCircle className="w-3.5 h-3.5 text-rose-400" /> Yarım Bırakılan
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-rose-400">{droppedGamesCount}</span>
                  <span className="text-xs text-rose-400/80">oyun</span>
                </div>
              </div>

              {/* Total Playtime (Toplam Süre) */}
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 flex flex-col justify-between">
                <span className="text-xs text-sky-300 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-sky-400" /> Toplam Süre
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-sky-300">{totalHours}</span>
                  <span className="text-xs text-sky-400/80">Saat Oynandı</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. FIELD-SCOPED TAGS: TOP GENRES & TOP STUDIOS / AUTHORS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Genres - Score ratings removed, only count & bar */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tags className="w-3.5 h-3.5 text-blue-400" />
                  En Çok Tercih Edilen Türler
                </span>
                <span className="text-[10px] text-slate-500">Yapım Adedi</span>
              </h3>

              {topGenres.length > 0 ? (
                <div className="space-y-2.5 pt-1">
                  {topGenres.map((g) => (
                    <div key={g.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200">{g.name}</span>
                        <span className="text-slate-400 font-semibold">{g.count} yapım</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                          style={{ width: `${(g.count / maxGenreCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  Henüz tür etiketi bulunmuyor.
                </p>
              )}
            </div>

            {/* Top Studios / Developers / Authors */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  {isBook
                    ? 'En Çok Okunan Yazarlar'
                    : isGame
                    ? 'En Çok Oynanan Geliştiriciler'
                    : 'En Çok İzlenen Firma / Stüdyolar'}
                </span>
                <span className="text-[10px] text-slate-500">Adet / Ort. Puan</span>
              </h3>

              {(isBook ? topAuthors : !isGame ? topFirms : topDevelopers).length > 0 ? (
                <div className="space-y-2 pt-1">
                  {(isBook ? topAuthors : !isGame ? topFirms : topDevelopers).map((st) => (
                    <div
                      key={st.name}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 text-xs hover:border-white/15 transition-all"
                    >
                      <span className="font-semibold text-slate-200">{st.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-medium">
                          {st.count} {isBook ? 'kitap' : 'yapım'}
                        </span>
                        <span className="text-amber-300 font-bold">★ {st.avgScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  {isBook
                    ? 'Henüz yazar etiketi bulunmuyor.'
                    : isGame
                    ? 'Henüz geliştirici etiketi bulunmuyor.'
                    : 'Henüz firma/stüdyo etiketi bulunmuyor.'}
                </p>
              )}
            </div>
          </div>

          {/* 4. MEDIA SPECIFIC: DIRECTORS & ACTORS */}
          {!isGame && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Directors */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <h3 className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clapperboard className="w-3.5 h-3.5 text-amber-400" />
                    Öne Çıkan Yönetmenler
                  </span>
                  <span className="text-[10px] text-slate-500">Adet / Ort. Puan</span>
                </h3>
                {topDirectors.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {topDirectors.map((d) => (
                      <div
                        key={d.name}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs"
                      >
                        <span className="text-slate-200 font-medium">{d.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-semibold">{d.count} yapım</span>
                          <span className="text-amber-300 font-bold">★ {d.avgScore}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-2 text-center">
                    Henüz yönetmen etiketi bulunmuyor.
                  </p>
                )}
              </div>

              {/* Top Actors */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <h3 className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    Öne Çıkan Oyuncular & Seslendirme
                  </span>
                  <span className="text-[10px] text-slate-500">Adet / Ort. Puan</span>
                </h3>
                {topActors.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {topActors.map((a) => (
                      <div
                        key={a.name}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs"
                      >
                        <span className="text-slate-200 font-medium">{a.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-semibold">{a.count} yapım</span>
                          <span className="text-amber-300 font-bold">★ {a.avgScore}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-2 text-center">
                    Henüz oyuncu etiketi bulunmuyor.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

