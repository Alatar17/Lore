import React from 'react';
import { FilterState, GameStatus, MainTabType } from '../types';
import {
  SlidersHorizontal,
  RotateCcw,
  Star,
  Tv,
  Bookmark,
  Brain,
  Gamepad2,
  Check,
} from 'lucide-react';

interface FilterPanelProps {
  mainTab: MainTabType;
  filters: FilterState;
  onChange: (newFilters: Partial<FilterState>) => void;
  onClose: () => void;
}

const GAME_STATUS_OPTIONS: { label: string; value: GameStatus | 'all' }[] = [
  { label: 'Tüm Durumlar', value: 'all' },
  { label: 'Oynanıyor', value: 'Oynanıyor' },
  { label: 'Tamamlandı', value: 'Tamamlandı' },
  { label: '%100 Başarım', value: '%100 Başarım' },
  { label: 'Yarım Bırakıldı', value: 'Yarım Bırakıldı' },
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  mainTab,
  filters,
  onChange,
}) => {
  const isGame = mainTab === 'game';

  const isFiltered =
    filters.minRating > 0 ||
    filters.watchingOnly ||
    filters.followingOnly ||
    filters.ankiFilter !== 'all' ||
    (filters.gameStatus && filters.gameStatus !== 'all');

  const handleReset = () => {
    onChange({
      minRating: 0,
      watchingOnly: false,
      followingOnly: false,
      ankiFilter: 'all',
      gameStatus: 'all',
    });
  };

  return (
    <div
      id="filter-panel"
      className="absolute top-12 right-0 z-50 w-72 p-4 bg-[#181818]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-sm animate-in fade-in zoom-in-95 duration-150 text-neutral-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-white" />
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
        {/* Puan Eşiği (Rating Dropdown Menu: Tümü, 9+, 8+, 7+) */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1.5 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            <span>Puan Eşiği</span>
          </label>
          <select
            id="filter-rating-select"
            value={filters.minRating}
            onChange={(e) => onChange({ minRating: Number(e.target.value) })}
            className="w-full bg-neutral-800 text-neutral-200 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value={0} className="bg-neutral-900 text-white">
              Tümü (Filtre Yok)
            </option>
            <option value={10} className="bg-neutral-900 text-amber-300 font-bold">
              ★ 10 Puan
            </option>
            <option value={9} className="bg-neutral-900 text-amber-300 font-bold">
              ★ 9+ Puan
            </option>
            <option value={8} className="bg-neutral-900 text-amber-300 font-bold">
              ★ 8+ Puan
            </option>
            <option value={7} className="bg-neutral-900 text-amber-300 font-bold">
              ★ 7+ Puan
            </option>
            <option value={6} className="bg-neutral-900 text-amber-300">
              ★ 6+ Puan
            </option>
            <option value={5} className="bg-neutral-900 text-amber-300">
              ★ 5+ Puan
            </option>
            <option value={4} className="bg-neutral-900 text-amber-300">
              ★ 4+ Puan
            </option>
            <option value={3} className="bg-neutral-900 text-amber-300">
              ★ 3+ Puan
            </option>
            <option value={2} className="bg-neutral-900 text-amber-300">
              ★ 2+ Puan
            </option>
            <option value={1} className="bg-neutral-900 text-amber-300">
              ★ 1+ Puan
            </option>
          </select>
        </div>

        {/* Media-Specific: Watching / Following */}
        {!isGame && (
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider block mb-1">
              İzleme & Takip Durumu
            </span>
            <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <Tv className="w-3.5 h-3.5 text-blue-400" />
                <span>Sadece İzlenenler</span>
              </div>
              <input
                id="filter-watching-checkbox"
                type="checkbox"
                checked={filters.watchingOnly}
                onChange={(e) => onChange({ watchingOnly: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-white focus:ring-0 cursor-pointer accent-white"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <Bookmark className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                <span>Sadece Takip Edilenler</span>
              </div>
              <input
                id="filter-following-checkbox"
                type="checkbox"
                checked={filters.followingOnly}
                onChange={(e) => onChange({ followingOnly: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-white focus:ring-0 cursor-pointer accent-white"
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

        {/* Anki Filtresi */}
        <div className="pt-2 border-t border-white/10">
          <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1.5 flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-emerald-400" />
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
      </div>
    </div>
  );
};
