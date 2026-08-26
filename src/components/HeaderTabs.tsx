import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Category,
  FilterState,
  MainTabType,
  ViewSettings,
  UiExperimentsState,
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
  BarChart3,
  Tag,
  Undo2,
  Redo2,
  Download,
  Upload,
  FolderX,
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
  isSelectionMode?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  uiExperiments?: UiExperimentsState;
  onMainTabChange: (tab: MainTabType) => void;
  onCategorySelect: (catId: string | null) => void;
  onSubgroupSelect: (sub: string | null) => void;
  onViewModeChange: (mode: 'grid' | 'tier') => void;
  onToggleSelectionMode?: () => void;
  onSearchChange: (query: string) => void;
  onToggleSearch: () => void;
  onToggleFilter: () => void;
  onToggleView: () => void;
  onOpenSettings: () => void;
  onOpenStatistics?: () => void;
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
  isSelectionMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  uiExperiments,
  onMainTabChange,
  onCategorySelect,
  onSubgroupSelect,
  onViewModeChange,
  onToggleSelectionMode,
  onSearchChange,
  onToggleSearch,
  onToggleFilter,
  onToggleView,
  onOpenSettings,
  onOpenStatistics,
  onFilterChange,
  onViewSettingsChange,
  onClosePanels,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [openDropdown, setOpenDropdown] = useState<'media' | 'game' | null>(null);
  const [hoveredCat, setHoveredCat] = useState<Category | null>(null);
  const [hoveredCatTop, setHoveredCatTop] = useState<number>(0);
  const hoverTimeoutRef = useRef<any>(null);
  const subMenuTimeoutRef = useRef<any>(null);

  // Search Mode: 'search' (Normal title/text search) vs 'tag' (Tag/year chip search)
  const [searchMode, setSearchMode] = useState<'search' | 'tag'>('search');
  const [searchTextInput, setSearchTextInput] = useState('');
  const [tagChips, setTagChips] = useState<string[]>([]);
  const [typedTagInput, setTypedTagInput] = useState('');

  // Reset to default 'search' mode whenever search is opened or closed
  useEffect(() => {
    if (isSearchOpen) {
      setSearchMode('search');
      setSearchTextInput(searchQuery);
      setTagChips([]);
      setTypedTagInput('');
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      setSearchMode('search');
      setSearchTextInput('');
      setTagChips([]);
      setTypedTagInput('');
    }
  }, [isSearchOpen]);

  const toggleSearchMode = () => {
    if (searchMode === 'search') {
      // Switch to Tag mode
      const initialChips = searchTextInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      setSearchMode('tag');
      setTagChips(initialChips);
      setTypedTagInput('');
      setSearchTextInput('');
      onSearchChange(initialChips.join(', '));
    } else {
      // Switch to Normal search mode
      const combined = [...tagChips, typedTagInput.trim()].filter(Boolean).join(' ');
      setSearchMode('search');
      setSearchTextInput(combined);
      setTagChips([]);
      setTypedTagInput('');
      onSearchChange(combined);
    }
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);
  };

  const handleRemoveTagChip = (indexToRemove: number) => {
    const updated = tagChips.filter((_, idx) => idx !== indexToRemove);
    setTagChips(updated);
    const combined = typedTagInput.trim()
      ? [...updated, typedTagInput.trim()].join(', ')
      : updated.join(', ');
    onSearchChange(combined);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = typedTagInput.trim();
      if (val) {
        if (!tagChips.some((c) => c.toLowerCase() === val.toLowerCase())) {
          const updated = [...tagChips, val];
          setTagChips(updated);
          onSearchChange(updated.join(', '));
        }
        setTypedTagInput('');
      }
    } else if (e.key === 'Backspace' && !typedTagInput && tagChips.length > 0) {
      e.preventDefault();
      handleRemoveTagChip(tagChips.length - 1);
    }
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(',')) {
      const parts = val.split(',').map((p) => p.trim()).filter(Boolean);
      const updated = [...tagChips];
      parts.forEach((p) => {
        if (!updated.some((c) => c.toLowerCase() === p.toLowerCase())) {
          updated.push(p);
        }
      });
      setTagChips(updated);
      setTypedTagInput('');
      onSearchChange(updated.join(', '));
    } else {
      setTypedTagInput(val);
      // Live filter with current tagChips + whatever is being actively typed
      const live = val.trim()
        ? [...tagChips, val.trim()].join(', ')
        : tagChips.join(', ');
      onSearchChange(live);
    }
  };

  const handleNormalSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTextInput(val);
    onSearchChange(val);
  };

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

  // Close dropdown or empty search on outside click
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#category-dropdown-container')) {
        setOpenDropdown(null);
        setHoveredCat(null);
      }
      if (isSearchOpen && !searchQuery.trim()) {
        if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
          onToggleSearch();
        }
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [isSearchOpen, searchQuery, onToggleSearch]);

  const activeFiltersCount =
    (filters.minRating > 0 ? 1 : 0) +
    (filters.watchingOnly ? 1 : 0) +
    (filters.followingOnly ? 1 : 0) +
    (filters.ankiFilter !== 'all' ? 1 : 0) +
    (filters.uncategorizedOnly ? 1 : 0) +
    (filters.gameStatus && filters.gameStatus !== 'all' ? 1 : 0);

  // Pure Hover handlers for Main Dropdown buttons with snappy 120ms delay
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
    }, 120);
  };

  // Hover handlers for Category items to align subcategory flyout vertically to the exact item
  const handleCatMouseEnter = (cat: Category, e: React.MouseEvent) => {
    if (subMenuTimeoutRef.current) clearTimeout(subMenuTimeoutRef.current);
    setHoveredCat(cat);
    const target = e.currentTarget as HTMLElement;
    if (target) {
      setHoveredCatTop(target.offsetTop);
    }
  };

  // Clicking the main button switches the tab and toggles dropdown
  const handleTabButtonClick = (tab: 'media' | 'game', e: React.MouseEvent) => {
    e.stopPropagation();
    if (mainTab !== tab) {
      if (isSearchOpen) {
        onToggleSearch();
      }
      onSearchChange('');
      setSearchTextInput('');
      setTagChips([]);
      setTypedTagInput('');
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
    if (isSearchOpen) {
      onToggleSearch();
    }
    onSearchChange('');
    setSearchTextInput('');
    setTagChips([]);
    setTypedTagInput('');

    if (mainTab !== targetTab) {
      onMainTabChange(targetTab);
    }
    onCategorySelect(catId);
    onSubgroupSelect(sub);
    setOpenDropdown(null);
    setHoveredCat(null);
  };

  return (
    <header
      className={`relative z-30 flex flex-col gap-3 py-3 transition-all duration-300 ${
        uiExperiments?.toolbarStyle === 'box'
          ? 'bg-neutral-900/80 p-3.5 rounded-2xl border border-white/10 shadow-lg'
          : uiExperiments?.toolbarStyle === 'glass'
          ? 'bg-white/[0.03] backdrop-blur-xl p-3.5 rounded-2xl border border-white/10 shadow-2xl'
          : uiExperiments?.toolbarStyle === 'floating'
          ? 'bg-neutral-900/90 backdrop-blur-md p-2.5 rounded-2xl border border-blue-500/30 shadow-2xl'
          : 'border-b border-white/10'
      }`}
    >
      {/* 3-Column Navigation Bar: Left: Breadcrumb + Count | Center: Tabs | Right: Tools */}
      <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-3 sm:gap-4 min-h-[38px]">
        {/* 1. LEFT SIDE: Clickable Breadcrumb & Item Count Badge */}
        <div className="flex items-center gap-2 min-w-0 justify-start order-2 md:order-1 flex-wrap">
          {/* Breadcrumb Navigation Pill */}
          <div
            id="active-breadcrumb-pill"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900/90 border border-white/10 text-xs text-neutral-300 h-8"
          >
            {/* Main Tab (Medya / Oyun) - Clickable! */}
            <button
              onClick={() => {
                if (isSearchOpen) {
                  onToggleSearch();
                }
                onSearchChange('');
                setSearchTextInput('');
                setTagChips([]);
                setTypedTagInput('');
                onCategorySelect(null);
                onSubgroupSelect(null);
              }}
              title="Tüm listeyi göster"
              className="text-neutral-300 hover:text-white font-medium hover:underline cursor-pointer transition-colors"
            >
              {mainTab === 'media' ? 'Medya' : 'Oyun'}
            </button>

            {/* Category Level - Clickable! */}
            {activeCatId !== null && (
              <>
                <span className="text-neutral-600">/</span>
                <button
                  onClick={() => {
                    if (isSearchOpen) {
                      onToggleSearch();
                    }
                    onSearchChange('');
                    setSearchTextInput('');
                    setTagChips([]);
                    setTypedTagInput('');
                    onSubgroupSelect(null);
                  }}
                  title={activeSub ? `${activeCategory?.name || 'Kategori'} geneline dön` : ''}
                  className={`font-semibold cursor-pointer transition-colors ${
                    activeSub
                      ? 'text-neutral-400 hover:text-white hover:underline'
                      : 'text-white'
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
                <span className="text-neutral-600">/</span>
                <span className="text-white font-semibold">{activeSub}</span>
              </>
            )}
          </div>

          {/* Simple Clean Count Badge (Only Number) - Click to toggle Selection Mode */}
          <button
            id="item-count-badge"
            onClick={onToggleSelectionMode}
            title={
              isSelectionMode
                ? 'Seçim modundan çık'
                : `${totalFilteredCount} yapım listeleniyor (Seçim modunu açmak için tıkla)`
            }
            className={`px-2.5 py-1 rounded-lg border font-bold text-xs transition-all duration-200 cursor-pointer ${
              isSelectionMode
                ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/40 ring-2 ring-blue-400/50 scale-105'
                : 'bg-neutral-800 border-white/10 text-neutral-200 hover:bg-neutral-700 hover:text-white hover:border-white/20'
            }`}
          >
            {totalFilteredCount}
          </button>

          {/* Active Uncategorized Filter Indicator Pill */}
          {filters.uncategorizedOnly && (
            <div
              id="active-uncategorized-indicator"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold animate-in fade-in"
            >
              <FolderX className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate max-w-[130px] sm:max-w-none">
                {activeCategory ? `Alt Kategorisiz (${activeCategory.name})` : 'Kategorisiz'}
              </span>
              <button
                type="button"
                id="remove-uncategorized-filter-btn"
                onClick={() => onFilterChange({ uncategorizedOnly: false })}
                title="Kategorisiz filtresini kaldır"
                className="p-0.5 ml-0.5 rounded hover:bg-rose-500/25 text-rose-300 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* 2. CENTER: Medya & Oyun Navigation Dropdown Buttons */}
        <div
          className="flex items-center justify-center gap-1.5 sm:gap-2.5 order-1 md:order-2"
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
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                mainTab === 'media'
                  ? 'bg-neutral-800 text-white shadow-sm border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
              }`}
            >
              <Film className="w-4 h-4 text-neutral-300" />
              <span>Medya</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-150 ${
                  openDropdown === 'media' ? 'rotate-180 text-white' : ''
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
                <div className="w-60 p-2 bg-[#181818]/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl space-y-1 relative">
                  {/* İzlenen / Takip Quick Item */}
                  <button
                    onClick={() => handleSelectCategoryFromMenu('media', TRACKED_TAB_ID)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                      mainTab === 'media' && activeCatId === TRACKED_TAB_ID
                        ? 'bg-neutral-800 text-white border border-white/20'
                        : 'text-amber-400/90 hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-amber-400">★</span> İzlenen & Takip
                    </span>
                    <span className="text-[10px] text-neutral-500">Özel Vitrin</span>
                  </button>

                  <div className="my-1 border-t border-white/10" />

                  {/* Categories */}
                  <div className="max-h-72 overflow-y-auto space-y-0.5 custom-scrollbar">
                    {categories.media.length === 0 ? (
                      <div className="py-2.5 px-3 text-center">
                        <p className="text-[11px] text-neutral-400">Henüz kategori yok</p>
                        <button
                          onClick={() => {
                            setOpenDropdown(null);
                            onOpenSettings();
                          }}
                          className="mt-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium hover:underline cursor-pointer"
                        >
                          + Kategori Tanımla
                        </button>
                      </div>
                    ) : (
                      categories.media.map((cat) => {
                      const isCatActive = mainTab === 'media' && activeCatId === cat.id;
                      const hasSubs = cat.subgroups && cat.subgroups.length > 0;
                      const isHovered = hoveredCat?.id === cat.id;

                      return (
                        <div
                          key={cat.id}
                          onMouseEnter={(e) => handleCatMouseEnter(cat, e)}
                          onClick={() => handleSelectCategoryFromMenu('media', cat.id, null)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isCatActive
                              ? 'bg-neutral-700 text-white shadow'
                              : isHovered
                              ? 'bg-neutral-800 text-white'
                              : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{cat.name}</span>
                          {hasSubs && (
                            <ChevronRight
                              className={`w-3.5 h-3.5 transition-colors ${
                                isCatActive || isHovered ? 'text-white' : 'text-neutral-500'
                              }`}
                            />
                          )}
                        </div>
                      );
                    }))}
                  </div>

                  {/* Absolute Positioned Right Flyout Submenu - Aligned with hovered category */}
                  {hoveredCat && hoveredCat.subgroups && hoveredCat.subgroups.length > 0 && (
                    <div
                      id="flyout-subgroups-menu"
                      style={{ top: `${Math.max(0, hoveredCatTop - 4)}px` }}
                      className="absolute left-full ml-1.5 w-52 p-2 bg-[#181818]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-100 z-50"
                      onMouseEnter={() => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      }}
                    >
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center justify-between border-b border-white/10 mb-1">
                        <span>{hoveredCat.name} Alt Grupları</span>
                      </div>

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
                                  ? 'bg-neutral-700 text-white font-semibold'
                                  : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
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
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                mainTab === 'game'
                  ? 'bg-neutral-800 text-white shadow-sm border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-neutral-300" />
              <span>Oyun</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-150 ${
                  openDropdown === 'game' ? 'rotate-180 text-white' : ''
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
                <div className="w-60 p-2 bg-[#181818]/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl space-y-1 relative">
                  {/* Categories */}
                  <div className="max-h-72 overflow-y-auto space-y-0.5 custom-scrollbar">
                    {categories.game.length === 0 ? (
                      <div className="py-2.5 px-3 text-center">
                        <p className="text-[11px] text-neutral-400">Henüz kategori yok</p>
                        <button
                          onClick={() => {
                            setOpenDropdown(null);
                            onOpenSettings();
                          }}
                          className="mt-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium hover:underline cursor-pointer"
                        >
                          + Kategori Tanımla
                        </button>
                      </div>
                    ) : (
                      categories.game.map((cat) => {
                      const isCatActive = mainTab === 'game' && activeCatId === cat.id;
                      const hasSubs = cat.subgroups && cat.subgroups.length > 0;
                      const isHovered = hoveredCat?.id === cat.id;

                      return (
                        <div
                          key={cat.id}
                          onMouseEnter={(e) => handleCatMouseEnter(cat, e)}
                          onClick={() => handleSelectCategoryFromMenu('game', cat.id, null)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isCatActive
                              ? 'bg-neutral-700 text-white shadow'
                              : isHovered
                              ? 'bg-neutral-800 text-white'
                              : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{cat.name}</span>
                          {hasSubs && (
                            <ChevronRight
                              className={`w-3.5 h-3.5 transition-colors ${
                                isCatActive || isHovered ? 'text-white' : 'text-neutral-500'
                              }`}
                            />
                          )}
                        </div>
                      );
                    }))}
                  </div>

                  {/* Absolute Positioned Right Flyout Submenu */}
                  {hoveredCat && hoveredCat.subgroups && hoveredCat.subgroups.length > 0 && (
                    <div
                      id="flyout-game-subgroups-menu"
                      style={{ top: `${Math.max(0, hoveredCatTop - 4)}px` }}
                      className="absolute left-full ml-1.5 w-52 p-2 bg-[#181818]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-100 z-50"
                      onMouseEnter={() => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      }}
                    >
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center justify-between border-b border-white/10 mb-1">
                        <span>{hoveredCat.name} Alt Grupları</span>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
                        {hoveredCat.subgroups.map((sub) => {
                          const isSubActive =
                            mainTab === 'game' && activeCatId === hoveredCat.id && activeSub === sub;
                          return (
                            <button
                              key={sub}
                              onClick={() => handleSelectCategoryFromMenu('game', hoveredCat.id, sub)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors truncate cursor-pointer ${
                                isSubActive
                                  ? 'bg-neutral-700 text-white font-semibold'
                                  : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
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
          className="flex items-center justify-end gap-1.5 relative order-3 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Izgara / Tier List Switcher and Undo / Redo / Export / Import Controls */}
          {activeCategory && activeCategory.tierEnabled && (
            <>
              {/* Undo & Redo (Only in Tier mode, positioned to the left of Izgara/Tier) */}
              {viewMode === 'tier' && (
                <div className="flex items-center p-0.5 bg-neutral-900 rounded-lg border border-white/10">
                  <button
                    id="tier-undo-btn"
                    onClick={onUndo}
                    disabled={!canUndo}
                    title="Geri Al (Ctrl+Z)"
                    className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                      canUndo
                        ? 'text-neutral-200 hover:text-white hover:bg-neutral-800 cursor-pointer active:scale-95'
                        : 'text-neutral-600 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id="tier-redo-btn"
                    onClick={onRedo}
                    disabled={!canRedo}
                    title="İleri Al (Ctrl+Y)"
                    className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                      canRedo
                        ? 'text-neutral-200 hover:text-white hover:bg-neutral-800 cursor-pointer active:scale-95'
                        : 'text-neutral-600 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* View Mode Switcher */}
              <div className="flex items-center p-0.5 bg-neutral-900 rounded-lg border border-white/10 gap-0.5">
                <button
                  id="viewmode-grid-btn"
                  onClick={() => onViewModeChange('grid')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-neutral-700 text-white shadow font-semibold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Izgara
                </button>
                <button
                  id="viewmode-tier-btn"
                  onClick={() => onViewModeChange('tier')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    viewMode === 'tier'
                      ? 'bg-neutral-700 text-white shadow font-semibold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" /> Tier List
                </button>
              </div>
              <div className="h-4 w-[1px] bg-white/15 mx-1" aria-hidden="true" />
            </>
          )}

          {/* Search Box / Toggle with Switchable Mode (Search <-> Tag) */}
          {isSearchOpen ? (
            <div
              ref={searchContainerRef}
              className="flex items-center gap-1.5 bg-neutral-900 border border-white/20 rounded-lg px-2 min-w-[220px] max-w-sm sm:max-w-md h-8 animate-in fade-in"
            >
              {/* Mode Toggle Button: Click to switch between Normal Search and Tag Search */}
              <button
                type="button"
                id="search-mode-toggle-btn"
                onClick={toggleSearchMode}
                title={
                  searchMode === 'search'
                    ? 'Etiket Arama Moduna Geç (🏷️)'
                    : 'Normal Arama Moduna Geç (🔍)'
                }
                className={`p-1 rounded-md transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  searchMode === 'tag'
                    ? 'bg-blue-600/40 text-white border border-blue-400/50'
                    : 'text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {searchMode === 'tag' ? (
                  <Tag className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Search className="w-3.5 h-3.5 text-neutral-300" />
                )}
              </button>

              {/* TAG MODE: Render oval tag chips */}
              {searchMode === 'tag' &&
                tagChips.map((chip, index) => (
                  <span
                    key={`${chip}_${index}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/25 border border-blue-500/40 text-blue-300 text-[11px] font-medium shrink-0 animate-in fade-in zoom-in-95 duration-100"
                  >
                    <span>{chip}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTagChip(index)}
                      className="hover:text-white rounded-full p-0.5 cursor-pointer text-blue-400 hover:bg-blue-500/30"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}

              {/* INPUT ELEMENT: Changes behavior based on searchMode */}
              {searchMode === 'tag' ? (
                <input
                  ref={searchInputRef}
                  id="search-header-input"
                  type="text"
                  value={typedTagInput}
                  onChange={handleTagInputChange}
                  onKeyDown={handleTagKeyDown}
                  placeholder={
                    tagChips.length === 0
                      ? 'Etiket ara (örn: mappa, 2024)...'
                      : '+ etiket...'
                  }
                  className="flex-1 min-w-[90px] bg-transparent text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none py-0.5"
                />
              ) : (
                <input
                  ref={searchInputRef}
                  id="search-header-input"
                  type="text"
                  value={searchTextInput}
                  onChange={handleNormalSearchChange}
                  placeholder="Yapım ara..."
                  className="flex-1 min-w-[120px] bg-transparent text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none py-0.5"
                />
              )}

              {/* Clear / Close Button */}
              <button
                type="button"
                id="search-close-btn"
                onClick={() => {
                  setSearchTextInput('');
                  setTagChips([]);
                  setTypedTagInput('');
                  setSearchMode('search');
                  onSearchChange('');
                  onToggleSearch();
                }}
                className="text-neutral-400 hover:text-white p-1 rounded hover:bg-white/5 text-xs ml-auto cursor-pointer shrink-0"
                title="Aramayı Kapat ve Temizle"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="search-toggle-btn"
              onClick={onToggleSearch}
              title="Arama (🔍)"
              className={`h-8 w-8 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                searchQuery.trim()
                  ? 'bg-blue-600/30 border-blue-500/50 text-blue-200 shadow-sm'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 border-white/10 text-neutral-300 hover:text-white'
              }`}
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
              className={`h-8 w-8 rounded-lg border transition-all relative cursor-pointer flex items-center justify-center ${
                isFilterOpen || activeFiltersCount > 0
                  ? 'bg-neutral-800 border-white/30 text-white shadow-sm'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 border-white/10 text-neutral-300 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-neutral-950 text-[10px] font-bold flex items-center justify-center shadow">
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
                activeCategoryName={activeCategory?.name || null}
                activeSub={activeSub || null}
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
              className={`h-8 w-8 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                isViewOpen
                  ? 'bg-neutral-800 border-white/30 text-white shadow-sm'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 border-white/10 text-neutral-300 hover:text-white'
              }`}
            >
              <Eye className="w-4 h-4" />
            </button>

            {isViewOpen && (
              <ViewPanel
                settings={viewSettings}
                mainTab={mainTab}
                onChange={onViewSettingsChange}
                onClose={onClosePanels}
              />
            )}
          </div>

          {/* Divider before Settings */}
          <div className="h-4 w-[1px] bg-white/15 mx-0.5" aria-hidden="true" />

          {/* Settings Modal Trigger (Far Right) */}
          <button
            id="settings-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            title="Ayarlar (⚙)"
            className="h-8 w-8 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer flex items-center justify-center"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
