import React, { useRef, useEffect, useState } from 'react';
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
  X,
  ChevronDown,
  ChevronRight,
  Film,
  Gamepad2,
  Sparkles,
  Layers,
  LayoutGrid,
  ListOrdered,
} from 'lucide-react';

export const TRACKED_TAB_ID = '__tracked__';

interface HeaderTabsProps {
  mainTab: MainTabType;
  categories: {
    media: Category[];
    game: Category[];
  };
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
  onMainTabChange,
  onCategorySelect,
  onSubgroupSelect,
  onViewModeChange,
  onSearchChange,
  onToggleSearch,
  onToggleFilter,
  onToggleView,
  onOpenSettings,
  onFilterChange,
  onViewSettingsChange,
  onClosePanels,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [openDropdown, setOpenDropdown] = useState<'media' | 'game' | null>(null);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);

  const currentCategoryList = mainTab === 'media' ? categories.media : categories.game;
  const activeCategory =
    activeCatId && activeCatId !== TRACKED_TAB_ID
      ? currentCategoryList.find((c) => c.id === activeCatId)
      : null;

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close dropdowns on global panel close or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#category-dropdown-container')) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const activeFiltersCount =
    (filters.minRating > 0 ? 1 : 0) +
    (filters.watchingOnly ? 1 : 0) +
    (filters.followingOnly ? 1 : 0) +
    (filters.ankiFilter !== 'all' ? 1 : 0);

  const toggleDropdown = (tab: 'media' | 'game', e: React.MouseEvent) => {
    e.stopPropagation();
    onClosePanels();
    if (mainTab !== tab) {
      onMainTabChange(tab);
      onCategorySelect(null);
      onSubgroupSelect(null);
    }
    setOpenDropdown(openDropdown === tab ? null : tab);
  };

  const handleSelectCategoryFromMenu = (catId: string | null, sub: string | null = null) => {
    onCategorySelect(catId);
    onSubgroupSelect(sub);
    setOpenDropdown(null);
  };

  return (
    <header className="relative z-30 flex flex-col gap-3 py-2 border-b border-[#1b2333]/80">
      {/* Top Main Navigation Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left Side: Brand Logo & Dropdown Menus */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap" id="category-dropdown-container">
          {/* Logo */}
          <div
            id="brand-logo"
            onClick={() => {
              onCategorySelect(null);
              onSubgroupSelect(null);
              onSearchChange('');
            }}
            className="flex items-center gap-2 cursor-pointer select-none group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-blue-300 transition-colors">
              Lore
            </span>
          </div>

          {/* Media & Game Dropdown Selectors */}
          <div className="flex items-center gap-2 relative">
            {/* Medya Dropdown Button */}
            <div className="relative">
              <button
                id="dropdown-media-btn"
                onClick={(e) => toggleDropdown('media', e)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border cursor-pointer ${
                  mainTab === 'media'
                    ? 'bg-[#182236] text-white border-blue-500/60 shadow-lg shadow-blue-500/10'
                    : 'bg-[#0f1420] text-slate-400 border-[#1f283d] hover:text-slate-200 hover:bg-[#141b2b]'
                }`}
              >
                <Film className="w-4 h-4 text-blue-400" />
                <span>Medya</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    openDropdown === 'media' ? 'rotate-180 text-blue-400' : ''
                  }`}
                />
              </button>

              {/* Medya Dropdown Menu */}
              {openDropdown === 'media' && (
                <div
                  id="dropdown-media-menu"
                  className="absolute top-12 left-0 z-50 w-64 p-2 bg-[#121826]/95 backdrop-blur-xl border border-[#26334a] rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Medya Kategorileri</span>
                    <button
                      onClick={() => handleSelectCategoryFromMenu(null)}
                      className="text-blue-400 hover:underline capitalize"
                    >
                      Tümünü Gör
                    </button>
                  </div>

                  {/* İzlenen / Takip Quick Item */}
                  <button
                    onClick={() => handleSelectCategoryFromMenu(TRACKED_TAB_ID)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                      activeCatId === TRACKED_TAB_ID
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-amber-400/90 hover:bg-amber-500/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-amber-400">★</span> İzlenen & Takip
                    </span>
                    <span className="text-[10px] text-amber-500/70">Özel Vitrin</span>
                  </button>

                  <div className="my-1 border-t border-[#1e273a]" />

                  {/* Categories */}
                  <div className="max-h-72 overflow-y-auto space-y-0.5 custom-scrollbar">
                    {categories.media.map((cat) => {
                      const isCatActive = activeCatId === cat.id;
                      const hasSubs = cat.subgroups && cat.subgroups.length > 0;
                      const isExpanded = expandedCatId === cat.id;

                      return (
                        <div key={cat.id} className="rounded-xl overflow-hidden">
                          <div
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                              isCatActive
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-300 hover:bg-[#1b2438] hover:text-white'
                            }`}
                          >
                            <div
                              onClick={() => handleSelectCategoryFromMenu(cat.id, null)}
                              className="flex-1 truncate"
                            >
                              {cat.name}
                            </div>
                            {hasSubs && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedCatId(isExpanded ? null : cat.id);
                                }}
                                className={`p-1 rounded hover:bg-white/10 ${
                                  isExpanded ? 'text-blue-300' : 'text-slate-400'
                                }`}
                                title="Alt kategoriler"
                              >
                                <ChevronRight
                                  className={`w-3.5 h-3.5 transition-transform ${
                                    isExpanded ? 'rotate-90' : ''
                                  }`}
                                />
                              </button>
                            )}
                          </div>

                          {/* Nested Subgroups */}
                          {hasSubs && isExpanded && (
                            <div className="ml-4 pl-2 my-1 border-l border-blue-500/30 space-y-0.5 animate-in fade-in">
                              <button
                                onClick={() => handleSelectCategoryFromMenu(cat.id, null)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                                  isCatActive && activeSub === null
                                    ? 'bg-blue-500/20 text-blue-300 font-semibold'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                • Tümü ({cat.name})
                              </button>
                              {cat.subgroups.map((sub) => (
                                <button
                                  key={sub}
                                  onClick={() => handleSelectCategoryFromMenu(cat.id, sub)}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors truncate ${
                                    isCatActive && activeSub === sub
                                      ? 'bg-blue-500/20 text-blue-300 font-semibold'
                                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  • {sub}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Oyun Dropdown Button */}
            <div className="relative">
              <button
                id="dropdown-game-btn"
                onClick={(e) => toggleDropdown('game', e)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border cursor-pointer ${
                  mainTab === 'game'
                    ? 'bg-[#182236] text-white border-blue-500/60 shadow-lg shadow-blue-500/10'
                    : 'bg-[#0f1420] text-slate-400 border-[#1f283d] hover:text-slate-200 hover:bg-[#141b2b]'
                }`}
              >
                <Gamepad2 className="w-4 h-4 text-emerald-400" />
                <span>Oyun</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    openDropdown === 'game' ? 'rotate-180 text-blue-400' : ''
                  }`}
                />
              </button>

              {/* Oyun Dropdown Menu */}
              {openDropdown === 'game' && (
                <div
                  id="dropdown-game-menu"
                  className="absolute top-12 left-0 z-50 w-64 p-2 bg-[#121826]/95 backdrop-blur-xl border border-[#26334a] rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Oyun Kategorileri</span>
                    <button
                      onClick={() => handleSelectCategoryFromMenu(null)}
                      className="text-blue-400 hover:underline capitalize"
                    >
                      Tümünü Gör
                    </button>
                  </div>

                  <div className="my-1 border-t border-[#1e273a]" />

                  {/* Categories */}
                  <div className="max-h-72 overflow-y-auto space-y-0.5 custom-scrollbar">
                    {categories.game.map((cat) => {
                      const isCatActive = activeCatId === cat.id;
                      const hasSubs = cat.subgroups && cat.subgroups.length > 0;
                      const isExpanded = expandedCatId === cat.id;

                      return (
                        <div key={cat.id} className="rounded-xl overflow-hidden">
                          <div
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                              isCatActive
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-300 hover:bg-[#1b2438] hover:text-white'
                            }`}
                          >
                            <div
                              onClick={() => handleSelectCategoryFromMenu(cat.id, null)}
                              className="flex-1 truncate"
                            >
                              {cat.name}
                            </div>
                            {hasSubs && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedCatId(isExpanded ? null : cat.id);
                                }}
                                className={`p-1 rounded hover:bg-white/10 ${
                                  isExpanded ? 'text-blue-300' : 'text-slate-400'
                                }`}
                                title="Alt kategoriler"
                              >
                                <ChevronRight
                                  className={`w-3.5 h-3.5 transition-transform ${
                                    isExpanded ? 'rotate-90' : ''
                                  }`}
                                />
                              </button>
                            )}
                          </div>

                          {/* Nested Subgroups */}
                          {hasSubs && isExpanded && (
                            <div className="ml-4 pl-2 my-1 border-l border-blue-500/30 space-y-0.5 animate-in fade-in">
                              <button
                                onClick={() => handleSelectCategoryFromMenu(cat.id, null)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                                  isCatActive && activeSub === null
                                    ? 'bg-blue-500/20 text-blue-300 font-semibold'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                • Tümü ({cat.name})
                              </button>
                              {cat.subgroups.map((sub) => (
                                <button
                                  key={sub}
                                  onClick={() => handleSelectCategoryFromMenu(cat.id, sub)}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors truncate ${
                                    isCatActive && activeSub === sub
                                      ? 'bg-blue-500/20 text-blue-300 font-semibold'
                                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  • {sub}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Breadcrumb Path Tag */}
          {(activeCatId !== null || activeSub !== null) && (
            <div
              id="active-breadcrumb-pill"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141d2e] border border-blue-500/30 text-xs text-slate-200 animate-in fade-in"
            >
              <span className="text-slate-400 font-medium">
                {mainTab === 'media' ? 'Medya' : 'Oyun'}
              </span>
              <span className="text-slate-500">›</span>
              <span className="font-semibold text-blue-300">
                {activeCatId === TRACKED_TAB_ID
                  ? '★ İzlenen / Takip'
                  : activeCategory?.name || 'Seçili Kategori'}
              </span>
              {activeSub && (
                <>
                  <span className="text-slate-500">›</span>
                  <span className="text-slate-100 font-semibold">{activeSub}</span>
                </>
              )}
              <button
                onClick={() => {
                  onCategorySelect(null);
                  onSubgroupSelect(null);
                }}
                title="Filtreyi Temizle"
                className="ml-1 p-0.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Tier List / Grid View Switcher (Visible only when category has tierEnabled) */}
          {activeCategory && activeCategory.tierEnabled && (
            <div className="flex items-center gap-1 p-1 bg-[#101522] rounded-xl border border-[#202c42]">
              <button
                id="viewmode-grid-btn"
                onClick={() => onViewModeChange('grid')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3 h-3" /> Izgara
              </button>
              <button
                id="viewmode-tier-btn"
                onClick={() => onViewModeChange('tier')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'tier'
                    ? 'bg-amber-600 text-white shadow font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListOrdered className="w-3 h-3" /> Tier List
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Toolbar Icons (Search, Filter, View, Settings) */}
        <div className="flex items-center gap-2 relative">
          {/* Search Box / Toggle */}
          {isSearchOpen ? (
            <div className="flex items-center bg-[#101624] border border-[#28354c] rounded-xl px-3 py-1.5 w-48 sm:w-64 animate-in fade-in">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
              <input
                ref={searchInputRef}
                id="search-header-input"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Yapım ara..."
                className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  onSearchChange('');
                  onToggleSearch();
                }}
                className="text-slate-400 hover:text-white text-xs ml-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="search-toggle-btn"
              onClick={onToggleSearch}
              title="Arama (🔍)"
              className="p-2.5 rounded-xl bg-[#101624] hover:bg-[#182236] border border-[#212c40] text-slate-300 hover:text-white transition-all cursor-pointer hover:border-blue-500/40"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Filter Popover Button */}
          <div className="relative">
            <button
              id="filter-toggle-btn"
              onClick={onToggleFilter}
              title="Filtrele (🎚)"
              className={`p-2.5 rounded-xl border transition-all relative cursor-pointer ${
                isFilterOpen || activeFiltersCount > 0
                  ? 'bg-[#18243a] border-blue-500 text-blue-400 shadow-md shadow-blue-500/10'
                  : 'bg-[#101624] hover:bg-[#182236] border-[#212c40] text-slate-300 hover:text-white hover:border-blue-500/40'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center shadow">
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

          {/* View Settings Popover Button */}
          <div className="relative">
            <button
              id="view-toggle-btn"
              onClick={onToggleView}
              title="Görünüm Ayarları (👁)"
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isViewOpen
                  ? 'bg-[#18243a] border-blue-500 text-blue-400 shadow-md shadow-blue-500/10'
                  : 'bg-[#101624] hover:bg-[#182236] border-[#212c40] text-slate-300 hover:text-white hover:border-blue-500/40'
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

          {/* Settings Modal Trigger (Far Right) */}
          <button
            id="settings-toggle-btn"
            onClick={onOpenSettings}
            title="Ayarlar (⚙)"
            className="p-2.5 rounded-xl bg-[#101624] hover:bg-[#182236] border border-[#212c40] text-slate-300 hover:text-white transition-all cursor-pointer hover:border-blue-500/40"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
