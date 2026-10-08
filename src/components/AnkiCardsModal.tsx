import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ArchiveItem, Category, MainTabType, AnkiBlurBox } from '../types';
import { AnkiEditorModal } from './AnkiEditorModal';
import { ItemDetailModal } from './ItemDetailModal';
import { CustomDialog, DialogOptions } from './CustomDialog';
import { initAnkiCard } from '../utils/ankiUtils';
import {
  X,
  Search,
  Eye,
  EyeOff,
  ChevronDown,
  Layers,
  Image as ImageIcon,
  Tag,
  Film,
  Gamepad2,
  BookOpen,
  Edit3,
  ExternalLink,
  RotateCcw,
  Trash2,
  Check,
  ArrowLeft,
} from 'lucide-react';

interface AnkiCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ArchiveItem[];
  categories: {
    media: Category[];
    game: Category[];
    book: Category[];
  };
  virtualTimeOffsetMs?: number;
  onUpdateItem?: (updatedItem: ArchiveItem) => void;
  onDeleteItem?: (id: string) => void;
}

type TabFilter = 'all' | 'media' | 'game' | 'book';

interface ActiveFilter {
  tab: TabFilter;
  catId?: string | null;
  sub?: string | null;
}

interface CardRowProps {
  item: ArchiveItem;
  isSelected: boolean;
  categoryLabel: string;
  onSelect: (id: string) => void;
}

/**
 * Pure memoized row component for list items.
 * Prevents re-rendering the entire list when only selectedItemId changes.
 */
const CardRow = React.memo<CardRowProps>(({ item, isSelected, categoryLabel, onSelect }) => {
  return (
    <div
      id={`anki-card-item-${item.id}`}
      onClick={() => onSelect(item.id)}
      className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors select-none ${
        isSelected
          ? 'bg-indigo-600/25 border-l-4 border-indigo-500 text-white shadow-sm'
          : 'hover:bg-white/[0.04] text-slate-300'
      }`}
    >
      {/* 24x32 Mini Poster */}
      <div className="w-6 h-8 rounded shrink-0 overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="w-3 h-3 text-slate-500" />
        )}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0 pr-1">
        <div
          className={`text-xs font-semibold truncate ${
            isSelected ? 'text-white' : 'text-slate-200'
          }`}
        >
          {item.title}
        </div>
      </div>

      {/* Right-aligned category badge */}
      <div className="shrink-0 text-[10px] text-slate-400/80 font-medium max-w-[85px] truncate">
        {categoryLabel}
      </div>
    </div>
  );
});
CardRow.displayName = 'CardRow';

export const AnkiCardsModal: React.FC<AnkiCardsModalProps> = ({
  isOpen,
  onClose,
  items,
  categories,
  virtualTimeOffsetMs = 0,
  onUpdateItem,
  onDeleteItem,
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ tab: 'all' });
  const [openDropdown, setOpenDropdown] = useState<'media' | 'game' | 'book' | null>(null);

  // Hover timeout ref for snappy 120ms desktop hover handling
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Selected card in the list
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Mobile navigation view: 'list' | 'detail' (for screens < 768px)
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Blur preview toggle (true = blurs visible, false = revealed)
  const [isBlurHidden, setIsBlurHidden] = useState(false);

  // Modals & Dialog State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);

  // Keyboard navigation & search input refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Filter only items with anki === true
  const ankiItems = useMemo(() => {
    return items.filter((item) => item.anki === true);
  }, [items]);

  // Derive active category and subgroup tree strictly from items that have anki === true
  const dynamicCategoryTabs = useMemo(() => {
    const tabsConfig: { key: 'media' | 'game' | 'book'; label: string; icon: React.ReactNode }[] = [
      { key: 'media', label: 'Medya', icon: <Film className="w-3 h-3" /> },
      { key: 'game', label: 'Oyun', icon: <Gamepad2 className="w-3 h-3" /> },
      { key: 'book', label: 'Kitap', icon: <BookOpen className="w-3 h-3" /> },
    ];

    return tabsConfig
      .map((tab) => {
        const tabAnkiItems = ankiItems.filter((it) => it.mainTab === tab.key);
        if (tabAnkiItems.length === 0) return null;

        const catMap = new Map<string, { id: string; name: string; count: number; subs: Set<string> }>();
        const rawCats = categories[tab.key] || [];

        tabAnkiItems.forEach((it) => {
          const foundCat = rawCats.find((c) => c.id === it.cat);
          const catId = foundCat ? foundCat.id : it.cat;
          const catName = foundCat ? foundCat.name : it.cat;

          if (!catMap.has(catId)) {
            catMap.set(catId, { id: catId, name: catName, count: 0, subs: new Set<string>() });
          }
          const entry = catMap.get(catId)!;
          entry.count++;
          if (it.sub && it.sub.trim()) {
            entry.subs.add(it.sub);
          }
        });

        const activeCats = Array.from(catMap.values())
          .map((entry) => ({
            id: entry.id,
            name: entry.name,
            count: entry.count,
            subs: Array.from(entry.subs).sort((a, b) => a.localeCompare(b, 'tr')),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

        return {
          key: tab.key,
          label: tab.label,
          icon: tab.icon,
          totalCount: tabAnkiItems.length,
          categories: activeCats,
        };
      })
      .filter(Boolean) as {
        key: 'media' | 'game' | 'book';
        label: string;
        icon: React.ReactNode;
        totalCount: number;
        categories: { id: string; name: string; count: number; subs: string[] }[];
      }[];
  }, [ankiItems, categories]);

  // Desktop Hover Handlers (Snappy 120ms timeout as in HeaderTabs.tsx)
  const handleMouseEnterTab = (tab: 'media' | 'game' | 'book') => {
    // Only trigger hover on non-touch devices (matchMedia pointer: fine)
    if (window.matchMedia('(pointer: fine)').matches) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      setOpenDropdown(tab);
    }
  };

  const handleMouseLeaveTab = () => {
    if (window.matchMedia('(pointer: fine)').matches) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
        setOpenDropdown(null);
      }, 120);
    }
  };

  // Tab Click Handler (Desktop vs Mobile dual-step logic)
  const handleTabButtonClick = (tab: 'media' | 'game' | 'book') => {
    const isTouchDevice = !window.matchMedia('(pointer: fine)').matches;

    if (isTouchDevice) {
      // Mobile / Touch behavior (HeaderTabs.tsx lines 520-580 pattern):
      // Step 1: If coming from another tab, immediately select this tab and DO NOT open dropdown.
      if (activeFilter.tab !== tab) {
        setActiveFilter({ tab });
        setOpenDropdown(null);
      } else {
        // Step 2: If already on this tab and clicked again, toggle the dropdown menu!
        setOpenDropdown((prev) => (prev === tab ? null : tab));
      }
    } else {
      // Desktop behavior:
      // Clicking the tab button directly selects all of this tab and closes dropdown
      setActiveFilter({ tab });
      setOpenDropdown(null);
    }
  };

  // Filter items based on active category & search query
  const filteredItems = useMemo(() => {
    let result = ankiItems;

    // Category / Tab filtering
    if (activeFilter.tab !== 'all') {
      result = result.filter((item) => item.mainTab === activeFilter.tab);
      if (activeFilter.catId) {
        result = result.filter((item) => item.cat === activeFilter.catId);
      }
      if (activeFilter.sub) {
        result = result.filter((item) => item.sub === activeFilter.sub);
      }
    }

    // Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        const titleMatch = item.title.toLowerCase().includes(q);
        const tagMatch = item.ankiFrontTags?.some((t) => t.toLowerCase().includes(q));
        const catList = categories[item.mainTab] || [];
        const cat = catList.find((c) => c.id === item.cat);
        const catMatch = cat?.name.toLowerCase().includes(q) || false;
        const subMatch = item.sub?.toLowerCase().includes(q) || false;
        return titleMatch || tagMatch || catMatch || subMatch;
      });
    }

    // A to Z alphabetical sorting (Turkish locale)
    return [...result].sort((a, b) =>
      a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' })
    );
  }, [ankiItems, activeFilter, searchQuery, categories]);

  // Auto-select first item when list changes or on open
  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedItemId(null);
      return;
    }
    // If selected item is not in filtered list, select first
    if (!selectedItemId || !filteredItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(filteredItems[0].id);
    }
  }, [filteredItems, selectedItemId]);

  // Currently selected item
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return filteredItems[0] || null;
    return filteredItems.find((i) => i.id === selectedItemId) || filteredItems[0] || null;
  }, [filteredItems, selectedItemId]);

  // Helper to get category text
  const getCategoryPath = useCallback(
    (item: ArchiveItem): string => {
      const tabName =
        item.mainTab === 'media' ? 'Medya' : item.mainTab === 'game' ? 'Oyun' : 'Kitap';
      const catList = categories[item.mainTab] || [];
      const cat = catList.find((c) => c.id === item.cat);
      const catName = cat ? cat.name : item.cat;
      if (item.sub) {
        return `${tabName} > ${catName} > ${item.sub}`;
      }
      return `${tabName} > ${catName}`;
    },
    [categories]
  );

  const getCategoryShortLabel = useCallback(
    (item: ArchiveItem): string => {
      const catList = categories[item.mainTab] || [];
      const cat = catList.find((c) => c.id === item.cat);
      return cat ? cat.name : item.cat;
    },
    [categories]
  );

  // Stable ref for keyboard handler
  const stateRef = useRef({
    filteredItems,
    selectedItemId,
    isModalActive: !isEditorOpen && !isDetailOpen && !dialogOptions,
  });
  useEffect(() => {
    stateRef.current = {
      filteredItems,
      selectedItemId,
      isModalActive: !isEditorOpen && !isDetailOpen && !dialogOptions,
    };
  });

  // Keyboard navigation: Arrow Up, Arrow Down, Space
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const { isModalActive } = stateRef.current;
      if (!isModalActive) return;

      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

      // Space toggles blur preview (ONLY when not typing in search/input)
      if (e.code === 'Space' && !isInputFocused) {
        e.preventDefault();
        setIsBlurHidden((prev) => !prev);
        return;
      }

      // Arrow Down from search input: focus down to first item in the list
      if (e.key === 'ArrowDown' && activeEl === searchInputRef.current) {
        e.preventDefault();
        const { filteredItems: currentItems } = stateRef.current;
        if (currentItems.length > 0) {
          searchInputRef.current?.blur();
          setSelectedItemId(currentItems[0].id);
        }
        return;
      }

      // Arrow navigation inside list
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isInputFocused) {
        e.preventDefault();
        const { filteredItems: currentItems, selectedItemId: currentId } = stateRef.current;
        if (currentItems.length === 0) return;

        const currentIndex = currentItems.findIndex((i) => i.id === currentId);
        if (currentIndex === -1) {
          setSelectedItemId(currentItems[0].id);
          return;
        }

        let nextIndex = currentIndex;
        if (e.key === 'ArrowDown') {
          nextIndex = Math.min(currentIndex + 1, currentItems.length - 1);
        } else if (e.key === 'ArrowUp') {
          nextIndex = Math.max(currentIndex - 1, 0);
        }

        if (nextIndex !== currentIndex) {
          setSelectedItemId(currentItems[nextIndex].id);
          const el = document.getElementById(`anki-card-item-${currentItems[nextIndex].id}`);
          el?.scrollIntoView({ block: 'nearest' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectCard = useCallback((id: string) => {
    setSelectedItemId(id);
    setMobileView('detail');
  }, []);

  // Action: Reset card progress (Kartı Sıfırla)
  const handlePromptResetCard = () => {
    if (!selectedItem) return;
    setDialogOptions({
      type: 'confirm',
      title: 'Kartı Sıfırla',
      message: `"${selectedItem.title}" kartının çalışma ve tekrar geçmişi sıfırlanacaktır. Görsel ve blur ayarları korunur. Devam etmek istiyor musunuz?`,
      confirmText: 'Kartı Sıfırla',
      cancelText: 'Vazgeç',
      onConfirm: () => {
        const virtualNow = new Date(Date.now() + virtualTimeOffsetMs);
        const newCard = initAnkiCard(virtualNow);
        if (onUpdateItem) {
          onUpdateItem({
            ...selectedItem,
            ankiCard: newCard,
          });
        }
      },
    });
  };

  // Action: Remove card from Anki deck (Anki'den Çıkar)
  const handlePromptRemoveFromAnki = () => {
    if (!selectedItem) return;
    setDialogOptions({
      type: 'confirm',
      title: "Anki'den Çıkar",
      message: `"${selectedItem.title}" Anki destesinden çıkarılacaktır. Eser arşivinizde kalmaya devam eder. Emin misiniz?`,
      confirmText: 'Desteden Çıkar',
      cancelText: 'Vazgeç',
      isDestructive: true,
      onConfirm: () => {
        const currentIndex = filteredItems.findIndex((i) => i.id === selectedItem.id);
        let nextSelectedId: string | null = null;
        if (filteredItems.length > 1) {
          if (currentIndex < filteredItems.length - 1) {
            nextSelectedId = filteredItems[currentIndex + 1].id;
          } else {
            nextSelectedId = filteredItems[currentIndex - 1].id;
          }
        }
        setSelectedItemId(nextSelectedId);

        if (onUpdateItem) {
          onUpdateItem({
            ...selectedItem,
            anki: false,
          });
        }
      },
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        id="anki-cards-modal-backdrop"
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <div
          id="anki-cards-modal-window"
          className="w-full max-w-5xl h-[88vh] sm:h-[720px] max-h-[92vh] bg-[#14161f] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ============================================================== */}
          {/* TOP HEADER TOOLBAR                                             */}
          {/* ============================================================== */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-5 py-3 border-b border-white/10 bg-white/[0.02]">
            {/* Left: Title & Count */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-white tracking-wide">Kartlar</h2>
                <span className="text-xs font-mono font-medium text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  {filteredItems.length}
                  {filteredItems.length !== ankiItems.length && ` / ${ankiItems.length}`}
                </span>
              </div>
            </div>

            {/* Middle/Right: Search Box & Dynamic Category Filters */}
            <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 min-w-0" ref={dropdownRef}>
              {/* Live Search Input */}
              <div className="relative flex-1 max-w-xs min-w-[130px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Kart veya etiket ara..."
                  className="w-full pl-8 pr-7 py-1.5 bg-black/30 border border-white/10 hover:border-white/20 focus:border-indigo-500/60 focus:bg-black/50 rounded-lg text-xs text-white placeholder-slate-500 outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="Aramayı Temizle"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Menus (Available on both desktop & mobile) */}
              <div className="flex items-center gap-1 text-xs">
                {/* [ Tümü ] */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter({ tab: 'all' });
                    setOpenDropdown(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeFilter.tab === 'all'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  Tümü
                </button>

                {/* Dynamic Tab Dropdowns (Medya, Oyun, Kitap) */}
                {dynamicCategoryTabs.map((tab) => (
                  <div
                    key={tab.key}
                    className="relative"
                    onMouseEnter={() => handleMouseEnterTab(tab.key)}
                    onMouseLeave={handleMouseLeaveTab}
                  >
                    <button
                      type="button"
                      onClick={() => handleTabButtonClick(tab.key)}
                      className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                        activeFilter.tab === tab.key
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                      <ChevronDown
                        className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${
                          openDropdown === tab.key ? 'rotate-180 text-white' : ''
                        }`}
                      />
                    </button>

                    {/* Dropdown Menu (No artificial "Tüm Medya" header button; direct categories & subgroups) */}
                    {openDropdown === tab.key && (
                      <div
                        className="absolute right-0 top-full mt-1.5 w-60 sm:w-64 bg-[#181a24] border border-white/15 rounded-xl shadow-2xl z-50 p-2 text-xs max-h-72 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100 space-y-1.5"
                        onMouseEnter={() => {
                          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                        }}
                      >
                        {tab.categories.map((cat) => {
                          const isCatActive =
                            activeFilter.tab === tab.key && activeFilter.catId === cat.id;

                          return (
                            <div
                              key={cat.id}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isCatActive
                                  ? 'bg-white/10 border-indigo-500/40'
                                  : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'
                              }`}
                            >
                              {/* Category Main Row */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveFilter({ tab: tab.key, catId: cat.id });
                                  setOpenDropdown(null);
                                }}
                                className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-200 hover:text-white transition-colors text-left cursor-pointer"
                              >
                                <span className="truncate pr-2">{cat.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    ({cat.count})
                                  </span>
                                  {isCatActive && !activeFilter.sub && (
                                    <Check className="w-3.5 h-3.5 text-indigo-400" />
                                  )}
                                </div>
                              </button>

                              {/* Category Subgroups Pills (If Any) */}
                              {cat.subs && cat.subs.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap pt-1 mt-1 border-t border-white/5 px-1">
                                  {cat.subs.map((sub) => {
                                    const isSubActive = isCatActive && activeFilter.sub === sub;
                                    return (
                                      <button
                                        key={sub}
                                        type="button"
                                        onClick={() => {
                                          setActiveFilter({ tab: tab.key, catId: cat.id, sub });
                                          setOpenDropdown(null);
                                        }}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                                          isSubActive
                                            ? 'bg-indigo-600 text-white shadow'
                                            : 'bg-neutral-800/80 text-slate-300 hover:text-white border border-white/10 hover:border-white/20'
                                        }`}
                                      >
                                        {sub}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Close Modal Button */}
              <button
                type="button"
                onClick={onClose}
                title="Kapat"
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* MAIN MASTER-DETAIL CONTENT                                     */}
          {/* ============================================================== */}
          <div className="flex-1 flex overflow-hidden">
            {/* ------------------------------------------------------------ */}
            {/* LEFT COLUMN: A-Z Cards List (Memoized rows)                  */}
            {/* ------------------------------------------------------------ */}
            <div
              ref={listContainerRef}
              className={`${
                mobileView === 'detail' ? 'hidden md:flex' : 'flex'
              } w-full md:w-5/12 lg:w-4/12 border-r border-white/10 overflow-y-auto custom-scrollbar flex-col bg-black/10`}
            >
              {filteredItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                  <Layers className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-xs font-medium text-slate-400">
                    {ankiItems.length === 0
                      ? 'Henüz Anki destesinde kart bulunmuyor.'
                      : 'Filtreye uygun kart bulunamadı.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5 font-sans">
                  {filteredItems.map((item) => (
                    <CardRow
                      key={item.id}
                      item={item}
                      isSelected={selectedItem?.id === item.id}
                      categoryLabel={getCategoryShortLabel(item)}
                      onSelect={handleSelectCard}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* RIGHT COLUMN: Selected Card Live Preview & Actions           */}
            {/* ------------------------------------------------------------ */}
            <div
              className={`${
                mobileView === 'list' ? 'hidden md:flex' : 'flex'
              } flex-1 flex-col overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-gradient-to-b from-transparent to-black/20`}
            >
              {/* Mobile Back Button (Only on screen < 768px) */}
              <div className="md:hidden mb-2">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Kartlara Dön</span>
                </button>
              </div>

              {selectedItem ? (
                <div className="flex flex-col items-center max-w-md mx-auto w-full my-auto space-y-4 sm:space-y-5">
                  {/* Visual Poster & Live Blur Boxes */}
                  <div className="relative w-56 sm:w-64 aspect-[2/3] max-h-[380px] rounded-xl overflow-hidden border border-white/15 bg-black/40 shadow-2xl group select-none">
                    {selectedItem.thumbnail ? (
                      <img
                        key={selectedItem.id}
                        src={selectedItem.thumbnail}
                        alt={selectedItem.title}
                        loading="eager"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                        <ImageIcon className="w-12 h-12 mb-2 opacity-40" />
                        <span className="text-xs">Poster Görseli Yok</span>
                      </div>
                    )}

                    {/* Render Live Blur Boxes (GPU accelerated) */}
                    {!isBlurHidden &&
                      selectedItem.ankiMainBlurs &&
                      selectedItem.ankiMainBlurs.map((box: AnkiBlurBox) => (
                        <div
                          key={box.id}
                          className="absolute bg-black/60 backdrop-blur-md border border-white/20 rounded shadow-md pointer-events-none transition-opacity duration-150"
                          style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            width: `${box.width}%`,
                            height: `${box.height}%`,
                            transform: 'translateZ(0)',
                            willChange: 'transform',
                          }}
                        />
                      ))}

                    {/* Toggle Blur Preview Button - Compact 28x28 icon tightly pinned to top-right */}
                    <button
                      type="button"
                      onClick={() => setIsBlurHidden((prev) => !prev)}
                      title={
                        isBlurHidden
                          ? "Blur'ları Göster (Space)"
                          : "Blur'ları Kaldır / Önizle (Space)"
                      }
                      aria-label="Blur Aç / Kapat"
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-md bg-black/70 hover:bg-black/90 active:scale-95 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer opacity-90 hover:opacity-100"
                    >
                      {isBlurHidden ? (
                        <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-indigo-300" />
                      )}
                    </button>
                  </div>

                  {/* Card Info Details */}
                  <div className="w-full text-center space-y-1.5">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                      {selectedItem.title}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      {getCategoryPath(selectedItem)}
                    </p>

                    {/* Front Tags if present */}
                    {selectedItem.ankiFrontTags && selectedItem.ankiFrontTags.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                        {selectedItem.ankiFrontTags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 text-[10px] font-medium flex items-center gap-1"
                          >
                            <Tag className="w-2.5 h-2.5 text-indigo-400" />
                            <span>{tag}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4 Functional Action Buttons (Stage 2 Exact Naming) */}
                  <div className="w-full pt-1 sm:pt-2 grid grid-cols-2 gap-2 text-xs">
                    {/* [ ✏️ Anki Editörü Aç ] */}
                    <button
                      type="button"
                      onClick={() => setIsEditorOpen(true)}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer hover:border-indigo-500/40"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Anki Editörü Aç</span>
                    </button>

                    {/* [ 👁️ Kartı Düzenle ] */}
                    <button
                      type="button"
                      onClick={() => setIsDetailOpen(true)}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer hover:border-emerald-500/40"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Kartı Düzenle</span>
                    </button>

                    {/* [ 🔄 Kartı Sıfırla ] */}
                    <button
                      type="button"
                      onClick={handlePromptResetCard}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer hover:border-amber-500/40"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Kartı Sıfırla</span>
                    </button>

                    {/* [ 🗑️ Anki'den Çıkar ] */}
                    <button
                      type="button"
                      onClick={handlePromptRemoveFromAnki}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-rose-500/20 border border-white/10 text-slate-200 hover:text-rose-200 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer hover:border-rose-500/40"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Anki&apos;den Çıkar</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                  <Layers className="w-12 h-12 opacity-30" />
                  <p className="text-sm font-medium text-slate-400">Kart Seçilmedi</p>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Önizlemesini görmek için sol listeden bir karta tıklayın veya yön tuşlarını kullanın.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Anki Editor Modal (Direct Blur & Scene Editor) */}
      {isEditorOpen && selectedItem && (
        <AnkiEditorModal
          isOpen={isEditorOpen}
          itemTitle={selectedItem.title}
          initialThumbnail={selectedItem.thumbnail}
          initialMainBlurs={selectedItem.ankiMainBlurs}
          initialExtraImages={selectedItem.ankiExtraImages}
          onApply={(data) => {
            if (onUpdateItem && selectedItem) {
              onUpdateItem({
                ...selectedItem,
                thumbnail: data.thumbnail,
                ankiMainBlurs: data.mainBlurs,
                ankiExtraImages: data.extraImages,
              });
            }
            setIsEditorOpen(false);
          }}
          onClose={() => setIsEditorOpen(false)}
        />
      )}

      {/* Item Detail Modal (Full Archive Card Inspection & Edit) */}
      {isDetailOpen && selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          categories={categories[selectedItem.mainTab] || []}
          allItems={items}
          onSave={(updated) => {
            if (onUpdateItem) onUpdateItem(updated);
          }}
          onDelete={(id) => {
            if (onDeleteItem) onDeleteItem(id);
            setIsDetailOpen(false);
          }}
          onClose={() => setIsDetailOpen(false)}
        />
      )}

      {/* Confirmation Dialog (Reset / Remove) */}
      <CustomDialog options={dialogOptions} onClose={() => setDialogOptions(null)} />
    </>
  );
};
