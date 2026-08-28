import React, { useState, useMemo, useEffect } from 'react';
import { ArchiveItem, MainTabType } from '../types';
import {
  X,
  Film,
  Gamepad2,
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
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-black/40">
          {/* Left spacing to balance right side */}
          <div className="w-24 hidden sm:block" />

          {/* Centered Media / Game Switcher (Matched to main page neutral style) */}
          <div className="flex p-0.5 bg-neutral-900 rounded-xl border border-white/15 mx-auto">
            <button
              id="stats-tab-media-btn"
              onClick={() => setActiveTab('media')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'media'
                  ? 'bg-neutral-800 text-white shadow-sm border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-neutral-300" />
              <span>Medya</span>
            </button>
            <button
              id="stats-tab-game-btn"
              onClick={() => setActiveTab('game')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'game'
                  ? 'bg-neutral-800 text-white shadow-sm border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-neutral-300" />
              <span>Oyun</span>
            </button>
          </div>

          {/* Right Controls: Year Filter Dropdown + Close Button */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
              <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <select
                id="stats-year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-slate-900 text-white">
                  Tüm Yıllar
                </option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr} className="bg-slate-900 text-white">
                    {yr} Yılı
                  </option>
                ))}
              </select>
            </div>

            <button
              id="close-stats-btn"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body - Fixed Height Container for layout stability */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6 min-h-[520px]">
          {/* 1. TOP SUMMARY CARDS */}
          {!isGame ? (
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

          {/* 3. FIELD-SCOPED TAGS: TOP GENRES & TOP STUDIOS */}
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

            {/* Top Studios / Developers */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  {isGame ? 'En Çok Oynanan Geliştiriciler' : 'En Çok İzlenen Firma / Stüdyolar'}
                </span>
                <span className="text-[10px] text-slate-500">Adet / Ort. Puan</span>
              </h3>

              {(!isGame ? topFirms : topDevelopers).length > 0 ? (
                <div className="space-y-2 pt-1">
                  {(!isGame ? topFirms : topDevelopers).map((st) => (
                    <div
                      key={st.name}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 text-xs hover:border-white/15 transition-all"
                    >
                      <span className="font-semibold text-slate-200">{st.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-medium">
                          {st.count} yapım
                        </span>
                        <span className="text-amber-300 font-bold">★ {st.avgScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  Henüz stüdyo/geliştirici etiketi bulunmuyor.
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

