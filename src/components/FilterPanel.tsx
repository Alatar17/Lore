import React from 'react';
import { FilterState, MainTabType } from '../types';
import { Star, Eye, Filter } from 'lucide-react';

interface FilterPanelProps {
  mainTab: MainTabType;
  filters: FilterState;
  onChange: (newFilters: Partial<FilterState>) => void;
  onClose: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  mainTab,
  filters,
  onChange,
}) => {
  return (
    <div
      id="filter-panel"
      className="absolute top-11 right-0 z-30 w-64 p-3.5 bg-[#1e2129] border border-[#3e4454] rounded-xl shadow-2xl text-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#2d313c]">
        <span className="font-semibold text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-blue-400" /> Filtreler
        </span>
        {(filters.minRating > 0 ||
          filters.watchingOnly ||
          filters.followingOnly ||
          filters.ankiFilter !== 'all') && (
          <button
            id="clear-filters-btn"
            onClick={() =>
              onChange({
                minRating: 0,
                watchingOnly: false,
                followingOnly: false,
                ankiFilter: 'all',
              })
            }
            className="text-xs text-blue-400 hover:underline"
          >
            Sıfırla
          </button>
        )}
      </div>

      {/* Puan Eşiği */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Puan Eşiği
        </label>
        <select
          id="rating-filter-select"
          value={filters.minRating}
          onChange={(e) => onChange({ minRating: Number(e.target.value) })}
          className="w-full bg-[#14151a] text-gray-200 border border-[#353a47] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
        >
          <option value={0}>Tüm puanlar</option>
          <option value={7}>7+ puan</option>
          <option value={8}>8+ puan</option>
          <option value={9}>9+ puan</option>
          <option value={10}>10 puan (Tam puan)</option>
        </select>
      </div>

      {/* Medya Özel Filtreleri */}
      {mainTab === 'media' && (
        <div className="space-y-2 mb-3 pt-1 border-t border-[#2a2e39]">
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none hover:text-white">
            <input
              id="filter-watching-checkbox"
              type="checkbox"
              checked={filters.watchingOnly}
              onChange={(e) => onChange({ watchingOnly: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0"
            />
            <span className="text-cyan-400">▶</span> Sadece İzlenenler
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none hover:text-white">
            <input
              id="filter-following-checkbox"
              type="checkbox"
              checked={filters.followingOnly}
              onChange={(e) => onChange({ followingOnly: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0"
            />
            <span className="text-amber-400">★</span> Sadece Takip Edilenler
          </label>
        </div>
      )}

      {/* Anki Durumu */}
      <div className="pt-2 border-t border-[#2a2e39]">
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Anki Durumu
        </label>
        <select
          id="filter-anki-select"
          value={filters.ankiFilter}
          onChange={(e) =>
            onChange({ ankiFilter: e.target.value as 'all' | 'yes' | 'no' })
          }
          className="w-full bg-[#14151a] text-gray-200 border border-[#353a47] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
        >
          <option value="all">Tümü</option>
          <option value="yes">Sadece Anki'ye eklenenler</option>
          <option value="no">Sadece Anki'ye eklenmemişler</option>
        </select>
      </div>
    </div>
  );
};
