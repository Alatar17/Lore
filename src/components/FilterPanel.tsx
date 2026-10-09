import React, { useRef, useEffect } from 'react';
import { FilterState, GameStatus, MainTabType, RatingFilterType, BookFormat } from '../types';
import {
  SlidersHorizontal,
  RotateCcw,
  Star,
  PauseCircle,
  Gamepad2,
  Check,
  FolderX,
  Layers,
  BookOpen,
} from 'lucide-react';

interface FilterPanelProps {
  mainTab: MainTabType;
  filters: FilterState;
  onChange: (newFilters: Partial<FilterState>) => void;
  onClose: () => void;
  activeCategoryName?: string | null;
  activeSub?: string | null;
  isHideModeActive?: boolean;
  placement?: 'top' | 'bottom';
}

const GAME_STATUS_OPTIONS: { label: string; value: GameStatus | 'all' }[] = [
  { label: 'Tüm Durumlar', value: 'all' },
  { label: 'Oynanıyor', value: 'Oynanıyor' },
  { label: 'Tamamlandı', value: 'Tamamlandı' },
  { label: '%100 Başarım', value: '%100 Başarım' },
  { label: 'Yarım Bırakıldı', value: 'Yarım Bırakıldı' },
];

const BOOK_FORMAT_OPTIONS: { label: string; value: BookFormat | 'all' }[] = [
  { label: 'Tüm Formatlar', value: 'all' },
  { label: 'Ciltsiz (Karton Kapak)', value: 'Ciltsiz' },
  { label: 'Ciltli (Sert Kapak)', value: 'Ciltli' },
  { label: 'E-Kitap (Dijital)', value: 'E-Kitap' },
  { label: 'Sesli Kitap', value: 'Sesli Kitap' },
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  mainTab,
  filters,
  onChange,
  activeCategoryName,
  activeSub,
  isHideModeActive,
  placement = 'top',
}) => {
  const isGame = mainTab === 'game';
  const isBook = mainTab === 'book';
  const isInsideSubfolder = Boolean(activeSub);

  const hiddenTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (hiddenTimerRef.current) {
        clearTimeout(hiddenTimerRef.current);
      }
    };
  }, []);

  const handleIconPressStart = () => {
    // If global hide mode is active (cards are hidden), shortcut is strictly disabled!
    if (isHideModeActive) return;
    if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current);
    hiddenTimerRef.current = setTimeout(() => {
      onChange({ hiddenOnly: !filters.hiddenOnly });
    }, 3000);
  };

  const handleIconPressEnd = () => {
    if (hiddenTimerRef.current) {
      clearTimeout(hiddenTimerRef.current);
      hiddenTimerRef.current = null;
    }
  };

  const isFiltered =
    (filters.ratingFilter && filters.ratingFilter !== 'all') ||
    filters.minRating > 0 ||
    Boolean(filters.droppedOnly) ||
    Boolean(filters.readingOnly) ||
    filters.watchingOnly ||
    filters.followingOnly ||
    filters.ankiFilter !== 'all' ||
    Boolean(filters.seriesOnly) ||
    Boolean(filters.uncategorizedOnly) ||
    (!isHideModeActive && Boolean(filters.hiddenOnly)) ||
    (filters.gameStatus && filters.gameStatus !== 'all') ||
    (filters.bookFormat && filters.bookFormat !== 'all');

  const handleReset = () => {
    onChange({
      minRating: 0,
      ratingFilter: 'all',
      droppedOnly: false,
      readingOnly: false,
      watchingOnly: false,
      followingOnly: false,
      ankiFilter: 'all',
      gameStatus: 'all',
      bookFormat: 'all',
      seriesOnly: false,
      uncategorizedOnly: false,
      hiddenOnly: false,
    });
  };

  const currentRatingValue =
    filters.ratingFilter ||
    (filters.minRating >= 9
      ? '9-plus'
      : filters.minRating >= 8
      ? '8-plus'
      : filters.minRating >= 7
      ? '7-plus'
      : 'all');

  return (
    <div
      id="filter-panel"
      className={`z-50 w-72 max-w-[calc(100vw-2rem)] p-4 bg-[#181818]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-sm animate-in fade-in zoom-in-95 duration-150 text-neutral-200 max-h-[75vh] overflow-y-auto custom-scrollbar ${
        placement === 'bottom'
          ? 'absolute bottom-11 mb-1 left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0'
          : 'absolute top-12 right-0'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2 select-none">
          <span
            onMouseDown={handleIconPressStart}
            onMouseUp={handleIconPressEnd}
            onMouseLeave={handleIconPressEnd}
            onTouchStart={handleIconPressStart}
            onTouchEnd={handleIconPressEnd}
            onTouchCancel={handleIconPressEnd}
            className="cursor-default flex items-center justify-center"
          >
            <SlidersHorizontal className="w-4 h-4 text-white" />
          </span>
          <span className="font-semibold text-xs text-neutral-200 uppercase tracking-wider">
            Filtreler
          </span>
        </div>
        {isFiltered && (
          <button
            id="clear-filters-btn"
            onClick={handleReset}
            className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/5"
          >
            <RotateCcw className="w-3 h-3" /> Sıfırla
          </button>
        )}
      </div>

      <div className="space-y-3.5">
        {/* Puan Filtresi (Sadeleştirilmiş Akıllı Seçenekler) */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1.5 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            <span>Puan Filtresi</span>
          </label>
          <select
            id="filter-rating-select"
            value={currentRatingValue}
            onChange={(e) => {
              const val = e.target.value as RatingFilterType;
              const numericMap: Record<RatingFilterType, number> = {
                'all': 0,
                '9-plus': 9,
                '8-plus': 8,
                '7-plus': 7,
                '6-below': 0,
                'unrated': 0,
              };
              onChange({ ratingFilter: val, minRating: numericMap[val] || 0 });
            }}
            className="w-full bg-neutral-800 text-neutral-200 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value="all" className="bg-neutral-900 text-white">
              Tüm Puanlar (Filtre Yok)
            </option>
            <option value="9-plus" className="bg-neutral-900 text-amber-300 font-semibold">
              ★ 9+ Puan (Zirve Yapımlar)
            </option>
            <option value="8-plus" className="bg-neutral-900 text-amber-300 font-semibold">
              ★ 8+ Puan (Çok İyi)
            </option>
            <option value="7-plus" className="bg-neutral-900 text-amber-300 font-semibold">
              ★ 7+ Puan (İyi)
            </option>
            <option value="6-below" className="bg-neutral-900 text-slate-300">
              ★ 6 ve Altı (Ortalama / Düşük)
            </option>
            <option value="unrated" className="bg-neutral-900 text-sky-300 font-medium">
              ? Puansız Yapımlar (Değerlendirilmemiş)
            </option>
          </select>
        </div>

        {/* Status filters for Book & Media */}
        {!isGame && (
          <div className="pt-2 border-t border-white/10 space-y-1">
            {/* Book-Specific: Şu An Okunanlar */}
            {isBook && (
              <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1.5 px-1 rounded-lg hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-200 font-medium">Şu An Okunanlar</span>
                </div>
                <input
                  id="filter-reading-checkbox"
                  type="checkbox"
                  checked={Boolean(filters.readingOnly)}
                  onChange={(e) => onChange({ readingOnly: e.target.checked })}
                  className="w-4 h-4 rounded border-blue-500/50 bg-neutral-800 text-blue-500 focus:ring-0 cursor-pointer accent-blue-500"
                />
              </label>
            )}

            {/* Media & Book: Yarım Bırakılanlar */}
            <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1.5 px-1 rounded-lg hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <PauseCircle className="w-4 h-4 text-rose-400" />
                <span className="text-rose-200 font-medium">Yarım Bırakılanlar</span>
              </div>
              <input
                id="filter-dropped-checkbox"
                type="checkbox"
                checked={Boolean(filters.droppedOnly)}
                onChange={(e) => onChange({ droppedOnly: e.target.checked })}
                className="w-4 h-4 rounded border-rose-500/50 bg-neutral-800 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500"
              />
            </label>
          </div>
        )}

        {/* Game-Specific: Status Filter */}
        {isGame && (
          <div className="pt-2 border-t border-white/10">
            <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1.5 flex items-center gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5 text-neutral-300" />
              <span>Oyun Durumu</span>
            </label>
            <select
              id="filter-game-status-select"
              value={filters.gameStatus || 'all'}
              onChange={(e) =>
                onChange({
                  gameStatus: e.target.value as GameStatus | 'all',
                })
              }
              className="w-full bg-neutral-800 text-neutral-200 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-white/30 cursor-pointer"
            >
              {GAME_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-neutral-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Book-Specific: Format Filter */}
        {isBook && (
          <div className="pt-2 border-t border-white/10">
            <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              <span>Format / Baskı Türü</span>
            </label>
            <select
              id="filter-book-format-select"
              value={filters.bookFormat || 'all'}
              onChange={(e) =>
                onChange({
                  bookFormat: e.target.value as BookFormat | 'all',
                })
              }
              className="w-full bg-neutral-800 text-neutral-200 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-white/30 cursor-pointer"
            >
              {BOOK_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-neutral-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Seri / Evren Bağlantısı */}
        <div className="pt-2 border-t border-white/10">
          <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Seri / Evren Bağlantılı</span>
            </div>
            <input
              id="filter-series-checkbox"
              type="checkbox"
              checked={Boolean(filters.seriesOnly)}
              onChange={(e) => onChange({ seriesOnly: e.target.checked })}
              className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-white focus:ring-0 cursor-pointer accent-white"
            />
          </label>
        </div>

        {/* Anki Filtresi */}
        <div className="pt-2 border-t border-white/10">
          <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Anki Durumu</span>
          </label>
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: 'Tümü', val: 'all' },
              { label: 'Eklenenler', val: 'yes' },
              { label: 'Olmayanlar', val: 'no' },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => onChange({ ankiFilter: opt.val as 'all' | 'yes' | 'no' })}
                className={`py-1.5 text-[11px] rounded-lg font-medium transition-all cursor-pointer text-center ${
                  filters.ankiFilter === opt.val
                    ? 'bg-neutral-200 text-neutral-900 font-semibold shadow'
                    : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-700/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Kategorisiz / Alt Kategorisiz Kartlar (On/Off) */}
        {!isInsideSubfolder ? (
          <div className="pt-2 border-t border-white/10">
            <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <FolderX className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>
                  {activeCategoryName
                    ? `Sadece Alt Kategorisiz (${activeCategoryName})`
                    : 'Sadece Kategorisiz Kartlar'}
                </span>
              </div>
              <input
                id="filter-uncategorized-checkbox"
                type="checkbox"
                checked={Boolean(filters.uncategorizedOnly)}
                onChange={(e) => onChange({ uncategorizedOnly: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-white focus:ring-0 cursor-pointer accent-white"
              />
            </label>
            <p className="text-[10px] text-neutral-500 px-1 mt-0.5">
              {activeCategoryName
                ? `"${activeCategoryName}" içinde herhangi bir alt gruba (Yerli/Yabancı vb.) atanmamış doğrudan ana klasördeki kartları listeler.`
                : 'Herhangi bir kategoriye atanmamış veya silinmiş kategorideki yapımları listeler.'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
