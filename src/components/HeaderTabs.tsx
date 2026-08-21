import React, { useRef, useEffect } from 'react';
import {
  Category,
  FilterState,
  MainTabType,
  ViewSettings,
} from '../types';
import { FilterPanel } from './FilterPanel';
import { ViewPanel } from './ViewPanel';
import {
  Search,
  SlidersHorizontal,
  Eye,
  Settings,
  Plus,
  X,
  HardDrive,
  FolderCheck,
} from 'lucide-react';

export const TRACKED_TAB_ID = '__tracked__';

interface HeaderTabsProps {
  mainTab: MainTabType;
  categories: Category[];
  activeCatId: string | null;
  activeSub: string | null;
  viewMode: 'grid' | 'tier';
  searchQuery: string;
  isSearchOpen: boolean;
  isFilterOpen: boolean;
  isViewOpen: boolean;
  filters: FilterState;
  viewSettings: ViewSettings;
  dirHandle: FileSystemDirectoryHandle | null;
  onMainTabChange: (tab: MainTabType) => void;
  onCategorySelect: (catId: string | null) => void;
  onSubgroupSelect: (sub: string | null) => void;
  onViewModeChange: (mode: 'grid' | 'tier') => void;
  onSearchChange: (query: string) => void;
  onToggleSearch: () => void;
  onToggleFilter: () => void;
  onToggleView: () => void;
  onOpenSettings: () => void;
  onOpenAddModal: () => void;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onViewSettingsChange: (newSettings: Partial<ViewSettings>) => void;
  onClosePanels: () => void;
}

export const HeaderTabs: React.FC<HeaderTabsProps> = ({
  mainTab,
  categories,
  activeCatId,
  activeSub,
  viewMode,
  searchQuery,
  isSearchOpen,
  isFilterOpen,
  isViewOpen,
  filters,
  viewSettings,
  dirHandle,
  onMainTabChange,
  onCategorySelect,
  onSubgroupSelect,
  onViewModeChange,
  onSearchChange,
  onToggleSearch,
  onToggleFilter,
  onToggleView,
  onOpenSettings,
  onOpenAddModal,
  onFilterChange,
  onViewSettingsChange,
  onClosePanels,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeCategory =
    activeCatId && activeCatId !== TRACKED_TAB_ID
      ? categories.find((c) => c.id === activeCatId)
      : null;

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const activeFiltersCount =
    (filters.minRating > 0 ? 1 : 0) +
    (filters.watchingOnly ? 1 : 0) +
    (filters.followingOnly ? 1 : 0) +
    (filters.ankiFilter !== 'all' ? 1 : 0);

  return (
    <header className="space-y-3 pb-3 border-b border-[#252834]">
      {/* 1. Main Tabs: Medya & Oyun */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <button
            id="main-tab-media"
            onClick={() => onMainTabChange('media')}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all select-none border ${
              mainTab === 'media'
                ? 'bg-[#222634] text-white border-blue-500/70 shadow-md shadow-blue-500/5'
                : 'bg-[#15171d] text-gray-400 border-[#2d3240] hover:text-gray-200 hover:bg-[#1a1d24]'
            }`}
          >
            🎬 Medya
          </button>
          <button
            id="main-tab-game"
            onClick={() => onMainTabChange('game')}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all select-none border ${
              mainTab === 'game'
                ? 'bg-[#222634] text-white border-blue-500/70 shadow-md shadow-blue-500/5'
                : 'bg-[#15171d] text-gray-400 border-[#2d3240] hover:text-gray-200 hover:bg-[#1a1d24]'
            }`}
          >
            🎮 Oyun
          </button>
        </div>

        {/* Directory Connection & Add button */}
        <div className="flex items-center gap-2">
          {dirHandle ? (
            <div
              title={`Veriler "${dirHandle.name}" yerel klasörüne kaydediliyor`}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[11px] font-medium text-emerald-400"
            >
              <FolderCheck className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{dirHandle.name}</span>
            </div>
          ) : (
            <div
              title="Veriler tarayıcı hafızasında saklanıyor. Ayarlar'dan yerel klasör bağlayabilirsiniz."
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1c24] border border-[#2d3240] text-[11px] text-gray-400"
            >
              <HardDrive className="w-3.5 h-3.5 text-gray-400" />
              <span>Yerel Depolama</span>
            </div>
          )}

          <button
            id="add-item-header-btn"
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{mainTab === 'game' ? 'Oyun Ekle' : 'Yapım Ekle'}</span>
          </button>
        </div>
      </div>

      {/* 2. Category Buttons Row & Control Icons (Same Row) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Category chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pinned Tab for Medya */}
          {mainTab === 'media' && (
            <button
              id="cat-tab-tracked"
              onClick={() => onCategorySelect(TRACKED_TAB_ID)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all select-none ${
                activeCatId === TRACKED_TAB_ID
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/80 font-semibold shadow'
                  : 'bg-[#181920] text-amber-400/90 border-amber-500/30 hover:bg-amber-500/10'
              }`}
            >
              ★ İzlenen / Takip
            </button>
          )}

          {/* User Categories */}
          {categories.map((c) => {
            const isActive = activeCatId === c.id;
            return (
              <button
                key={c.id}
                id={`cat-tab-${c.id}`}
                onClick={() => onCategorySelect(isActive ? null : c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all select-none ${
                  isActive
                    ? 'bg-[#252936] text-white border-gray-400 font-semibold shadow'
                    : 'bg-[#15171d] text-gray-300 border-[#2d3240] hover:bg-[#1f222b] hover:text-white'
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {/* Action icons group (Aligned far right on same row) */}
        <div className="flex items-center gap-1.5 relative">
          {/* Search Box / Toggle */}
          {isSearchOpen ? (
            <div className="flex items-center bg-[#15171d] border border-[#3e4454] rounded-lg px-2 py-1 w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0 mr-1.5" />
              <input
                ref={searchInputRef}
                id="search-header-input"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Yapım ara..."
                className="w-full bg-transparent text-xs text-gray-100 placeholder-gray-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  onSearchChange('');
                  onToggleSearch();
                }}
                className="text-gray-400 hover:text-white text-xs ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="search-toggle-btn"
              onClick={onToggleSearch}
              title="Ara (🔍)"
              className="p-2 rounded-lg bg-[#161820] hover:bg-[#202430] border border-[#2d3240] text-gray-300 hover:text-white transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Filter button + Popover */}
          <div className="relative">
            <button
              id="filter-toggle-btn"
              onClick={onToggleFilter}
              title="Filtrele (🎚)"
              className={`p-2 rounded-lg border transition-colors relative ${
                isFilterOpen || activeFiltersCount > 0
                  ? 'bg-[#222736] border-blue-500/60 text-blue-400'
                  : 'bg-[#161820] hover:bg-[#202430] border-[#2d3240] text-gray-300 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {isFilterOpen && (
              <FilterPanel
                mainTab={mainTab}
                filters={filters}
                onChange={onFilterChange}
                onClose={onClosePanels}
              />
            )}
          </div>

          {/* View settings button + Popover */}
          <div className="relative">
            <button
              id="view-toggle-btn"
              onClick={onToggleView}
              title="Görünüm Ayarları (👁)"
              className={`p-2 rounded-lg border transition-colors ${
                isViewOpen
                  ? 'bg-[#222736] border-blue-500/60 text-blue-400'
                  : 'bg-[#161820] hover:bg-[#202430] border-[#2d3240] text-gray-300 hover:text-white'
              }`}
            >
              <Eye className="w-4 h-4" />
            </button>

            {isViewOpen && (
              <ViewPanel
                settings={viewSettings}
                onChange={onViewSettingsChange}
                onClose={onClosePanels}
              />
            )}
          </div>

          {/* Settings Modal Toggle */}
          <button
            id="settings-toggle-btn"
            onClick={onOpenSettings}
            title="Ayarlar (⚙)"
            className="p-2 rounded-lg bg-[#161820] hover:bg-[#202430] border border-[#2d3240] text-gray-300 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Subgroups Row (Visible ONLY when parent category is selected and has subgroups) */}
      {activeCategory && activeCategory.subgroups.length > 0 && (
        <div
          id="subgroups-row"
          className="flex items-center gap-1.5 pt-1 pl-1 flex-wrap"
        >
          <span className="text-[11px] text-gray-400 font-medium mr-1">
            Alt-Grup:
          </span>
          <button
            id="sub-btn-all"
            onClick={() => onSubgroupSelect(null)}
            className={`px-2.5 py-1 rounded-md text-xs transition-all ${
              activeSub === null
                ? 'bg-[#262c3b] text-blue-400 font-semibold border border-blue-500/40'
                : 'bg-[#14151b] text-gray-400 hover:text-gray-200 border border-[#262934]'
            }`}
          >
            Tümü
          </button>
          {activeCategory.subgroups.map((sub) => {
            const isSubActive = activeSub === sub;
            return (
              <button
                key={sub}
                id={`sub-btn-${sub}`}
                onClick={() => onSubgroupSelect(isSubActive ? null : sub)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                  isSubActive
                    ? 'bg-[#262c3b] text-blue-400 font-semibold border border-blue-500/40'
                    : 'bg-[#14151b] text-gray-400 hover:text-gray-200 border border-[#262934]'
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      )}

      {/* 4. View Mode Switcher (Grid vs Tier List) - ONLY when category has tierEnabled */}
      {activeCategory && activeCategory.tierEnabled && (
        <div className="flex items-center justify-between pt-1 border-t border-[#222530]">
          <div className="flex items-center gap-1.5 p-1 bg-[#14151b] rounded-lg border border-[#262934]">
            <button
              id="viewmode-grid-btn"
              onClick={() => onViewModeChange('grid')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'grid'
                  ? 'bg-[#222736] text-white shadow font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Izgara
            </button>
            <button
              id="viewmode-tier-btn"
              onClick={() => onViewModeChange('tier')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'tier'
                  ? 'bg-[#222736] text-amber-300 shadow font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Tier List
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
