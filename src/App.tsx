import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AppData,
  ArchiveItem,
  Category,
  FilterState,
  MainTabType,
  TierRow,
  ViewSettings,
  UiExperimentsState,
  AppTheme,
} from './types';
import { INITIAL_DATA } from './data/initialData';
import {
  getStoredDirectoryHandle,
  storeDirectoryHandle,
  verifyPermission,
  readDataFromFolder,
  writeDataToFolder,
  loadDataFromLocalStorage,
  saveDataToLocalStorage,
  loadDataFromIndexedDB,
  safeLocalStorageSet,
  safeLocalStorageGet,
  deleteImageFromFolder,
  exportTierListBackup,
  parseTierListBackupFile,
  checkDirectoryHandleAccessibility,
} from './utils/fileSystem';
import { sortArchiveItems } from './utils/sortUtils';

import { HeaderTabs, TRACKED_TAB_ID } from './components/HeaderTabs';
import { ItemCard } from './components/ItemCard';
import { TrackedView } from './components/TrackedView';
import { TierListView } from './components/TierListView';
import { ItemDetailModal } from './components/ItemDetailModal';
import { AddItemModal } from './components/AddItemModal';
import { SettingsModal } from './components/SettingsModal';
import { StatisticsModal } from './components/StatisticsModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { BulkMoveModal } from './components/BulkMoveModal';
import { CustomDialog, CustomDialogOptions } from './components/CustomDialog';
import {
  Plus,
  BarChart3,
  CheckSquare,
  Square,
  Trash2,
  FolderInput,
  X,
  Sparkles,
  ChevronDown,
  Check,
  RotateCcw,
  Layers,
  FlaskConical,
  Palette,
} from 'lucide-react';

export default function App() {
  // --- Persistent App Data State ---
  const [appData, setAppData] = useState<AppData>(() => {
    return loadDataFromLocalStorage() || INITIAL_DATA;
  });

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [dialogOptions, setDialogOptions] = useState<CustomDialogOptions | null>(null);

  // --- Bulk Selection State ---
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);

  // --- Active Navigation & Filter States ---
  const [mainTab, setMainTab] = useState<MainTabType>('media');
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'tier'>('grid');

  // Toolbar toggles & inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ArchiveItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ArchiveItem | null>(null);
  const [previewItem, setPreviewItem] = useState<ArchiveItem | null>(null);

  // UI Experiments State for visual appearance and atmosphere
  const [uiExperiments, setUiExperiments] = useState<UiExperimentsState>(() => {
    const saved = safeLocalStorageGet('yapim_ui_experiments');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const cardVignette =
          parsed.cardVignette === 'top'
            ? 'bottom'
            : parsed.cardVignette || (parsed.cardEffect === 'vignette' ? 'bottom' : 'none');
        const toolbarStyle = parsed.toolbarStyle === 'floating' ? 'default' : (parsed.toolbarStyle || 'default');
        const cardRadius = parsed.cardRadius === 'soft' ? 'normal' : (parsed.cardRadius || 'normal');
        const badgeDensity = parsed.badgeDensity === 'compact' ? 'full' : (parsed.badgeDensity || 'full');

        return {
          toolbarStyle,
          cardVignette: cardVignette as any,
          cardRadius,
          cardHoverMotion: parsed.cardHoverMotion || 'zoom',
          bgAtmosphere: parsed.bgAtmosphere === 'topglow' ? 'default' : (parsed.bgAtmosphere || 'default'),
          badgeStyle: parsed.badgeStyle || 'default',
          badgeDensity,
        };
      } catch {}
    }
    return {
      toolbarStyle: 'default',
      cardVignette: 'none',
      cardRadius: 'normal',
      cardHoverMotion: 'zoom',
      bgAtmosphere: 'default',
      badgeStyle: 'default',
      badgeDensity: 'full',
    };
  });

  const [openUiTestMenu, setOpenUiTestMenu] = useState<'theme' | 'toolbar' | 'card' | 'bg' | 'badge' | null>(null);
  const [highlightQuickBar, setHighlightQuickBar] = useState(false);

  useEffect(() => {
    safeLocalStorageSet('yapim_ui_experiments', JSON.stringify(uiExperiments));
  }, [uiExperiments]);

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    minRating: 0,
    watchingOnly: false,
    followingOnly: false,
    ankiFilter: 'all',
    uncategorizedOnly: false,
  });

  // View Settings State with card size slider and theme support
  const [viewSettings, setViewSettings] = useState<ViewSettings>(() => {
    const saved = safeLocalStorageGet('yapim_view_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const theme = parsed.theme === 'dark-slate' ? 'nordic-frost' : (parsed.theme || 'pure-dark');
        return {
          showTitle: true,
          showRating: true,
          showYear: true,
          showAnki: false,
          showWatching: true,
          showFollowing: true,
          showGameStatus: true,
          cardSize: 3,
          ...parsed,
          theme,
        };
      } catch {}
    }
    return {
      showTitle: true,
      showRating: true,
      showYear: true,
      showAnki: false,
      showWatching: true,
      showFollowing: true,
      showGameStatus: true,
      cardSize: 3,
      theme: 'pure-dark',
    };
  });

  // Persist viewSettings and set data-theme on document root
  useEffect(() => {
    safeLocalStorageSet('yapim_view_settings', JSON.stringify(viewSettings));
    document.documentElement.setAttribute(
      'data-theme',
      viewSettings.theme || 'pure-dark'
    );
  }, [viewSettings]);

  // --- 1. Initial Load: Check IndexedDB / Directory Handle & Permissions ---
  useEffect(() => {
    async function initStorage() {
      try {
        // 1. First check IndexedDB (which stores full items, custom posters & modifications)
        const idbData = await loadDataFromIndexedDB();
        let currentBestData: AppData | null = null;

        if (idbData && idbData.categories && Array.isArray(idbData.items) && idbData.items.length > 0) {
          setAppData(idbData);
          currentBestData = idbData;
        } else {
          // Fallback to localStorage
          const local = loadDataFromLocalStorage();
          if (local && local.categories && Array.isArray(local.items) && local.items.length > 0) {
            setAppData(local);
            currentBestData = local;
          }
        }

        // 2. Check connected file system directory if available
        const storedHandle = await getStoredDirectoryHandle();
        if (storedHandle) {
          const isAccessible = await checkDirectoryHandleAccessibility(storedHandle);
          if (isAccessible) {
            const hasPerm = await verifyPermission(storedHandle, true);
            if (hasPerm) {
              setDirHandle(storedHandle);
              const folderData = await readDataFromFolder(storedHandle);
              if (folderData && folderData.categories && Array.isArray(folderData.items) && folderData.items.length > 0) {
                const localUpdated = currentBestData?.lastUpdated ? new Date(currentBestData.lastUpdated).getTime() : 0;
                const folderUpdated = folderData.lastUpdated ? new Date(folderData.lastUpdated).getTime() : 0;
                const localItemCount = currentBestData?.items?.length || 0;
                const folderItemCount = folderData.items?.length || 0;

                // If folder data is strictly newer AND has at least as many items, load it
                if (folderUpdated > localUpdated && folderItemCount >= localItemCount) {
                  setAppData(folderData);
                  saveDataToLocalStorage(folderData);
                } else if (currentBestData) {
                  // Otherwise, local/IndexedDB data has newer updates (e.g. recently added/edited cards)
                  // Preserve local data in state and immediately sync it to disk so the folder is up-to-date!
                  writeDataToFolder(storedHandle, currentBestData).catch((e) =>
                    console.warn('Syncing local data to folder on init:', e)
                  );
                }
              } else if (currentBestData) {
                // Folder is empty or newly created, write local data to it
                writeDataToFolder(storedHandle, currentBestData).catch((e) =>
                  console.warn('Initial folder sync:', e)
                );
              }
            }
          } else {
            // Folder is no longer accessible (renamed, moved, or deleted)
            await storeDirectoryHandle(null as any);
          }
        }
      } catch (err) {
        console.warn('Storage initialization error:', err);
      } finally {
        setIsDataLoaded(true);
      }
    }
    initStorage();
  }, []);

  // --- 2. Auto-Save to LocalStorage and File System ---
  useEffect(() => {
    if (!isDataLoaded) return;

    // Save to local storage
    saveDataToLocalStorage(appData);

    // Save to File System Folder if connected
    if (dirHandle) {
      const timeoutId = setTimeout(() => {
        writeDataToFolder(dirHandle, appData).catch((err) => {
          console.error('Auto-save to directory failed:', err);
        });
      }, 500); // 500ms debounce
      return () => clearTimeout(timeoutId);
    }
  }, [appData, dirHandle, isDataLoaded]);

  // Flush save on window unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (appData) {
        saveDataToLocalStorage(appData);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [appData]);

  // Close panels
  const closeAllPanels = useCallback(() => {
    setIsFilterOpen(false);
    setIsViewOpen(false);
  }, []);

  // Current category list for active main tab
  const currentCategories = (appData?.categories && appData.categories[mainTab]) || [];
  const activeCategory =
    activeCatId && activeCatId !== TRACKED_TAB_ID
      ? currentCategories.find((c) => c?.id === activeCatId)
      : null;

  // --- 3. Global Keyboard Shortcuts (1: Media Home, 2: Game Home, 3: Tracked, 'W': Add, 'Escape': Smart ESC/Settings, 'Tab': Grid/Tier, 'Space': Fullscreen) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 'Escape' key -> Smart ESC:
      // If preview/modal/panel/search is open -> close active window.
      // If no window is open -> open Settings (or close if already open).
      if (e.key === 'Escape') {
        e.preventDefault();
        if (previewItem) {
          setPreviewItem(null);
        } else if (selectedItem) {
          setSelectedItem(null);
        } else if (isAddModalOpen) {
          setIsAddModalOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (isFilterOpen || isViewOpen) {
          closeAllPanels();
        } else if (isSearchOpen) {
          setIsSearchOpen(false);
          setSearchQuery('');
        } else {
          setIsSettingsOpen(true);
        }
        return;
      }

      // Don't trigger shortcuts if user is typing in an input, textarea, select or contenteditable element
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // 'F' or 'f' key -> Toggle large poster preview for currently hovered card
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (previewItem) {
          setPreviewItem(null);
        } else if (hoveredItem) {
          setPreviewItem(hoveredItem);
        }
        return;
      }

      // '1' key -> Nerede olursan ol Medya Ana Sayfasına götürür
      if (e.key === '1') {
        e.preventDefault();
        closeAllPanels();
        setSelectedItem(null);
        setIsAddModalOpen(false);
        setIsSettingsOpen(false);
        setIsSearchOpen(false);
        setSearchQuery('');
        setMainTab('media');
        setActiveCatId(null);
        setActiveSub(null);
        setViewMode('grid');
        return;
      }

      // '2' key -> Nerede olursan ol Oyun Ana Sayfasına götürür
      if (e.key === '2') {
        e.preventDefault();
        closeAllPanels();
        setSelectedItem(null);
        setIsAddModalOpen(false);
        setIsSettingsOpen(false);
        setIsSearchOpen(false);
        setSearchQuery('');
        setMainTab('game');
        setActiveCatId(null);
        setActiveSub(null);
        setViewMode('grid');
        return;
      }

      // '3' key -> İzlenen & Takip Listesini açar
      if (e.key === '3') {
        e.preventDefault();
        closeAllPanels();
        setSelectedItem(null);
        setIsAddModalOpen(false);
        setIsSettingsOpen(false);
        setIsSearchOpen(false);
        setSearchQuery('');
        setMainTab('media');
        setActiveCatId(TRACKED_TAB_ID);
        setActiveSub(null);
        setViewMode('grid');
        return;
      }

      // 'W' or 'w' key -> Open Add Item Modal (FAB action)
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        closeAllPanels();
        setIsAddModalOpen(true);
        return;
      }

      // 'Space' key -> Toggle Fullscreen On/Off
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        return;
      }

      // 'Tab' key -> Toggle between Grid and Tier List view if tier list is enabled for active category
      if (e.key === 'Tab') {
        if (activeCategory && activeCategory.tierEnabled) {
          e.preventDefault();
          setViewMode((prev) => (prev === 'grid' ? 'tier' : 'grid'));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeAllPanels, selectedItem, isAddModalOpen, isSettingsOpen, isFilterOpen, isViewOpen, isSearchOpen, activeCategory, hoveredItem, previewItem]);

  // Directory Connection Handlers
  const handleConnectFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      window.alert(
        'Tarayıcınız File System Access API desteklemiyor. Lütfen güncel Chrome veya Edge kullanın.'
      );
      return;
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      if (handle) {
        const hasPerm = await verifyPermission(handle, true);
        if (hasPerm) {
          setDirHandle(handle);
          await storeDirectoryHandle(handle);

          // Try to read existing data or write current data
          const existingData = await readDataFromFolder(handle);
          if (existingData && existingData.categories && existingData.items) {
            setAppData(existingData);
          } else {
            await writeDataToFolder(handle, appData);
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        throw err;
      }
    }
  };

  const handleDisconnectFolder = async () => {
    setDirHandle(null);
    await storeDirectoryHandle(null as any);
  };

  // --- CRUD Operations on Items ---
  const handleAddItem = (newItem: ArchiveItem) => {
    setAppData((prev) => {
      const updated: AppData = {
        ...prev,
        lastUpdated: new Date().toISOString(),
        items: [newItem, ...prev.items],
      };
      saveDataToLocalStorage(updated);
      if (dirHandle) {
        writeDataToFolder(dirHandle, updated).catch((err) =>
          console.warn('Folder save on add item failed:', err)
        );
      }
      return updated;
    });
    setIsAddModalOpen(false);
  };

  const handleSaveItem = (updatedItem: ArchiveItem) => {
    setAppData((prev) => {
      const updated: AppData = {
        ...prev,
        lastUpdated: new Date().toISOString(),
        items: prev.items.map((it) => (it.id === updatedItem.id ? updatedItem : it)),
      };
      saveDataToLocalStorage(updated);
      if (dirHandle) {
        writeDataToFolder(dirHandle, updated).catch((err) =>
          console.warn('Folder save on save item failed:', err)
        );
      }
      return updated;
    });
    setSelectedItem(null);
  };

  const handleDeleteItem = (itemId: string) => {
    const itemToDelete = appData.items.find((it) => it.id === itemId);
    if (dirHandle) {
      deleteImageFromFolder(dirHandle, itemToDelete?.thumbnailFileName, itemId).catch((e) => {
        console.warn('Failed to delete image from folder:', e);
      });
    }

    setAppData((prev) => {
      const updated: AppData = {
        ...prev,
        lastUpdated: new Date().toISOString(),
        items: prev.items.filter((it) => it.id !== itemId),
      };
      saveDataToLocalStorage(updated);
      if (dirHandle) {
        writeDataToFolder(dirHandle, updated).catch((err) =>
          console.warn('Folder save on delete item failed:', err)
        );
      }
      return updated;
    });
    setSelectedItem(null);
  };

  // --- Bulk Selection & Action Handlers ---
  const handleToggleSelectItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = (currentFilteredItems: ArchiveItem[]) => {
    const allIds = currentFilteredItems.map((it) => it.id);
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedItemIds.has(id));
    
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedItemIds.size === 0) return;
    const count = selectedItemIds.size;
    
    setDialogOptions({
      type: 'confirm',
      title: 'Toplu Yapım Sil',
      message: `Seçili ${count} yapım arşivden ve diskteki karşılık gelen afiş görselleri silinecektir. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?`,
      confirmText: 'Evet, Sil',
      cancelText: 'İptal',
      isDestructive: true,
      onConfirm: () => {
        if (dirHandle) {
          const itemsToDelete = appData.items.filter((it) => selectedItemIds.has(it.id));
          for (const item of itemsToDelete) {
            deleteImageFromFolder(dirHandle, item.thumbnailFileName, item.id).catch((e) => {
              console.warn('Failed to delete image during bulk delete:', e);
            });
          }
        }

        setAppData((prev) => {
          const updated = {
            ...prev,
            items: prev.items.filter((it) => !selectedItemIds.has(it.id)),
          };
          saveDataToLocalStorage(updated);
          if (dirHandle) {
            writeDataToFolder(dirHandle, updated).catch(() => {});
          }
          return updated;
        });

        setSelectedItemIds(new Set());
        setIsSelectionMode(false);
      },
    });
  };

  const handleBulkMove = (targetCatId: string, targetSub: string | null) => {
    if (selectedItemIds.size === 0) return;
    setAppData((prev) => {
      const updated = {
        ...prev,
        items: prev.items.map((it) => {
          if (selectedItemIds.has(it.id)) {
            return {
              ...it,
              cat: targetCatId,
              sub: targetSub,
            };
          }
          return it;
        }),
      };
      saveDataToLocalStorage(updated);
      if (dirHandle) {
        writeDataToFolder(dirHandle, updated).catch(() => {});
      }
      return updated;
    });

    setSelectedItemIds(new Set());
    setIsBulkMoveOpen(false);
    setIsSelectionMode(false);
  };

  // --- Category & Tier Row Operations ---
  const handleUpdateCategories = (
    tab: MainTabType,
    newCategories: Category[]
  ) => {
    setAppData((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [tab]: newCategories,
      },
    }));
  };

  const handleUpdateCategoryTierRows = (
    catId: string,
    newRows: TierRow[]
  ) => {
    setAppData((prev) => {
      const currentCats = prev.categories[mainTab] || [];
      const updatedCats = currentCats.map((c) =>
        c.id === catId ? { ...c, tierRows: newRows } : c
      );
      return {
        ...prev,
        categories: {
          ...prev.categories,
          [mainTab]: updatedCats,
        },
      };
    });
  };

  // --- Tier List Undo/Redo & Moved Item Tracking State & Refs ---
  const [tierHistory, setTierHistory] = useState<ArchiveItem[][]>([]);
  const [tierHistoryIndex, setTierHistoryIndex] = useState<number>(-1);

  // Refs for instantaneous, synchronous history indexing without closure lag
  const tierHistoryRef = React.useRef<ArchiveItem[][]>([]);
  const tierHistoryIndexRef = React.useRef<number>(-1);

  // Helper to compare whether two item states have identical tier placements & order in the active category
  const areCategoryPlacementsEqual = (
    a: ArchiveItem[],
    b: ArchiveItem[],
    tab: MainTabType,
    catId: string
  ): boolean => {
    const aCat = a.filter((it) => it.mainTab === tab && it.cat === catId);
    const bCat = b.filter((it) => it.mainTab === tab && it.cat === catId);
    if (aCat.length !== bCat.length) return false;
    for (let i = 0; i < aCat.length; i++) {
      if (aCat[i].id !== bCat[i].id || aCat[i].tier !== bCat[i].tier) {
        return false;
      }
    }
    return true;
  };

  // Switch Main Tabs (Media / Game)
  const handleMainTabChange = (tab: MainTabType) => {
    setMainTab(tab);
    setActiveCatId(null);
    setActiveSub(null);
    setViewMode('grid');
  };

  const handleCategorySelect = (catId: string | null) => {
    setActiveCatId(catId);
    setActiveSub(null);
  };

  // Reset Tier List history when entering Tier Mode or switching categories
  useEffect(() => {
    if (viewMode === 'tier' && activeCatId) {
      tierHistoryRef.current = [appData.items];
      tierHistoryIndexRef.current = 0;
      setTierHistory([appData.items]);
      setTierHistoryIndex(0);
    } else {
      tierHistoryRef.current = [];
      tierHistoryIndexRef.current = -1;
      setTierHistory([]);
      setTierHistoryIndex(-1);
    }
  }, [mainTab, activeCatId, viewMode]);

  // Star Badge: Computes cards currently placed differently from Session Snapshot 0
  const movedItemIds = useMemo(() => {
    if (viewMode !== 'tier' || !activeCatId || tierHistory.length <= 1 || tierHistoryIndex === 0) {
      return new Set<string>();
    }

    const baseItems = tierHistory[0];
    if (!baseItems) return new Set<string>();

    const baseCatItems = baseItems.filter((it) => it.mainTab === mainTab && it.cat === activeCatId);
    const currentCatItems = appData.items.filter((it) => it.mainTab === mainTab && it.cat === activeCatId);

    const baseMap = new Map<string, { tier: string | null; indexInTier: number }>();
    const baseTierCounters = new Map<string | null, number>();
    baseCatItems.forEach((it) => {
      const idx = baseTierCounters.get(it.tier) || 0;
      baseMap.set(it.id, { tier: it.tier, indexInTier: idx });
      baseTierCounters.set(it.tier, idx + 1);
    });

    const movedSet = new Set<string>();
    const curTierCounters = new Map<string | null, number>();
    currentCatItems.forEach((it) => {
      const curIdx = curTierCounters.get(it.tier) || 0;
      curTierCounters.set(it.tier, curIdx + 1);

      const base = baseMap.get(it.id);
      if (!base) {
        movedSet.add(it.id);
      } else if (base.tier !== it.tier || base.indexInTier !== curIdx) {
        movedSet.add(it.id);
      }
    });

    return movedSet;
  }, [appData.items, mainTab, activeCatId, viewMode, tierHistory, tierHistoryIndex]);

  const handleUpdateTierPlacement = (
    itemId: string,
    tierId: string | null,
    targetItemId?: string | null,
    position?: 'before' | 'after'
  ) => {
    const currentItems = appData.items;
    const itemIndex = currentItems.findIndex((it) => it.id === itemId);
    if (itemIndex === -1) return;

    const item = { ...currentItems[itemIndex], tier: tierId };
    const newItems = currentItems.filter((it) => it.id !== itemId);

    if (targetItemId && targetItemId !== itemId) {
      const targetIndex = newItems.findIndex((it) => it.id === targetItemId);
      if (targetIndex !== -1) {
        const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
        newItems.splice(insertIndex, 0, item);
      } else {
        newItems.push(item);
      }
    } else if (tierId !== null) {
      // Find the last item with this tier in newItems
      let lastIndex = -1;
      for (let i = newItems.length - 1; i >= 0; i--) {
        if (newItems[i].tier === tierId) {
          lastIndex = i;
          break;
        }
      }
      if (lastIndex !== -1) {
        newItems.splice(lastIndex + 1, 0, item);
      } else {
        newItems.push(item);
      }
    } else {
      // Returned to unranked pool
      newItems.push(item);
    }

    // Check if placement actually changed
    if (activeCatId && areCategoryPlacementsEqual(currentItems, newItems, mainTab, activeCatId)) {
      return;
    }

    // Synchronously record snapshot to Undo/Redo history stack once
    const curIdx = tierHistoryIndexRef.current;
    const baseHistory = curIdx >= 0 ? tierHistoryRef.current.slice(0, curIdx + 1) : [currentItems];
    const newHistory = [...baseHistory, newItems];
    const newIdx = newHistory.length - 1;

    tierHistoryRef.current = newHistory;
    tierHistoryIndexRef.current = newIdx;
    setTierHistory(newHistory);
    setTierHistoryIndex(newIdx);

    setAppData((prev) => ({ ...prev, items: newItems }));
  };

  // Batch placement update (e.g. for clearing a row or clearing all cards in a single undo step)
  const handleBatchUpdateTierPlacements = (
    updates: { itemId: string; tierRowId: string | null }[]
  ) => {
    if (!activeCatId || updates.length === 0) return;
    const currentItems = appData.items;
    const updateMap = new Map(updates.map((u) => [u.itemId, u.tierRowId]));

    const newItems = currentItems.map((it) => {
      if (updateMap.has(it.id)) {
        return { ...it, tier: updateMap.get(it.id)! };
      }
      return it;
    });

    if (areCategoryPlacementsEqual(currentItems, newItems, mainTab, activeCatId)) {
      return;
    }

    const curIdx = tierHistoryIndexRef.current;
    const baseHistory = curIdx >= 0 ? tierHistoryRef.current.slice(0, curIdx + 1) : [currentItems];
    const newHistory = [...baseHistory, newItems];
    const newIdx = newHistory.length - 1;

    tierHistoryRef.current = newHistory;
    tierHistoryIndexRef.current = newIdx;
    setTierHistory(newHistory);
    setTierHistoryIndex(newIdx);

    setAppData((prev) => ({ ...prev, items: newItems }));
  };

  const canUndo = viewMode === 'tier' && tierHistoryIndex > 0;
  const canRedo =
    viewMode === 'tier' &&
    tierHistoryIndex >= 0 &&
    tierHistoryIndex < tierHistory.length - 1;

  const handleTierUndo = () => {
    const curIdx = tierHistoryIndexRef.current;
    if (curIdx <= 0) return;
    const newIdx = curIdx - 1;
    const targetItems = tierHistoryRef.current[newIdx];
    if (targetItems) {
      tierHistoryIndexRef.current = newIdx;
      setTierHistoryIndex(newIdx);
      setAppData((prev) => ({ ...prev, items: targetItems }));
    }
  };

  const handleTierRedo = () => {
    const curIdx = tierHistoryIndexRef.current;
    if (curIdx < 0 || curIdx >= tierHistoryRef.current.length - 1) return;
    const newIdx = curIdx + 1;
    const targetItems = tierHistoryRef.current[newIdx];
    if (targetItems) {
      tierHistoryIndexRef.current = newIdx;
      setTierHistoryIndex(newIdx);
      setAppData((prev) => ({ ...prev, items: targetItems }));
    }
  };

  // Keyboard Shortcuts for Tier List Undo (Ctrl+Z) & Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'tier') return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && !e.altKey) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            e.preventDefault();
            handleTierRedo();
          } else {
            e.preventDefault();
            handleTierUndo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleTierRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, canUndo, canRedo, tierHistory, tierHistoryIndex]);

  // Export and Import for active Tier List
  const handleExportTierList = () => {
    if (!activeCategory) return;
    exportTierListBackup(mainTab, activeCategory, appData.items);
  };

  const handleImportTierList = async (file: File) => {
    if (!activeCategory) return;
    try {
      const backup = await parseTierListBackupFile(file);
      
      setDialogOptions({
        type: 'confirm',
        title: 'Tier List Yedeğini Geri Yükle',
        message: `"${backup.category.name}" kategorisine ait Tier List yedeği bulundu (${backup.items.length} yapım, ${backup.category.tierRows.length} satır).\n\nBu kategorinin Tier List yapısı ve kart sıralamaları geri yüklensin mi?`,
        confirmText: 'Geri Yükle',
        cancelText: 'Vazgeç',
        onConfirm: () => {
          // Update category tierRows
          const updatedCats = {
            ...appData.categories,
            [mainTab]: (appData.categories[mainTab] || []).map((c) =>
              c.id === activeCategory.id
                ? { ...c, tierEnabled: true, tierRows: backup.category.tierRows }
                : c
            ),
          };

          const backupItemMap = new Map(backup.items.map((it) => [it.id, it]));
          
          // Current items in this category
          const categoryCurrentItems = appData.items.filter(
            (it) => it.mainTab === mainTab && it.cat === activeCategory.id
          );
          const otherItems = appData.items.filter(
            (it) => !(it.mainTab === mainTab && it.cat === activeCategory.id)
          );

          // 1. Items present in the backup: restore backup tier and retain backup order
          const restoredBackupItems: ArchiveItem[] = [];
          const placedTitles: string[] = [];
          for (const bItem of backup.items) {
            const currentMatching = categoryCurrentItems.find((it) => it.id === bItem.id);
            if (currentMatching) {
              restoredBackupItems.push({
                ...currentMatching,
                tier: bItem.tier,
              });
              placedTitles.push(currentMatching.title);
            }
          }

          // 2. Items NOT present in the backup (e.g. 15th anime added today vs 14 in yesterday's backup):
          // Send to unranked pool (tier: null) and append at the end
          const newUnbackedItems: ArchiveItem[] = categoryCurrentItems
            .filter((it) => !backupItemMap.has(it.id))
            .map((it) => ({
              ...it,
              tier: null, // Send to unranked pool
            }));
          const newPoolTitles = newUnbackedItems.map((it) => it.title);

          // 3. Backup items that are missing from current library (deleted or moved):
          const currentItemMap = new Map(categoryCurrentItems.map((it) => [it.id, it]));
          const missingFromLibrary = backup.items.filter((it) => !currentItemMap.has(it.id));
          const missingTitles = missingFromLibrary.map((it) => it.title || it.id);

          const mergedCategoryItems = [...restoredBackupItems, ...newUnbackedItems];
          const updatedItems = [...otherItems, ...mergedCategoryItems];

          // Reset history for tier session with newly imported state
          tierHistoryRef.current = [updatedItems];
          tierHistoryIndexRef.current = 0;
          setTierHistory([updatedItems]);
          setTierHistoryIndex(0);

          const updatedData = {
            ...appData,
            categories: updatedCats,
            items: updatedItems,
          };
          setAppData(updatedData);
          saveDataToLocalStorage(updatedData);
          if (dirHandle) {
            writeDataToFolder(dirHandle, updatedData).catch(() => {});
          }

          setDialogOptions({
            type: 'tier-report',
            title: `"${activeCategory.name}" Tier Listesi Yüklendi`,
            confirmText: 'Tamam',
            tierReport: {
              categoryName: activeCategory.name,
              placedCount: placedTitles.length,
              placedTitles,
              newPoolCount: newPoolTitles.length,
              newPoolTitles,
              missingCount: missingTitles.length,
              missingTitles,
            },
          });
        },
      });
    } catch (err: any) {
      setDialogOptions({
        type: 'alert',
        title: 'İçe Aktarma Hatası',
        message: 'Tier List içe aktarma hatası: ' + (err.message || err),
      });
    }
  };

  // --- Filter and Search Logic ---
  const filteredItems = useMemo(() => {
    const rawItems = Array.isArray(appData?.items) ? appData.items : [];
    const validCategoryIds = new Set(
      ((appData?.categories && appData.categories[mainTab]) || []).map((c) => c?.id).filter(Boolean)
    );

    const result = rawItems.filter((item) => {
      if (!item) return false;
      // 1. Tab match
      if (item.mainTab !== mainTab) return false;

      // Uncategorized check (empty cat, invalid/deleted cat, or explicitly uncategorized)
      const isUncategorized =
        !item.cat ||
        item.cat.trim() === '' ||
        item.cat === 'uncategorized' ||
        item.cat === 'kategorisiz' ||
        !validCategoryIds.has(item.cat);

      // 2. Uncategorized-only Filter Check (Context-Aware)
      if (filters.uncategorizedOnly) {
        if (activeCatId && activeCatId !== TRACKED_TAB_ID) {
          // If a category is selected (e.g. 'Dizi'), match items in this category that have no subcategory (directly in root)
          if (item.cat !== activeCatId) return false;
          if (item.sub && item.sub.trim() !== '') return false;
        } else {
          // If no category is selected (overall media/game pool), match completely uncategorized items
          if (!isUncategorized) return false;
        }
      } else {
        // Normal Category Filtering (when uncategorizedOnly is false)
        // Tracked View
        if (mainTab === 'media' && activeCatId === TRACKED_TAB_ID) {
          if (!item.watching && !item.following && !(item as any).isWatching && !(item as any).isFollowing) return false;
        } else if (activeCatId) {
          // Category match
          if (item.cat !== activeCatId) return false;
          // Subgroup match
          if (activeSub && item.sub !== activeSub) return false;
        }
      }

      // 4. Search query (Comma-separated multi-tag / year / term AND logic)
      if (searchQuery.trim()) {
        const terms = searchQuery
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);

        if (terms.length > 0) {
          const itemTitle = (item.title || '').toLowerCase();
          const itemDesc = (item.desc || '').toLowerCase();
          const itemDate = (item.date || '').toLowerCase();
          const itemCat = (item.cat || '').toLowerCase();
          const itemSub = (item.sub || '').toLowerCase();
          const itemStatus = (item.status || '').toLowerCase();
          
          const itemGenres = (item.genre || []).map((g) => g.toLowerCase());
          const itemFirms = (item.firm || []).map((f) => f.toLowerCase());
          const itemDirectors = (item.director || []).map((d) => d.toLowerCase());
          const itemActors = (item.actors || []).map((a) => a.toLowerCase());
          const itemDevelopers = (item.developer || []).map((d) => d.toLowerCase());

          // Check if ALL terms match the item (AND logic)
          const matchesAllTerms = terms.every((term) => {
            if (itemTitle.includes(term)) return true;
            if (itemDesc.includes(term)) return true;
            if (itemDate.includes(term)) return true;
            if (itemCat.includes(term)) return true;
            if (itemSub.includes(term)) return true;
            if (itemStatus.includes(term)) return true;
            if (itemGenres.some((g) => g.includes(term))) return true;
            if (itemFirms.some((f) => f.includes(term))) return true;
            if (itemDirectors.some((d) => d.includes(term))) return true;
            if (itemActors.some((a) => a.includes(term))) return true;
            if (itemDevelopers.some((d) => d.includes(term))) return true;
            return false;
          });

          if (!matchesAllTerms) {
            return false;
          }
        }
      }

      // 5. Rating & Watch status filters
      if (filters.minRating > 0 && item.rating < filters.minRating) return false;
      if (filters.watchingOnly && !item.watching && !(item as any).isWatching) return false;
      if (filters.followingOnly && !item.following && !(item as any).isFollowing) return false;

      // 6. Game status filter
      if (item.mainTab === 'game' && filters.gameStatus && filters.gameStatus !== 'all') {
        if (item.status !== filters.gameStatus) return false;
      }

      // 7. Anki filter
      if (filters.ankiFilter === 'yes' && !item.anki) return false;
      if (filters.ankiFilter === 'no' && item.anki) return false;

      return true;
    });

    // Apply Sorting: Default to 'date-desc' (Last Watched/Finished first, ?? dates safely placed at the end)
    return sortArchiveItems(result, viewSettings.sortBy || 'date-desc');
  }, [appData.items, appData.categories, mainTab, activeCatId, activeSub, searchQuery, filters, viewSettings.sortBy]);

  // Card size calculation for CSS Grid auto-fill (1: 120px, 2: 150px, 3: 185px, 4: 230px, 5: 280px)
  const cardMinWidth = useMemo(() => {
    const size = viewSettings.cardSize || 3;
    switch (size) {
      case 1:
        return 120;
      case 2:
        return 150;
      case 3:
        return 185;
      case 4:
        return 230;
      case 5:
        return 280;
      default:
        return 185;
    }
  }, [viewSettings.cardSize]);

  // Theme style classes helper
  const themeClasses = useMemo(() => {
    const theme = viewSettings.theme || 'pure-dark';
    switch (theme) {
      case 'charcoal-gray':
        return {
          bg: 'bg-[#0f1115]',
          ambient: 'bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(100,116,139,0.14),transparent)]',
        };
      case 'nordic-frost':
        return {
          bg: 'bg-[#0b131e]',
          ambient: 'bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(56,189,248,0.16),transparent)]',
        };
      case 'crimson-night':
        return {
          bg: 'bg-[#12080a]',
          ambient: 'bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(225,29,72,0.18),transparent)]',
        };
      case 'emerald-abyss':
        return {
          bg: 'bg-[#091410]',
          ambient: 'bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(16,185,129,0.16),transparent)]',
        };
      case 'amethyst-twilight':
        return {
          bg: 'bg-[#0f0b18]',
          ambient: 'bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(168,85,247,0.16),transparent)]',
        };
      case 'pure-dark':
      default:
        return {
          bg: 'bg-[#000000]',
          ambient: 'bg-transparent',
        };
    }
  }, [viewSettings.theme]);

  return (
    <div
      id="app-root"
      data-theme={viewSettings.theme || 'pure-dark'}
      onClick={closeAllPanels}
      className={`min-h-screen ${themeClasses.bg} text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white relative overflow-x-hidden transition-colors duration-300`}
    >
      {/* Background ambient lighting */}
      <div className={`fixed inset-0 pointer-events-none ${themeClasses.ambient}`} />
      {uiExperiments.bgAtmosphere === 'dots' && (
        <div
          className="fixed inset-0 pointer-events-none opacity-40 z-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.2) 1.2px, transparent 1.2px)',
            backgroundSize: '22px 22px',
          }}
        />
      )}

      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-8 lg:px-12 py-3 sm:py-5 flex-1 flex flex-col space-y-4 relative z-10">
        {/* Header Tabs & Navigation */}
        <HeaderTabs
          mainTab={mainTab}
          categories={appData.categories}
          activeCatId={activeCatId}
          activeSub={activeSub}
          viewMode={viewMode}
          totalFilteredCount={filteredItems.length}
          searchQuery={searchQuery}
          isSearchOpen={isSearchOpen}
          isFilterOpen={isFilterOpen}
          isViewOpen={isViewOpen}
          filters={filters}
          viewSettings={viewSettings}
          dirHandle={dirHandle}
          isSelectionMode={isSelectionMode}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleTierUndo}
          onRedo={handleTierRedo}
          onExportTierList={handleExportTierList}
          onImportTierList={handleImportTierList}
          uiExperiments={uiExperiments}
          onMainTabChange={handleMainTabChange}
          onCategorySelect={handleCategorySelect}
          onSubgroupSelect={setActiveSub}
          onViewModeChange={setViewMode}
          onToggleSelectionMode={() => {
            setIsSelectionMode((p) => !p);
            setSelectedItemIds(new Set());
          }}
          onSearchChange={setSearchQuery}
          onToggleSearch={() => {
            setIsSearchOpen((prev) => !prev);
            setIsFilterOpen(false);
            setIsViewOpen(false);
          }}
          onToggleFilter={() => {
            setIsFilterOpen((prev) => !prev);
            setIsViewOpen(false);
          }}
          onToggleView={() => {
            setIsViewOpen((prev) => !prev);
            setIsFilterOpen(false);
          }}
          onOpenSettings={async () => {
            closeAllPanels();
            if (dirHandle) {
              const isAccessible = await checkDirectoryHandleAccessibility(dirHandle);
              if (!isAccessible) {
                setDirHandle(null);
                await storeDirectoryHandle(null as any);
              }
            }
            setIsSettingsOpen(true);
          }}
          onOpenStatistics={() => {
            closeAllPanels();
            setIsStatisticsOpen(true);
          }}
          onFilterChange={(newFilters) =>
            setFilters((prev) => ({ ...prev, ...newFilters }))
          }
          onViewSettingsChange={(newSettings) =>
            setViewSettings((prev) => ({ ...prev, ...newSettings }))
          }
          onClosePanels={closeAllPanels}
        />

        {/* Main Content Area */}
        <main className="flex-1 pt-1">
          {/* A: Tracked / İzlenen View for Media */}
          {mainTab === 'media' && activeCatId === TRACKED_TAB_ID ? (
            <TrackedView
              items={filteredItems}
              viewSettings={viewSettings}
              uiExperiments={uiExperiments}
              onItemClick={(item) => {
                if (isSelectionMode) {
                  handleToggleSelectItem(item.id);
                } else {
                  setSelectedItem(item);
                }
              }}
              onItemHover={(item) => setHoveredItem(item)}
              isSelectionMode={isSelectionMode}
              selectedItemIds={selectedItemIds}
              onToggleSelectItem={handleToggleSelectItem}
            />
          ) : activeCategory && activeCategory.tierEnabled && viewMode === 'tier' ? (
            /* B: Tier List View */
            <TierListView
              mainTab={mainTab}
              category={activeCategory}
              items={appData.items}
              movedItemIds={movedItemIds}
              onUpdateTierPlacement={handleUpdateTierPlacement}
              onBatchUpdateTierPlacements={handleBatchUpdateTierPlacements}
              onUpdateCategoryRows={(rows) =>
                handleUpdateCategoryTierRows(activeCategory.id, rows)
              }
              onItemClick={(item) => setSelectedItem(item)}
              onItemHover={(item) => setHoveredItem(item)}
              onItemPreview={(item) => setPreviewItem(item)}
            />
          ) : (
            /* C: Fluid & Dynamic Poster Grid - 3 cards per row on mobile, auto-fill on tablet/desktop */
            <div id="items-grid-section">
              {filteredItems.length > 0 ? (
                <div
                  id="items-grid"
                  className="grid grid-cols-3 sm:grid-cols-auto-fill gap-2 sm:gap-4.5 transition-all duration-300"
                  style={{
                    gridTemplateColumns: window.innerWidth < 640 ? 'repeat(3, minmax(0, 1fr))' : `repeat(auto-fill, minmax(${cardMinWidth}px, 1fr))`,
                  }}
                >
                  {filteredItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      viewSettings={viewSettings}
                      uiExperiments={uiExperiments}
                      onClick={() => {
                        if (isSelectionMode) {
                          handleToggleSelectItem(item.id);
                        } else {
                          setSelectedItem(item);
                        }
                      }}
                      onMouseEnter={() => setHoveredItem(item)}
                      onMouseLeave={() =>
                        setHoveredItem((prev) => (prev?.id === item.id ? null : prev))
                      }
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedItemIds.has(item.id)}
                      onToggleSelect={() => handleToggleSelectItem(item.id)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  id="empty-items-state"
                  className="py-20 text-center rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 space-y-4 max-w-lg mx-auto"
                >
                  <p className="text-slate-300 text-sm font-medium">
                    Bu filtreye veya kategoriye uyan yapım bulunamadı.
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                  >
                    + Yeni Yapım Ekle
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating Bulk Action Bar */}
      {isSelectionMode && (
        <div
          id="bulk-actions-floating-bar"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/95 border border-blue-500/40 backdrop-blur-xl px-4 py-2.5 rounded-2xl shadow-2xl shadow-black/80 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-center gap-2 pr-2 border-r border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-white whitespace-nowrap">
              {selectedItemIds.size} / {filteredItems.length} Seçili
            </span>
          </div>

          {/* Select All / Deselect Button */}
          <button
            id="bulk-select-all-btn"
            onClick={() => handleSelectAllFiltered(filteredItems)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
            title={
              filteredItems.length > 0 &&
              filteredItems.every((it) => selectedItemIds.has(it.id))
                ? 'Seçimi Temizle'
                : 'Tümünü Seç'
            }
          >
            {filteredItems.length > 0 &&
            filteredItems.every((it) => selectedItemIds.has(it.id)) ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                <span>Bırak</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 text-neutral-400" />
                <span>Tümü</span>
              </>
            )}
          </button>

          {/* Move Button */}
          <button
            id="bulk-move-btn"
            disabled={selectedItemIds.size === 0}
            onClick={() => setIsBulkMoveOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <FolderInput className="w-3.5 h-3.5" />
            <span>Taşı</span>
          </button>

          {/* Delete Button */}
          <button
            id="bulk-delete-btn"
            disabled={selectedItemIds.size === 0}
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold shadow-md shadow-red-600/30 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Sil</span>
          </button>

          {/* Exit Selection Mode Button */}
          <button
            id="bulk-close-btn"
            onClick={() => {
              setIsSelectionMode(false);
              setSelectedItemIds(new Set());
            }}
            className="p-1.5 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer ml-1"
            title="Seçim modunu kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Action Button (FAB) for Adding Items - Sadece Izgara Modunda Görünür */}
      {viewMode === 'grid' && (
        <>
          {/* Floating Left Bottom Minimal Statistics Button */}
          <button
            id="fab-statistics-btn"
            onClick={(e) => {
              e.stopPropagation();
              closeAllPanels();
              setIsStatisticsOpen(true);
            }}
            title="İstatistikler & Grafikler (📊)"
            className="fixed bottom-5 left-5 z-40 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-blue-600 text-slate-400 hover:text-white shadow-md hover:shadow-blue-600/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10 hover:border-blue-400/40 backdrop-blur-md cursor-pointer opacity-70 hover:opacity-100 group"
          >
            <BarChart3 className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
          </button>

          {/* Floating Right Bottom Add Button (Only on desktop/tablet, hidden on mobile) */}
          <button
            id="fab-add-item-btn"
            onClick={(e) => {
              e.stopPropagation();
              closeAllPanels();
              setIsAddModalOpen(true);
            }}
            title={`Yeni Ekle (Kısayol: W)`}
            className="hidden md:flex fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white shadow-lg shadow-black/40 hover:shadow-blue-600/30 items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10 hover:border-blue-400/40 backdrop-blur-md cursor-pointer group"
          >
            <Plus className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
          </button>

          {/* Bottom Center Grouped UI Appearance & Atmosphere Bar (Persistent if enabled) */}
          {viewSettings.showQuickAppearanceBar !== false && (
            <div
              id="ui-test-experiment-bar"
              onClick={(e) => e.stopPropagation()}
              className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center"
            >
              {/* Active Category Popover Menu */}
              {openUiTestMenu && (
                <div
                  id="ui-test-popover-menu"
                  className="mb-2 bg-neutral-900/95 border border-white/20 backdrop-blur-xl p-3 rounded-2xl shadow-2xl w-80 text-xs animate-in fade-in zoom-in-95 duration-150 max-h-[70vh] overflow-y-auto custom-scrollbar"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                    <div className="flex items-center gap-1.5 font-semibold text-white">
                      <Palette className="w-3.5 h-3.5 text-blue-400" />
                      <span>
                        {openUiTestMenu === 'theme' && 'Renk Teması'}
                        {openUiTestMenu === 'toolbar' && 'Üst Bar / Toolbar'}
                        {openUiTestMenu === 'card' && 'Kart Görünüm & Efektleri'}
                        {openUiTestMenu === 'bg' && 'Arka Plan Zemin Dokusu'}
                        {openUiTestMenu === 'badge' && 'Rozet & Etiket Ayarları'}
                      </span>
                    </div>
                    <button
                      onClick={() => setOpenUiTestMenu(null)}
                      className="text-neutral-400 hover:text-white p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {/* Theme options */}
                    {openUiTestMenu === 'theme' && (
                      <>
                        {[
                          { id: 'pure-dark', label: 'Saf Siyah (OLED)', desc: 'Zifiri siyah zemin ve sade çizgiler' },
                          { id: 'charcoal-gray', label: 'Koyu Gri (Charcoal)', desc: 'Mat antrasit/gri zemin' },
                          { id: 'nordic-frost', label: 'Kuzey Işıkları (Nordic)', desc: 'Soğuk antrasit & buzul mavisi' },
                          { id: 'crimson-night', label: 'Kızıl Gece (Crimson Noir)', desc: 'Kadife siyah & yakut kızıl ambiyans' },
                          { id: 'emerald-abyss', label: 'Zümrüt Derinliği (Emerald)', desc: 'Derin çam yeşili & zümrüt detaylar' },
                          { id: 'amethyst-twilight', label: 'Ametist Gece (Amethyst)', desc: 'Koyu gece moru & lavanta tonları' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setViewSettings((p) => ({ ...p, theme: opt.id as AppTheme }));
                            }}
                            className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                              (viewSettings.theme || 'pure-dark') === opt.id
                                ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                                : 'hover:bg-white/5 text-neutral-300'
                            }`}
                          >
                            <div>
                              <div className="font-medium">{opt.label}</div>
                              <div className="text-[10px] text-neutral-400 leading-tight">{opt.desc}</div>
                            </div>
                            {(viewSettings.theme || 'pure-dark') === opt.id && (
                              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2" />
                            )}
                          </button>
                        ))}
                      </>
                    )}

                    {/* Toolbar options */}
                    {openUiTestMenu === 'toolbar' && (
                      <>
                        {[
                          { id: 'default', label: 'Varsayılan (Sade)', desc: 'Klasik alt çizgili sade üst bar' },
                          { id: 'box', label: 'Gri Toolbar Kutusu', desc: 'Koyu kutu içine alınmış zarif bar' },
                          { id: 'glass', label: 'Buzlu Cam (Glassmorphism)', desc: 'Yarı saydam ve arkası bulanık bar' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setUiExperiments((p) => ({ ...p, toolbarStyle: opt.id as any }));
                            }}
                            className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                              uiExperiments.toolbarStyle === opt.id
                                ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                                : 'hover:bg-white/5 text-neutral-300'
                            }`}
                          >
                            <div>
                              <div className="font-medium">{opt.label}</div>
                              <div className="text-[10px] text-neutral-400 leading-tight">{opt.desc}</div>
                            </div>
                            {uiExperiments.toolbarStyle === opt.id && (
                              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2" />
                            )}
                          </button>
                        ))}
                      </>
                    )}

                    {/* Card effect options */}
                    {openUiTestMenu === 'card' && (
                      <div className="space-y-3 p-1">
                        {/* 1. Sinematik Vinyet (Yön Seçenekleri) */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-300 px-1">Sinematik Vinyet Gölgesi</div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: 'none', label: 'Kapalı' },
                              { id: 'bottom', label: 'Alttan Vinyet' },
                              { id: 'corners', label: 'Köşelerden' },
                            ].map((v) => (
                              <button
                                key={v.id}
                                onClick={() =>
                                  setUiExperiments((p) => ({ ...p, cardVignette: v.id as any }))
                                }
                                className={`p-1.5 rounded-lg text-[11px] font-medium border text-center transition-all cursor-pointer ${
                                  uiExperiments.cardVignette === v.id
                                    ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                                    : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                                }`}
                              >
                                {v.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 2. Köşe Yuvarlaklığı */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-300 px-1">Kart Köşe Yuvarlaklığı</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { id: 'sharp', label: 'Keskin' },
                              { id: 'normal', label: 'Standart' },
                            ].map((r) => (
                              <button
                                key={r.id}
                                onClick={() =>
                                  setUiExperiments((p) => ({ ...p, cardRadius: r.id as any }))
                                }
                                className={`p-1.5 rounded-lg text-[11px] font-medium border text-center transition-all cursor-pointer ${
                                  uiExperiments.cardRadius === r.id
                                    ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                                    : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                                }`}
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3. Hover Hareketi */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-300 px-1">Hover Hareketi</div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: 'lift', label: 'Yükselme' },
                              { id: 'zoom', label: 'Büyüme (Zoom)' },
                              { id: 'none', label: 'Sabit' },
                            ].map((m) => (
                              <button
                                key={m.id}
                                onClick={() =>
                                  setUiExperiments((p) => ({ ...p, cardHoverMotion: m.id as any }))
                                }
                                className={`p-1.5 rounded-lg text-[11px] font-medium border text-center transition-all cursor-pointer ${
                                  uiExperiments.cardHoverMotion === m.id
                                    ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                                    : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Arka plan options */}
                    {openUiTestMenu === 'bg' && (
                      <>
                        {[
                          { id: 'default', label: 'Varsayılan Düz Zemin', desc: 'Seçili temanın düz arka planı' },
                          { id: 'dots', label: 'Noktalı Matris (Dot Grid)', desc: 'Zarif minimal noktalı matris arka plan' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setUiExperiments((p) => ({ ...p, bgAtmosphere: opt.id as any }));
                            }}
                            className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                              uiExperiments.bgAtmosphere === opt.id
                                ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                                : 'hover:bg-white/5 text-neutral-300'
                            }`}
                          >
                            <div>
                              <div className="font-medium">{opt.label}</div>
                              <div className="text-[10px] text-neutral-400 leading-tight">{opt.desc}</div>
                            </div>
                            {uiExperiments.bgAtmosphere === opt.id && (
                              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2" />
                            )}
                          </button>
                        ))}
                      </>
                    )}

                    {/* Badge style options */}
                    {openUiTestMenu === 'badge' && (
                      <div className="space-y-3 p-1">
                        {/* Rozet Stili */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-300 px-1">Rozet Kontur & Çerçeve Stili</div>
                          {[
                            { id: 'default', label: 'Standart Rozetler', desc: 'Klasik koyu arka planlı etiketler' },
                            { id: 'neon', label: 'Canlı Neon Kontur', desc: 'Canlı renkli kenarlık ve parlaklık' },
                            { id: 'minimal', label: 'Ultra Minimal Şeffaf', desc: 'Hafif saydam ve sade minimalist' },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setUiExperiments((p) => ({ ...p, badgeStyle: opt.id as any }));
                              }}
                              className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                                uiExperiments.badgeStyle === opt.id
                                  ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                                  : 'hover:bg-white/5 text-neutral-300'
                              }`}
                            >
                              <div>
                                <div className="font-medium">{opt.label}</div>
                                <div className="text-[10px] text-neutral-400 leading-tight">{opt.desc}</div>
                              </div>
                              {uiExperiments.badgeStyle === opt.id && (
                                <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2" />
                              )}
                            </button>
                          ))}
                        </div>

                        {/* Rozet Yoğunluğu */}
                        <div className="space-y-1.5 pt-2 border-t border-white/10">
                          <div className="text-[11px] font-semibold text-slate-300 px-1">Rozet Yoğunluğu</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { id: 'full', label: 'Tam Detay' },
                              { id: 'hover-only', label: 'Yalnızca Hover' },
                            ].map((d) => (
                              <button
                                key={d.id}
                                onClick={() =>
                                  setUiExperiments((p) => ({ ...p, badgeDensity: d.id as any }))
                                }
                                className={`p-1.5 rounded-lg text-[11px] font-medium border text-center transition-all cursor-pointer ${
                                  uiExperiments.badgeDensity === d.id
                                    ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                                    : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                                }`}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Main Floating Appearance Bar */}
              <div
                className={`bg-neutral-900/90 border border-white/20 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-2xl flex items-center gap-1.5 text-xs select-none transition-all duration-300 ${
                  highlightQuickBar
                    ? 'animate-quick-bar-highlight ring-4 ring-blue-500/80 border-blue-400 shadow-[0_0_35px_rgba(59,130,246,0.6)]'
                    : ''
                }`}
              >
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-1 flex items-center gap-1">
                  <Palette className="w-3 h-3 text-blue-400" />
                  Görünüm:
                </span>

                {/* 1. Tema Seçimi */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenUiTestMenu((p) => (p === 'theme' ? null : 'theme'))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                    openUiTestMenu === 'theme'
                      ? 'bg-blue-600 text-white shadow'
                      : viewSettings.theme && viewSettings.theme !== 'pure-dark'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                  }`}
                >
                  <span>
                    Tema
                    {viewSettings.theme === 'charcoal-gray' && ': Koyu Gri'}
                    {viewSettings.theme === 'nordic-frost' && ': Kuzey'}
                    {viewSettings.theme === 'crimson-night' && ': Kızıl'}
                    {viewSettings.theme === 'emerald-abyss' && ': Zümrüt'}
                    {viewSettings.theme === 'amethyst-twilight' && ': Ametist'}
                    {(!viewSettings.theme || viewSettings.theme === 'pure-dark') && ': OLED'}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      openUiTestMenu === 'theme' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* 2. Üst Bar Group (Gri Kutu & Buzlu Cam) */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenUiTestMenu((p) => (p === 'toolbar' ? null : 'toolbar'))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                    openUiTestMenu === 'toolbar'
                      ? 'bg-blue-600 text-white shadow'
                      : uiExperiments.toolbarStyle !== 'default'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                  }`}
                >
                  <span>
                    Üst Bar
                    {uiExperiments.toolbarStyle === 'box' && ': Kutu'}
                    {uiExperiments.toolbarStyle === 'glass' && ': Cam'}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      openUiTestMenu === 'toolbar' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* 3. Kart Efekti & Dizayn Group */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenUiTestMenu((p) => (p === 'card' ? null : 'card'))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                    openUiTestMenu === 'card'
                      ? 'bg-blue-600 text-white shadow'
                      : uiExperiments.cardVignette !== 'none' || uiExperiments.cardRadius !== 'normal' || uiExperiments.cardHoverMotion !== 'lift'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                  }`}
                >
                  <span>
                    Kart
                    {uiExperiments.cardVignette !== 'none' && ' • Vinyet'}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      openUiTestMenu === 'card' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* 4. Arka Plan Doku Group */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenUiTestMenu((p) => (p === 'bg' ? null : 'bg'))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                    openUiTestMenu === 'bg'
                      ? 'bg-blue-600 text-white shadow'
                      : uiExperiments.bgAtmosphere !== 'default'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                  }`}
                >
                  <span>
                    Zemin
                    {uiExperiments.bgAtmosphere === 'dots' && ': Noktalı'}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      openUiTestMenu === 'bg' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* 5. Rozet Stili Group */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenUiTestMenu((p) => (p === 'badge' ? null : 'badge'))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                    openUiTestMenu === 'badge'
                      ? 'bg-blue-600 text-white shadow'
                      : uiExperiments.badgeStyle !== 'default' || uiExperiments.badgeDensity !== 'full'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                  }`}
                >
                  <span>
                    Rozet
                    {uiExperiments.badgeStyle === 'neon' && ': Neon'}
                    {uiExperiments.badgeStyle === 'minimal' && ': Sade'}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      openUiTestMenu === 'badge' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Reset Button (visible if any experiment is active) */}
                {(uiExperiments.toolbarStyle !== 'default' ||
                  uiExperiments.cardGlow ||
                  uiExperiments.cardVignette !== 'none' ||
                  uiExperiments.cardRadius !== 'normal' ||
                  uiExperiments.cardHoverMotion !== 'zoom' ||
                  uiExperiments.bgAtmosphere !== 'default' ||
                  uiExperiments.badgeStyle !== 'default' ||
                  uiExperiments.badgeDensity !== 'full') && (
                  <button
                    type="button"
                    onClick={() => {
                      setDialogOptions({
                        type: 'confirm',
                        title: 'Görünüm Ayarlarını Sıfırla',
                        message: 'Tüm arayüz görünüm ve kart efektleri varsayılan ayarlara döndürülecek. Emin misiniz?',
                        confirmText: 'Evet, Sıfırla',
                        cancelText: 'Vazgeç',
                        onConfirm: () => {
                          setUiExperiments({
                            toolbarStyle: 'default',
                            cardGlow: false,
                            cardVignette: 'none',
                            cardRadius: 'normal',
                            cardHoverMotion: 'zoom',
                            bgAtmosphere: 'default',
                            badgeStyle: 'default',
                            badgeDensity: 'full',
                          });
                          setOpenUiTestMenu(null);
                        },
                      });
                    }}
                    title="Görünüm ayarlarını varsayılana sıfırla"
                    className="px-2 py-1 rounded-lg text-[11px] font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Sıfırla</span>
                  </button>
                )}

                {/* Close Quick Bar Button */}
                <button
                  type="button"
                  onClick={() => {
                    setViewSettings((p) => ({ ...p, showQuickAppearanceBar: false }));
                    setOpenUiTestMenu(null);
                  }}
                  title="Hızlı görünüm çubuğunu gizle (Ayarlar > Görünüm'den tekrar açabilirsiniz)"
                  className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer ml-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- Modals --- */}

      {/* 1. Item Detail & Edit Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          categories={currentCategories}
          allItems={appData.items}
          onSave={handleSaveItem}
          onDelete={handleDeleteItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* 2. Add Item Modal */}
      {isAddModalOpen && (
        <AddItemModal
          mainTab={mainTab}
          categories={currentCategories}
          activeCatId={activeCatId !== TRACKED_TAB_ID ? activeCatId : null}
          activeSub={activeSub}
          allItems={appData.items}
          onAdd={handleAddItem}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* 3. Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          appData={appData}
          activeMainTab={mainTab}
          dirHandle={dirHandle}
          viewSettings={viewSettings}
          onUpdateViewSettings={(newSet) => {
            if (newSet.showQuickAppearanceBar && !viewSettings.showQuickAppearanceBar) {
              setHighlightQuickBar(true);
              setTimeout(() => setHighlightQuickBar(false), 2200);
            }
            setViewSettings((prev) => ({ ...prev, ...newSet }));
          }}
          uiExperiments={uiExperiments}
          onUpdateUiExperiments={setUiExperiments}
          onConnectFolder={handleConnectFolder}
          onDisconnectFolder={handleDisconnectFolder}
          onUpdateCategories={handleUpdateCategories}
          onUpdateItems={(newItems) => {
            setAppData((prev) => ({ ...prev, items: newItems }));
          }}
          onSelectItem={(item) => {
            setSelectedItem(item);
          }}
          onReplaceAllData={(newData) => {
            setAppData(newData);
            setIsSettingsOpen(false);
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* 4. Statistics Modal */}
      {isStatisticsOpen && (
        <StatisticsModal
          items={appData.items}
          categories={appData.categories}
          initialTab={mainTab}
          onClose={() => setIsStatisticsOpen(false)}
        />
      )}

      {/* 5. Image Large Preview Lightbox Modal (Triggered by 'F' key) */}
      {previewItem && (
        <ImagePreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}

      {/* 6. Bulk Move Modal */}
      {isBulkMoveOpen && (
        <BulkMoveModal
          isOpen={isBulkMoveOpen}
          selectedCount={selectedItemIds.size}
          mainTab={mainTab}
          categories={currentCategories}
          onClose={() => setIsBulkMoveOpen(false)}
          onMove={handleBulkMove}
        />
      )}

      {/* 7. Centered Custom In-App Dialog / Report Modal */}
      {dialogOptions && (
        <CustomDialog
          options={dialogOptions}
          onClose={() => setDialogOptions(null)}
        />
      )}
    </div>
  );
}
