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
  totalFilteredCount: number;
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
  totalFilteredCount,
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
  const [hoveredCat, setHoveredCat] = useState<Category | null>(null);
  const hoverTimeoutRef = useRef<any>(null);
  const subMenuTimeoutRef = useRef<any>(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#category-dropdown-container')) {
        setOpenDropdown(null);
        setHoveredCat(null);
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

  // Pure Hover handlers for Main Dropdown buttons
  const handleMouseEnter = (tab: 'media' | 'game') => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (openDropdown !== tab) {
      setHoveredCat(null);
    }
    setOpenDropdown(tab);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
      setHoveredCat(null);
    }, 250);
  };

  // Hover handlers for Category items to show subcategory flyout instantly
  const handleCatMouseEnter = (cat: Category) => {
    if (subMenuTimeoutRef.current) clearTimeout(subMenuTimeoutRef.current);
    setHoveredCat(cat);
  };

  // Clicking the main button switches the tab and toggles dropdown
  const handleTabButtonClick = (tab: 'media' | 'game', e: React.MouseEvent) => {
    e.stopPropagation();
    if (mainTab !== tab) {
      onMainTabChange(tab);
      onCategorySelect(null);
      onSubgroupSelect(null);
    }
    setOpenDropdown(openDropdown === tab ? null : tab);
  };

  // Selecting a category from dropdown switches tab if necessary and sets category
  const handleSelectCategoryFromMenu = (
    targetTab: 'media' | 'game',
    catId: string | null,
    sub: string | null = null
  ) => {
    if (mainTab !== targetTab) {
      onMainTabChange(targetTab);
    }
    onCategorySelect(catId);
    onSubgroupSelect(sub);
    setOpenDropdown(null);
    setHoveredCat(null);
  };

  return (
    <header className="relative z-30 flex flex-col gap-3 py-2 border-b border-white/10">
      {/* 3-Column Navigation Bar: Left: Breadcrumb + Count | Center: Tabs | Right: Tools */}
      <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-3 sm:gap-4">
        {/* 1. LEFT SIDE: Clickable Breadcrumb & Item Count Badge */}
        <div className="flex items-center gap-2.5 min-w-0 justify-start order-2 md:order-1 flex-wrap">
          {/* Breadcrumb Navigation Pill */}
          <div
            id="active-breadcrumb-pill"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200"
          >
            {/* Main Tab (Medya / Oyun) - Clickable! */}
            <button
              onClick={() => {
                onCategorySelect(null);
                onSubgroupSelect(null);
              }}
              title="Tüm listeyi göster"
              className="text-slate-300 hover:text-white font-medium hover:underline cursor-pointer transition-colors"
            >
              {mainTab === 'media' ? 'Medya' : 'Oyun'}
            </button>

            {/* Category Level - Clickable! */}
            {activeCatId !== null && (
              <>
                <span className="text-slate-500">›</span>
                <button
                  onClick={() => onSubgroupSelect(null)}
                  title={activeSub ? `${activeCategory?.name || 'Kategori'} geneline dön` : ''}
                  className={`font-semibold cursor-pointer transition-colors ${
                    activeSub
                      ? 'text-blue-300 hover:text-white hover:underline'
                      : 'text-blue-400'
                  }`}
                >
                  {activeCatId === TRACKED_TAB_ID
                    ? '★ İzlenen / Takip'
                    : activeCategory?.name || 'Seçili Kategori'}
                </button>
              </>
            )}

            {/* Subgroup Level */}
            {activeSub && (
              <>
                <span className="text-slate-500">›</span>
                <span className="text-slate-100 font-semibold">{activeSub}</span>
              </>
            )}
          </div>

          {/* Simple Clean Count Badge (Only Number) */}
          <span
            id="item-count-badge"
            title={`${totalFilteredCount} yapım listeleniyor`}
            className="px-2.5 py-1 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-300 font-bold text-xs shadow-xs"
          >
            {totalFilteredCount}
          </span>
        </div>

        {/* 2. CENTER: Medya & Oyun Navigation Dropdown Buttons */}
        <div
          className="flex items-center justify-center gap-2 sm:gap-3 order-1 md:order-2"
          id="category-dropdown-container"
          onMouseLeave={handleMouseLeave}
        >
          {/* Medya Dropdown Button */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter('media')}
          >
            <button
              id="dropdown-media-btn"
              onClick={(e) => handleTabButtonClick('media', e)}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border cursor-pointer ${
                mainTab === 'media'
                  ? 'bg-blue-600/25 text-blue-300 border-blue-500/60 shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200 hover:bg-white/10'
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

            {/* Medya Dropdown Menu with Hover Flyout Submenu */}
            {openDropdown === 'media' && (
              <div
                id="dropdown-media-menu"
                className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                }}
              >
                {/* Main Category Menu List (Fixed Width & Stable) */}
                <div className="w-60 p-2 bg-[#0e131f]/95 backdrop-blur-xl border border-blue-500/30 rounded-2xl shadow-2xl space-y-1 relative">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Medya Kategorileri</span>
                    <button
                      onClick={() => handleSelectCategoryFromMenu('media', null)}
                      className="text-blue-400 hover:underline capitalize cursor-pointer"
                    >
                      Tümünü Gör
                    </button>
                  </div>

                  {/* İzlenen / Takip Quick Item */}
                  <button
                    onClick={() => handleSelectCategoryFromMenu('media', TRACKED_TAB_ID)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                      mainTab === 'media' && activeCatId === TRACKED_TAB_ID
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                        : 'text-amber-400/90 hover:bg-amber-500/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-amber-400">★</span> İzlenen & Takip
                    </span>
                    <span className="text-[10px] text-amber-500/70">Özel Vitrin</span>
                  </button>

                  <div className="my-1 border-t border-white/10" />

                  {/* Categories */}
                  <div className="max-h-72 overflow-y-auto space-y-0.5 custom-scrollbar">
                    {categories.media.map((cat) => {
                      const isCatActive = mainTab === 'media' && activeCatId === cat.id;
                      const hasSubs = cat.subgroups && cat.subgroups.length > 0;
                      const isHovered = hoveredCat?.id === cat.id;

                      return (
                        <div
                          key={cat.id}
                          onMouseEnter={() => handleCatMouseEnter(cat)}
                          onClick={() => handleSelectCategoryFromMenu('media', cat.id, null)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                            isCatActive
                              ? 'bg-blue-600 text-white shadow'
                              : isHovered
                              ? 'bg-blue-500/15 text-blue-300'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{cat.name}</span>
                          {hasSubs && (
                            <ChevronRight
                              className={`w-3.5 h-3.5 transition-colors ${
                                isCatActive || isHovered ? 'text-blue-300' : 'text-slate-500'
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Absolute Positioned Right Flyout Submenu - Leaves Main Menu Untouched */}
                  {hoveredCat && hoveredCat.subgroups && hoveredCat.subgroups.length > 0 && (
                    <div
                      id="flyout-subgroups-menu"
                      className="absolute top-0 left-full ml-1 w-52 p-2 bg-[#0e131f]/95 backdrop-blur-xl border border-blue-500/30 rounded-2xl shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-100 z-50"
                      onMouseEnter={() => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      }}
                    >
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-blue-400 uppercase tracking-wider flex items-center justify-between">
                        <span>{hoveredCat.name} Alt Grupları</span>
                      </div>

                      <button
                        onClick={() => handleSelectCategoryFromMenu('media', hoveredCat.id, null)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                          mainTab === 'media' && activeCatId === hoveredCat.id && activeSub === null
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        Tümü ({hoveredCat.name})
                      </button>

                      <div className="my-1 border-t border-white/10" />

                      <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
                        {hoveredCat.subgroups.map((sub) => {
                          const isSubActive =
                            mainTab === 'media' && activeCatId === hoveredCat.id && activeSub === sub;
                          return (
                            <button
                              key={sub}
                              onClick={() => handleSelectCategoryFromMenu('media', hoveredCat.id, sub)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors truncate cursor-pointer ${
                                isSubActive
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {sub}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Oyun Dropdown Button */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter('game')}
          >
            <button
              id="dropdown-game-btn"
              onClick={(e) => handleTabButtonClick('game', e)}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border cursor-pointer ${
                mainTab === 'game'
                  ? 'bg-emerald-600/25 text-emerald-300 border-emerald-500/60 shadow-lg shadow-emerald-500/20'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-emerald-400" />
              <span>Oyun</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  openDropdown === 'game' ? 'rotate-180 text-emerald-400' : ''
                }`}
              />
            </button>

            {/* Oyun Dropdown Menu with Hover Flyout Submenu */}
            {openDropdown === 'game' && (
              <div
                id="dropdown-game-menu"
                className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                }}
              >
                {/* Main Category Menu List (Fixed Width & Stable) */}
                <div className="w-60 p-2 bg-[#091512]/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-2xl space-y-1 relative">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Oyun Kategorileri</span>
                    <button
                      onClick={() => handleSelectCategoryFromMenu('game', null)}
                      className="text-emerald-400 hover:underline capitalize cursor-pointer"
                    >
                      Tümünü Gör
                    </button>
                  </div>

                  <div className="my-1 border-t border-white/10" />

                  {/* Categories */}
                  <div className="max-h-72 overflow-y-auto space-y-0.5 custom-scrollbar">
                    {categories.game.map((cat) => {
                      const isCatActive = mainTab === 'game' && activeCatId === cat.id;
                      const hasSubs = cat.subgroups && cat.subgroups.length > 0;
                      const isHovered = hoveredCat?.id === cat.id;

                      return (
                        <div
                          key={cat.id}
                          onMouseEnter={() => handleCatMouseEnter(cat)}
                          onClick={() => handleSelectCategoryFromMenu('game', cat.id, null)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                            isCatActive
                              ? 'bg-emerald-600 text-white shadow'
                              : isHovered
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{cat.name}</span>
                          {hasSubs && (
                            <ChevronRight
                              className={`w-3.5 h-3.5 transition-colors ${
                                isCatActive || isHovered ? 'text-emerald-300' : 'text-slate-500'
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Absolute Positioned Right Flyout Submenu */}
                  {hoveredCat && hoveredCat.subgroups && hoveredCat.subgroups.length > 0 && (
                    <div
                      id="flyout-game-subgroups-menu"
                      className="absolute top-0 left-full ml-1 w-52 p-2 bg-[#091512]/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-100 z-50"
                      onMouseEnter={() => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      }}
                    >
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                        <span>{hoveredCat.name} Alt Grupları</span>
                      </div>

                      <button
                        onClick={() => handleSelectCategoryFromMenu('game', hoveredCat.id, null)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                          mainTab === 'game' && activeCatId === hoveredCat.id && activeSub === null
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        Tümü ({hoveredCat.name})
                      </button>

                      <div className="my-1 border-t border-white/10" />

                      <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
                        {hoveredCat.subgroups.map((sub) => {
                          const isSubActive =
                            mainTab === 'game' && activeCatId === hoveredCat.id && activeSub === sub;
                          return (
                            <button
                              key={sub}
                              onClick={() => handleSelectCategoryFromMenu('game', hoveredCat.id, sub)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors truncate cursor-pointer ${
                                isSubActive
                                  ? 'bg-emerald-600 text-white font-semibold'
                                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {sub}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. RIGHT SIDE: Izgara/Tier List + Divider + Search + Filter + View + Divider + Settings */}
        <div
          className="flex items-center justify-end gap-2 relative order-3 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Izgara / Tier List Switcher (Moved to right toolbar!) */}
          {activeCategory && activeCategory.tierEnabled && (
            <div className="flex items-center gap-1 p-0.5 bg-black/40 rounded-xl border border-white/10">
              <button
                id="viewmode-grid-btn"
                onClick={() => onViewModeChange('grid')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Izgara
              </button>
              <button
                id="viewmode-tier-btn"
                onClick={() => onViewModeChange('tier')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'tier'
                    ? 'bg-amber-600 text-white shadow font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" /> Tier List
              </button>
            </div>
          )}

          {/* Divider before Search */}
          <div className="h-5 w-[1px] bg-white/20 mx-0.5" aria-hidden="true" />

          {/* Search Box / Toggle */}
          {isSearchOpen ? (
            <div className="flex items-center bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 w-48 sm:w-60 animate-in fade-in">
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
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer hover:border-blue-500/40"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Filter Popover Button */}
          <div className="relative">
            <button
              id="filter-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFilter();
              }}
              title="Filtrele (🎚)"
              className={`p-2.5 rounded-xl border transition-all relative cursor-pointer ${
                isFilterOpen || activeFiltersCount > 0
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-md shadow-blue-500/10'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white hover:border-blue-500/40'
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
              onClick={(e) => {
                e.stopPropagation();
                onToggleView();
              }}
              title="Görünüm Ayarları (👁)"
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isViewOpen
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-md shadow-blue-500/10'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white hover:border-blue-500/40'
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

          {/* Divider before Settings */}
          <div className="h-5 w-[1px] bg-white/20 mx-0.5" aria-hidden="true" />

          {/* Settings Modal Trigger (Far Right) */}
          <button
            id="settings-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            title="Ayarlar (⚙)"
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer hover:border-blue-500/40"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
