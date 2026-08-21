import React from 'react';
import { FilterState, MainTabType } from '../types';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';

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
  const isFiltered =
    filters.minRating > 0 ||
    filters.watchingOnly ||
    filters.followingOnly ||
    filters.ankiFilter !== 'all';

  return (
    <div
      id="filter-panel"
      className="absolute top-12 right-0 z-40 w-64 p-4 bg-[#141b28]/95 backdrop-blur-md border border-[#273248] rounded-xl shadow-2xl text-sm animate-in fade-in zoom-in-95 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#222c40]">
        <span className="font-semibold text-xs text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" /> Filtreler
        </span>
        {isFiltered && (
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
            className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Sıfırla
          </button>
        )}
      </div>

      {/* Puan Eşiği */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Puan eşiği
        </label>
        <select
          id="rating-filter-select"
          value={filters.minRating}
          onChange={(e) => onChange({ minRating: Number(e.target.value) })}
          className="w-full bg-[#0d121c] text-gray-200 border border-[#273248] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value={0}>Tüm puanlar</option>
          <option value={7}>★ 7 ve üzeri</option>
          <option value={8}>★ 8 ve üzeri</option>
          <option value={9}>★ 9 ve üzeri</option>
          <option value={10}>★ 10 puan (Şaheser)</option>
        </select>
      </div>

      {/* Checkboxes matching mockup */}
      <div className="space-y-2 mb-3.5 pt-2 border-t border-[#222c40]">
        <label className="flex items-center gap-2.5 text-xs text-gray-200 cursor-pointer select-none hover:text-white transition-colors">
          <input
            id="filter-watching-checkbox"
            type="checkbox"
            checked={filters.watchingOnly}
            onChange={(e) => onChange({ watchingOnly: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800/80 text-blue-500 focus:ring-0 cursor-pointer accent-blue-500"
          />
          <span>Sadece İzlenenler</span>
        </label>

        <label className="flex items-center gap-2.5 text-xs text-gray-200 cursor-pointer select-none hover:text-white transition-colors">
          <input
            id="filter-following-checkbox"
            type="checkbox"
            checked={filters.followingOnly}
            onChange={(e) => onChange({ followingOnly: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800/80 text-blue-500 focus:ring-0 cursor-pointer accent-blue-500"
          />
          <span>Sadece Takip Edilenler</span>
        </label>
      </div>

      {/* Anki Durumu */}
      <div className="pt-2.5 border-t border-[#222c40]">
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Anki durumu
        </label>
        <select
          id="filter-anki-select"
          value={filters.ankiFilter}
          onChange={(e) =>
            onChange({ ankiFilter: e.target.value as 'all' | 'yes' | 'no' })
          }
          className="w-full bg-[#0d121c] text-gray-200 border border-[#273248] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="all">Tümü</option>
          <option value="yes">Sadece Anki'ye eklenenler</option>
          <option value="no">Sadece Anki'ye eklenmemişler</option>
        </select>
      </div>
    </div>
  );
};

