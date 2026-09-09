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
  FollowIndicatorModel,
  FollowIndicatorColor,
  FollowIndicatorIconType,
  RatingIconType,
  isTierListAvailable,
  FabPositions,
  FabPositionProfile,
  DEFAULT_FAB_POSITIONS,
  DEFAULT_FAB_PROFILES,
  areFabPositionsEqual,
  normalizeFabPositions,
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
import { downloadTierListAsPng } from './utils/tierImageExport';

import { HeaderTabs, TRACKED_TAB_ID } from './components/HeaderTabs';
import { ItemCard } from './components/ItemCard';
import { TrackedView } from './components/TrackedView';
import { TierListView } from './components/TierListView';
import { ItemDetailModal } from './components/ItemDetailModal';
import { AddItemModal } from './components/AddItemModal';
import { SettingsModal } from './components/SettingsModal';
import { StatisticsModal } from './components/StatisticsModal';
import { RecentActivityModal } from './components/RecentActivityModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { BulkMoveModal } from './components/BulkMoveModal';
import { CustomDialog, CustomDialogOptions } from './components/CustomDialog';
import { FOLLOW_MODELS, FOLLOW_COLORS, FollowBadge, getFollowColor, RATING_ICON_OPTIONS } from './components/FollowIndicatorIcon';
import { FabPositionEditOverlay } from './components/FabPositionEditOverlay';
import {
  Plus,
  BarChart3,
  History,
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
  const [searchMode, setSearchMode] = useState<'search' | 'tag'>('search');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);
  const [isRecentActivityOpen, setIsRecentActivityOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ArchiveItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ArchiveItem | null>(null);
  const [previewItem, setPreviewItem] = useState<ArchiveItem | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'categories' | 'tags' | 'themes' | 'shortcuts' | 'storage' | undefined
  >(undefined);
  const [highlightConnectFolder, setHighlightConnectFolder] = useState(false);

  // FAB Position Live Edit Mode States
  const [isEditingFabMode, setIsEditingFabMode] = useState(false);
  const [selectedFab, setSelectedFab] = useState<keyof FabPositions | null>(null);
  const [tempFabPositions, setTempFabPositions] = useState<FabPositions>(DEFAULT_FAB_POSITIONS);

  // UI Experiments State for visual appearance and atmosphere
  const [uiExperiments, setUiExperiments] = useState<UiExperimentsState>(() => {
    const savedModel = (safeLocalStorageGet('yapim_follow_indicator_model') as FollowIndicatorModel) || 'underline-accent';
    const savedColor = (safeLocalStorageGet('yapim_follow_indicator_color') as FollowIndicatorColor) || 'sky';
    const savedFollow = (safeLocalStorageGet('yapim_follow_indicator_icon') as FollowIndicatorIconType) || 'megaphone';
    const rawSavedRating = safeLocalStorageGet('yapim_rating_icon') as RatingIconType | null;
    const savedRating = (!rawSavedRating || rawSavedRating === 'star') ? 'star-2' : rawSavedRating;
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
          cardHoverMotion: parsed.cardHoverMotion || 'none',
          bgAtmosphere: parsed.bgAtmosphere === 'topglow' ? 'default' : (parsed.bgAtmosphere || 'default'),
          badgeStyle: parsed.badgeStyle || 'default',
          badgeDensity,
          tierListStyle: (parsed.tierListStyle === 'classic' ? 'classic' : 'modern') as any,
          followIndicatorModel: parsed.followIndicatorModel || savedModel,
          followIndicatorColor: parsed.followIndicatorColor || savedColor,
          followIndicatorIcon: parsed.followIndicatorIcon || savedFollow,
          ratingIcon: (parsed.ratingIcon && parsed.ratingIcon !== 'star') ? parsed.ratingIcon : savedRating,
        };
      } catch {}
    }
    return {
      toolbarStyle: 'default',
      cardVignette: 'none',
      cardRadius: 'normal',
      cardHoverMotion: 'none',
      bgAtmosphere: 'default',
      badgeStyle: 'default',
      badgeDensity: 'full',
      tierListStyle: 'modern',
      followIndicatorModel: savedModel,
      followIndicatorColor: savedColor,
      followIndicatorIcon: savedFollow,
      ratingIcon: savedRating,
    };
  });

  const [openUiTestMenu, setOpenUiTestMenu] = useState<'theme' | 'toolbar' | 'card' | 'bg' | 'badge' | 'icon' | 'tierlist' | null>(null);
  const [showFollowColorPicker, setShowFollowColorPicker] = useState<boolean>(false);
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
    const savedModel = (safeLocalStorageGet('yapim_follow_indicator_model') as FollowIndicatorModel) || 'underline-accent';
    const savedColor = (safeLocalStorageGet('yapim_follow_indicator_color') as FollowIndicatorColor) || 'sky';
    const savedFollow = (safeLocalStorageGet('yapim_follow_indicator_icon') as FollowIndicatorIconType) || 'megaphone';
    const rawSavedRating = safeLocalStorageGet('yapim_rating_icon') as RatingIconType | null;
    const savedRating = (!rawSavedRating || rawSavedRating === 'star') ? 'star-2' : rawSavedRating;
    const saved = safeLocalStorageGet('yapim_view_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const theme = parsed.theme === 'dark-slate' ? 'nordic-frost' : (parsed.theme || 'pure-dark');
        return {
          showTitle: false,
          showRating: true,
          showYear: true,
          showAnki: false,
          showWatching: true,
          showFollowing: true,
          showGameStatus: true,
          cardSize: 2,
          showQuickAppearanceBar: false,
          fabPositions: (() => {
            const norm = normalizeFabPositions(parsed.fabPositions);
            if (norm.statistics.bottom === 12 && norm.statistics.side === 16 &&
                norm.recentActivity.bottom === 12 && norm.recentActivity.side === 56 &&
                norm.addItem.bottom === 12 && norm.addItem.side === 24) {
              return DEFAULT_FAB_POSITIONS;
            }
            return norm;
          })(),
          fabProfiles: Array.isArray(parsed.fabProfiles) && parsed.fabProfiles.length > 0
            ? parsed.fabProfiles.map((p: any) => {
                const norm = normalizeFabPositions(p.positions);
                if (p.id === 'default' && norm.statistics.bottom === 12 && norm.statistics.side === 16 &&
                    norm.recentActivity.bottom === 12 && norm.recentActivity.side === 56 &&
                    norm.addItem.bottom === 12 && norm.addItem.side === 24) {
                  return { ...p, positions: DEFAULT_FAB_POSITIONS };
                }
                return { ...p, positions: norm };
              })
            : DEFAULT_FAB_PROFILES,
          ...parsed,
          theme,
          followIndicatorModel: parsed.followIndicatorModel || savedModel,
          followIndicatorColor: parsed.followIndicatorColor || savedColor,
          followIndicatorIcon: parsed.followIndicatorIcon || savedFollow,
          ratingIcon: (parsed.ratingIcon && parsed.ratingIcon !== 'star') ? parsed.ratingIcon : savedRating,
        };
      } catch {}
    }
    return {
      showTitle: false,
      showRating: true,
      showYear: true,
      showAnki: false,
      showWatching: true,
      showFollowing: true,
      showGameStatus: true,
      cardSize: 2,
      theme: 'pure-dark',
      showQuickAppearanceBar: false,
      fabPositions: DEFAULT_FAB_POSITIONS,
      fabProfiles: DEFAULT_FAB_PROFILES,
      followIndicatorModel: savedModel,
      followIndicatorColor: savedColor,
      followIndicatorIcon: savedFollow,
      ratingIcon: savedRating,
    };
  });

  const handleSelectFollowModel = (model: FollowIndicatorModel) => {
    safeLocalStorageSet('yapim_follow_indicator_model', model);
    setViewSettings((prev) => ({ ...prev, followIndicatorModel: model }));
    setUiExperiments((prev) => ({ ...prev, followIndicatorModel: model }));
  };

  const handleSelectFollowColor = (color: FollowIndicatorColor) => {
    safeLocalStorageSet('yapim_follow_indicator_color', color);
    setViewSettings((prev) => ({ ...prev, followIndicatorColor: color }));
    setUiExperiments((prev) => ({ ...prev, followIndicatorColor: color }));
  };

  const handleSelectRatingIcon = (icon: RatingIconType) => {
    safeLocalStorageSet('yapim_rating_icon', icon);
    setViewSettings((prev) => ({ ...prev, ratingIcon: icon }));
    setUiExperiments((prev) => ({ ...prev, ratingIcon: icon }));
  };

  // Persist viewSettings and set data-theme on document root
  useEffect(() => {
    safeLocalStorageSet('yapim_view_settings', JSON.stringify(viewSettings));
    document.documentElement.setAttribute(
      'data-theme',
      viewSettings.theme || 'pure-dark'
    );
  }, [viewSettings]);

  // Lock document body scroll when any modal or overlay is open to prevent background scrolling & lag
  const isAnyModalOpen = Boolean(
    selectedItem ||
    isAddModalOpen ||
    isSettingsOpen ||
    isStatisticsOpen ||
    isRecentActivityOpen ||
    previewItem ||
    isBulkMoveOpen ||
    isEditingFabMode
  );

  useEffect(() => {
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isAnyModalOpen]);

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

  // Desktop Folder connection guard (Ensures local folder is connected before add/edit on desktop)
  const requireFolderOnDesktop = (): boolean => {
    // Mobilde salt okuma yapıldığı için mobil deneyim hiçbir şekilde etkilenmez
    if (!dirHandle && typeof window !== 'undefined' && window.innerWidth >= 768) {
      setPreviewItem(null);
      setSettingsInitialTab('storage');
      setHighlightConnectFolder(true);
      setIsSettingsOpen(true);
      setDialogOptions({
        type: 'alert',
        title: 'Klasör Bağlantısı Gerekli',
        message: 'İşlem yapabilmek için lütfen önce yerel arşiv klasörünüzü bağlayın.',
        confirmText: 'Tamam',
      });
      return false;
    }
    return true;
  };

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
        if (selectedItem || isAddModalOpen) {
          // Do not close edit or add modal with ESC to prevent accidental data loss!
          return;
        }
        e.preventDefault();
        if (previewItem) {
          setPreviewItem(null);
        } else if (isRecentActivityOpen) {
          setIsRecentActivityOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
          setHighlightConnectFolder(false);
          setSettingsInitialTab(undefined);
        } else if (isFilterOpen || isViewOpen) {
          closeAllPanels();
        } else if (isSearchOpen) {
          setIsSearchOpen(false);
          setSearchQuery('');
        } else {
          setSettingsInitialTab(undefined);
          setHighlightConnectFolder(false);
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
        if (!requireFolderOnDesktop()) return;
        setIsAddModalOpen(true);
        return;
      }

      // 'F' or 'f' key -> Toggle Fullscreen On/Off
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        return;
      }

      // 'Tab' key -> Toggle between Grid and Tier List view if tier list is enabled for active category and subgroup
      if (e.key === 'Tab') {
        if (isTierListAvailable(activeCategory, activeSub)) {
          e.preventDefault();
          setViewMode((prev) => (prev === 'grid' ? 'tier' : 'grid'));
        }
        return;
      }

      // 'Q' or 'q' key -> Toggle Statistics Modal (İstatistikler)
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        closeAllPanels();
        setIsStatisticsOpen((prev) => !prev);
        return;
      }

      // 'E' or 'e' key -> Toggle Recent Activity Modal (Son Aktiviteler)
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        closeAllPanels();
        setIsRecentActivityOpen((prev) => !prev);
        return;
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
          setHighlightConnectFolder(false);
          setSettingsInitialTab(undefined);
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
    const itemWithTimestamps: ArchiveItem = {
      ...newItem,
      createdAt: newItem.createdAt || Date.now(),
      updatedAt: newItem.updatedAt || Date.now(),
    };
    setAppData((prev) => {
      const updated: AppData = {
        ...prev,
        lastUpdated: new Date().toISOString(),
        items: [itemWithTimestamps, ...prev.items],
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
    const itemWithTimestamp: ArchiveItem = {
      ...updatedItem,
      updatedAt: Date.now(),
    };
    setAppData((prev) => {
      const updated: AppData = {
        ...prev,
        lastUpdated: new Date().toISOString(),
        items: prev.items.map((it) => (it.id === itemWithTimestamp.id ? itemWithTimestamp : it)),
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

  // Auto-switch back to Grid mode if Tier List becomes unavailable for current category/subgroup
  useEffect(() => {
    if (viewMode === 'tier' && !isTierListAvailable(activeCategory, activeSub)) {
      setViewMode('grid');
    }
  }, [viewMode, activeCategory, activeSub]);

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

  const handleExportTierPng = useCallback(() => {
    if (!activeCategory) return;
    const catItems = appData.items.filter(
      (item) => item.cat === activeCategory.id && (!activeSub || item.sub === activeSub)
    );
    downloadTierListAsPng(activeCategory, catItems, mainTab, {
      scale: 2,
      includeTitles: true,
      isClassic: uiExperiments.tierListStyle === 'classic',
    });
  }, [activeCategory, appData.items, activeSub, mainTab, uiExperiments.tierListStyle]);

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
          const itemYear = item.releaseYear ? item.releaseYear.toString() : '';
          const itemCharNames = (item.characters || []).map((c) => (c.name || '').toLowerCase());
          const itemCharActors = (item.characters || [])
            .map((c) => (c.actor || '').toLowerCase())
            .filter(Boolean);

          // Check if ALL terms match the item (AND logic)
          const matchesAllTerms = terms.every((term) => {
            if (itemTitle.includes(term)) return true;
            if (itemDesc.includes(term)) return true;
            if (itemDate.includes(term)) return true;
            if (itemYear.includes(term)) return true;
            if (itemCat.includes(term)) return true;
            if (itemSub.includes(term)) return true;
            if (itemStatus.includes(term)) return true;
            if (itemGenres.some((g) => g.includes(term))) return true;
            if (itemFirms.some((f) => f.includes(term))) return true;
            if (itemDirectors.some((d) => d.includes(term))) return true;
            if (itemActors.some((a) => a.includes(term))) return true;
            if (itemDevelopers.some((d) => d.includes(term))) return true;
            if (itemCharNames.some((n) => n.includes(term))) return true;
            if (itemCharActors.some((a) => a.includes(term))) return true;
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

  // Card size calculation for CSS Grid auto-fill (1: 150px [Küçük], 2: 185px [Standart], 3: 215px [Orta-Büyük], 4: 250px [Büyük], 5: 295px [Ekstra])
  const cardMinWidth = useMemo(() => {
    const size = viewSettings.cardSize || 2;
    switch (size) {
      case 1:
        return 150; // Küçük
      case 2:
        return 185; // Standart
      case 3:
        return 215; // Orta-Büyük (Standart ile Büyük arası)
      case 4:
        return 250; // Büyük
      case 5:
        return 295; // Ekstra
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
          searchMode={searchMode}
          onSearchModeChange={setSearchMode}
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
          onExportTierPng={handleExportTierPng}
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
            setSettingsInitialTab(undefined);
            setHighlightConnectFolder(false);
            if (dirHandle) {
              const isAccessible = await checkDirectoryHandleAccessibility(dirHandle);
              if (!isAccessible) {
                setDirHandle(null);
                await storeDirectoryHandle(null as any);
              }
            }
            setIsSettingsOpen(true);
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
                  setPreviewItem(item);
                }
              }}
              onItemPreview={(item) => {
                if (isSelectionMode) {
                  handleToggleSelectItem(item.id);
                } else {
                  setPreviewItem(item);
                }
              }}
              onItemEdit={(item) => {
                if (!isSelectionMode) {
                  if (!requireFolderOnDesktop()) return;
                  setSelectedItem(item);
                }
              }}
              onItemHover={(item) => setHoveredItem(item)}
              isSelectionMode={isSelectionMode}
              selectedItemIds={selectedItemIds}
              onToggleSelectItem={handleToggleSelectItem}
            />
          ) : isTierListAvailable(activeCategory, activeSub) && viewMode === 'tier' ? (
            /* B: Tier List View */
            <TierListView
              mainTab={mainTab}
              category={activeCategory!}
              activeSub={activeSub}
              items={appData.items}
              movedItemIds={movedItemIds}
              tierListStyle={uiExperiments.tierListStyle || 'modern'}
              onUpdateTierPlacement={handleUpdateTierPlacement}
              onBatchUpdateTierPlacements={handleBatchUpdateTierPlacements}
              onUpdateCategoryRows={(rows) =>
                handleUpdateCategoryTierRows(activeCategory!.id, rows)
              }
              onItemClick={(item) => {
                setPreviewItem(item);
              }}
              onItemHover={(item) => setHoveredItem(item)}
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
                          setPreviewItem(item);
                        }
                      }}
                      onPreview={() => {
                        if (isSelectionMode) {
                          handleToggleSelectItem(item.id);
                        } else {
                          setPreviewItem(item);
                        }
                      }}
                      onEdit={() => {
                        if (!isSelectionMode) {
                          if (!requireFolderOnDesktop()) return;
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
                    onClick={() => {
                      if (!requireFolderOnDesktop()) return;
                      setIsAddModalOpen(true);
                    }}
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

      {/* Floating Action Buttons (FABs) */}
      {(viewMode === 'grid' || isEditingFabMode) && (
        <>
          {(() => {
            const normPositions = normalizeFabPositions(
              isEditingFabMode ? tempFabPositions : viewSettings.fabPositions
            );

            const statPos = normPositions.statistics;
            const recentPos = normPositions.recentActivity;
            const addPos = normPositions.addItem;

            return (
              <>
                {/* 1. Statistics Button */}
                <div
                  className={`fixed transition-all duration-150 ${
                    isEditingFabMode ? 'z-[65]' : 'z-40'
                  }`}
                  style={{ bottom: `${statPos.bottom}px`, left: `${statPos.side}px` }}
                >
                  <button
                    id="fab-statistics-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditingFabMode) {
                        setSelectedFab('statistics');
                        return;
                      }
                      closeAllPanels();
                      setIsStatisticsOpen((prev) => !prev);
                    }}
                    title={
                      isEditingFabMode
                        ? `İstatistikler (${statPos.bottom}px x ${statPos.side}px)`
                        : 'İstatistikler & Grafikler (Kısayol: Q)'
                    }
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 backdrop-blur-md cursor-pointer group ${
                      isEditingFabMode
                        ? selectedFab === 'statistics'
                          ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-950 shadow-lg shadow-blue-500/40 opacity-100'
                          : 'bg-slate-900/90 text-slate-300 ring-1 ring-dashed ring-blue-400/50 hover:ring-blue-400 opacity-80 hover:opacity-100 border border-white/20'
                        : 'bg-slate-900/80 hover:bg-blue-600 text-slate-400 hover:text-white shadow-md hover:shadow-blue-600/30 hover:scale-105 active:scale-95 border border-white/10 hover:border-blue-400/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />

                    {isEditingFabMode && (
                      <span
                        className={`absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono whitespace-nowrap pointer-events-none shadow-md ${
                          selectedFab === 'statistics'
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-900/95 border border-white/20 text-slate-300'
                        }`}
                      >
                        {statPos.bottom}x{statPos.side}px
                      </span>
                    )}
                  </button>
                </div>

                {/* 2. Recent Activity Button */}
                <div
                  className={`fixed transition-all duration-150 ${
                    isEditingFabMode ? 'z-[65]' : 'z-40'
                  }`}
                  style={{ bottom: `${recentPos.bottom}px`, left: `${recentPos.side}px` }}
                >
                  <button
                    id="fab-recent-activity-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditingFabMode) {
                        setSelectedFab('recentActivity');
                        return;
                      }
                      closeAllPanels();
                      setIsRecentActivityOpen((prev) => !prev);
                    }}
                    title={
                      isEditingFabMode
                        ? `Son Aktiviteler (${recentPos.bottom}px x ${recentPos.side}px)`
                        : 'Son Aktiviteler (Kısayol: E)'
                    }
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 backdrop-blur-md cursor-pointer group ${
                      isEditingFabMode
                        ? selectedFab === 'recentActivity'
                          ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-950 shadow-lg shadow-blue-500/40 opacity-100'
                          : 'bg-slate-900/90 text-slate-300 ring-1 ring-dashed ring-blue-400/50 hover:ring-blue-400 opacity-80 hover:opacity-100 border border-white/20'
                        : 'bg-slate-900/80 hover:bg-blue-600 text-slate-400 hover:text-white shadow-md hover:shadow-blue-600/30 hover:scale-105 active:scale-95 border border-white/10 hover:border-blue-400/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <History className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />

                    {isEditingFabMode && (
                      <span
                        className={`absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono whitespace-nowrap pointer-events-none shadow-md ${
                          selectedFab === 'recentActivity'
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-900/95 border border-white/20 text-slate-300'
                        }`}
                      >
                        {recentPos.bottom}x{recentPos.side}px
                      </span>
                    )}
                  </button>
                </div>

                {/* 3. Add Item Button */}
                {(isEditingFabMode || activeCatId !== TRACKED_TAB_ID) && (
                  <div
                    className={`fixed transition-all duration-150 ${
                      isEditingFabMode ? 'z-[65] flex' : 'hidden md:flex z-40'
                    }`}
                    style={{ bottom: `${addPos.bottom}px`, right: `${addPos.side}px` }}
                  >
                    <button
                      id="fab-add-item-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isEditingFabMode) {
                          setSelectedFab('addItem');
                          return;
                        }
                        closeAllPanels();
                        if (!requireFolderOnDesktop()) return;
                        setIsAddModalOpen(true);
                      }}
                      title={
                        isEditingFabMode
                          ? `Yeni Ekle Butonunu Seç (${addPos.bottom}px x ${addPos.side}px)`
                          : !dirHandle
                          ? 'Klasör Bağlı Değil — Yapım eklemek için klasör bağlayın (Kısayol: W)'
                          : 'Yeni Ekle (Kısayol: W)'
                      }
                      className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-150 backdrop-blur-md cursor-pointer group ${
                        isEditingFabMode
                          ? selectedFab === 'addItem'
                            ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-950 shadow-lg shadow-blue-500/40 opacity-100'
                            : 'bg-slate-800/90 text-slate-200 ring-1 ring-dashed ring-blue-400/50 hover:ring-blue-400 opacity-80 hover:opacity-100 border border-white/20'
                          : !dirHandle
                          ? 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/50 hover:border-amber-400 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 ring-2 ring-amber-400/30 hover:scale-105 active:scale-95'
                          : 'bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white shadow-lg shadow-black/40 hover:shadow-blue-600/30 border border-white/10 hover:border-blue-400/40 hover:scale-105 active:scale-95'
                      }`}
                    >
                      <Plus
                        className={`w-5 h-5 transition-transform duration-200 group-hover:rotate-90 ${
                          !isEditingFabMode && !dirHandle ? 'text-amber-300 group-hover:text-white' : ''
                        }`}
                      />

                      {isEditingFabMode && (
                        <span
                          className={`absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono whitespace-nowrap pointer-events-none shadow-md ${
                            selectedFab === 'addItem'
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-slate-900/95 border border-white/20 text-slate-300'
                          }`}
                        >
                          {addPos.bottom}x{addPos.side}px
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* Bottom Center Grouped UI Appearance & Atmosphere Bar (Persistent if enabled) */}
      {Boolean(viewSettings.showQuickAppearanceBar) && (
            <div
              id="ui-test-experiment-bar"
              onClick={(e) => e.stopPropagation()}
              className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-auto"
            >
              {/* Active Category Popover Menu */}
              {openUiTestMenu && (
                <div
                  id="ui-test-popover-menu"
                  className="mb-2 bg-neutral-900/95 border border-white/20 backdrop-blur-xl p-3 rounded-2xl shadow-2xl w-[350px] max-w-[92vw] text-xs animate-in fade-in zoom-in-95 duration-150 max-h-[70vh] overflow-y-auto custom-scrollbar"
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
                        {openUiTestMenu === 'icon' && 'İkon Seçenekleri'}
                        {openUiTestMenu === 'tierlist' && 'Tier List'}
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

                    {/* 6. İkon Seçenekleri (Takip Rozeti & Puan İkonu) */}
                    {openUiTestMenu === 'icon' && (
                      <div className="space-y-3 p-1 min-w-[260px] sm:min-w-[280px]">
                        {/* Takip Rozeti İkonu & Renk Seçimi (Kompakt Tek Satır Blok) */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-300 px-1">Takip Rozeti İkonu</div>
                          <div className="flex items-center gap-2">
                            {/* 3 Model Butonu - Kompakt */}
                            <div className="grid grid-cols-3 gap-1.5 flex-1">
                              {FOLLOW_MODELS.map((mod) => {
                                const isSelected = (viewSettings.followIndicatorModel || 'underline-accent') === mod.id;
                                return (
                                  <button
                                    key={mod.id}
                                    type="button"
                                    onClick={() => handleSelectFollowModel(mod.id)}
                                    className={`py-1.5 px-1 rounded-xl text-[10px] font-medium border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                                      isSelected
                                        ? 'bg-blue-600/30 text-blue-200 border-blue-500/60 shadow-sm ring-1 ring-blue-500/30'
                                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200'
                                    }`}
                                  >
                                    {/* Live Preview */}
                                    <div className="flex items-center gap-0.5 bg-black/60 px-1 py-0.5 rounded border border-white/10 pointer-events-none scale-90">
                                      <FollowBadge
                                        hasFollowInfo={true}
                                        model={mod.id}
                                        color={viewSettings.followIndicatorColor || 'sky'}
                                        badgeStyle={uiExperiments.badgeStyle}
                                      />
                                    </div>
                                    <span className="font-semibold text-[10px] leading-tight">{mod.shortLabel}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Sağda Tek Renk Butonu (Tıklanınca Açılan Popover Renk Paleti) */}
                            <div className="relative shrink-0 flex items-center">
                              {(() => {
                                const activeColorObj =
                                  FOLLOW_COLORS.find(
                                    (c) => (viewSettings.followIndicatorColor || 'sky') === c.id
                                  ) || FOLLOW_COLORS[0];
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowFollowColorPicker((prev) => !prev);
                                      }}
                                      title={`Renk: ${activeColorObj.label} (Değiştirmek için tıklayın)`}
                                      className={`h-full px-2.5 py-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-sm ${
                                        showFollowColorPicker
                                          ? 'bg-blue-600/20 border-blue-500/60 ring-1 ring-blue-500/40'
                                          : 'bg-white/5 border-white/15 hover:bg-white/10 hover:border-white/30'
                                      }`}
                                    >
                                      <div
                                        className="w-4 h-4 rounded-full border border-white/70 shadow-sm flex items-center justify-center transition-transform hover:scale-110"
                                        style={{ backgroundColor: activeColorObj.hex }}
                                      />
                                      <span className="text-[9px] font-semibold text-slate-300 leading-none">Renk</span>
                                    </button>

                                    {/* Tıklanınca Açılan Popover Renk Paleti */}
                                    {showFollowColorPicker && (
                                      <div
                                        className="absolute bottom-full right-0 mb-2 p-1.5 bg-neutral-900/98 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-50 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {FOLLOW_COLORS.map((col) => {
                                          const isSelected =
                                            (viewSettings.followIndicatorColor || 'sky') === col.id;
                                          return (
                                            <button
                                              key={col.id}
                                              type="button"
                                              onClick={() => {
                                                handleSelectFollowColor(col.id);
                                                setShowFollowColorPicker(false);
                                              }}
                                              title={col.label}
                                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                                                isSelected
                                                  ? 'border-white ring-2 ring-white/60 scale-110 shadow'
                                                  : 'border-white/10 hover:border-white/40 hover:scale-105'
                                              }`}
                                              style={{ backgroundColor: `${col.hex}30` }}
                                            >
                                              <div
                                                className="w-3 h-3 rounded-full flex items-center justify-center"
                                                style={{ backgroundColor: col.hex }}
                                              >
                                                {isSelected && (
                                                  <Check className="w-2 h-2 text-black stroke-[3.5]" />
                                                )}
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Puan İkonu (Sarı renk sabit, renk seçeneği yok) */}
                        <div className="space-y-1.5 pt-2 border-t border-white/10">
                          <div className="text-[11px] font-semibold text-slate-300 px-1">Puan İkonu</div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {RATING_ICON_OPTIONS.map((opt) => {
                              const isSelected = (viewSettings.ratingIcon || 'star-2') === opt.id;
                              const IconComponent = opt.icon;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleSelectRatingIcon(opt.id)}
                                  title={opt.label}
                                  className={`p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/70 ring-1 ring-amber-400/40 shadow-sm'
                                      : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200'
                                  }`}
                                >
                                  <IconComponent className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                  <span className="text-[10px] font-medium leading-none truncate max-w-full">
                                    {opt.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tier List options */}
                    {openUiTestMenu === 'tierlist' && (
                      <div className="space-y-1.5 p-1">
                        {[
                          { id: 'modern', label: 'Modern' },
                          { id: 'classic', label: 'Klasik' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setUiExperiments((p) => ({ ...p, tierListStyle: opt.id as any }))
                            }
                            className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                              (uiExperiments.tierListStyle || 'modern') === opt.id
                                ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                                : 'hover:bg-white/5 text-neutral-300'
                            }`}
                          >
                            <span className="font-medium">{opt.label}</span>
                            {(uiExperiments.tierListStyle || 'modern') === opt.id && (
                              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Main Floating Appearance Bar */}
              <div
                className={`bg-neutral-900/90 border border-white/20 backdrop-blur-md px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-2xl shadow-2xl flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs select-none whitespace-nowrap w-max max-w-[96vw] overflow-x-auto custom-scrollbar shrink-0 transition-colors duration-150 ${
                  highlightQuickBar
                    ? 'animate-quick-bar-highlight ring-4 ring-blue-500/80 border-blue-400 shadow-[0_0_35px_rgba(59,130,246,0.6)]'
                    : ''
                }`}
              >
                <span className="hidden sm:flex text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-1 items-center gap-1 shrink-0 whitespace-nowrap">
                  <Palette className="w-3 h-3 text-blue-400" />
                  Görünüm:
                </span>

                {/* 1. Tema Seçimi */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenUiTestMenu((p) => (p === 'theme' ? null : 'theme'))
                  }
                  className={`px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    openUiTestMenu === 'theme'
                      ? 'bg-blue-600 text-white shadow border border-blue-500'
                      : viewSettings.theme && viewSettings.theme !== 'pure-dark'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-transparent'
                  }`}
                >
                  <span>
                    Tema
                    <span className="hidden sm:inline">
                      {viewSettings.theme === 'charcoal-gray' && ': Koyu Gri'}
                      {viewSettings.theme === 'nordic-frost' && ': Kuzey'}
                      {viewSettings.theme === 'crimson-night' && ': Kızıl'}
                      {viewSettings.theme === 'emerald-abyss' && ': Zümrüt'}
                      {viewSettings.theme === 'amethyst-twilight' && ': Ametist'}
                      {(!viewSettings.theme || viewSettings.theme === 'pure-dark') && ': OLED'}
                    </span>
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
                  className={`px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    openUiTestMenu === 'toolbar'
                      ? 'bg-blue-600 text-white shadow border border-blue-500'
                      : uiExperiments.toolbarStyle !== 'default'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-transparent'
                  }`}
                >
                  <span>
                    Üst Bar
                    <span className="hidden sm:inline">
                      {uiExperiments.toolbarStyle === 'box' && ': Kutu'}
                      {uiExperiments.toolbarStyle === 'glass' && ': Cam'}
                    </span>
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
                  className={`px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    openUiTestMenu === 'card'
                      ? 'bg-blue-600 text-white shadow border border-blue-500'
                      : uiExperiments.cardVignette !== 'none' || uiExperiments.cardRadius !== 'normal' || uiExperiments.cardHoverMotion !== 'none'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-transparent'
                  }`}
                >
                  <span>
                    Kart
                    <span className="hidden sm:inline">
                      {uiExperiments.cardVignette !== 'none' && ' • Vinyet'}
                    </span>
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
                  className={`px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    openUiTestMenu === 'bg'
                      ? 'bg-blue-600 text-white shadow border border-blue-500'
                      : uiExperiments.bgAtmosphere !== 'default'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-transparent'
                  }`}
                >
                  <span>
                    Zemin
                    <span className="hidden sm:inline">
                      {uiExperiments.bgAtmosphere === 'dots' && ': Noktalı'}
                    </span>
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
                  className={`px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    openUiTestMenu === 'badge'
                      ? 'bg-blue-600 text-white shadow border border-blue-500'
                      : uiExperiments.badgeStyle !== 'default' || uiExperiments.badgeDensity !== 'full'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-transparent'
                  }`}
                >
                  <span>
                    Rozet
                    <span className="hidden sm:inline">
                      {uiExperiments.badgeStyle === 'neon' && ': Neon'}
                      {uiExperiments.badgeStyle === 'minimal' && ': Sade'}
                    </span>
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      openUiTestMenu === 'badge' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* 6. İkon Menüsü - Sadece "İkon", kutucuk ve model bilgisi yok */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenUiTestMenu((p) => (p === 'icon' ? null : 'icon'))
                  }
                  className={`px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    openUiTestMenu === 'icon'
                      ? 'bg-blue-600 text-white shadow border border-blue-500'
                      : (viewSettings.followIndicatorModel && viewSettings.followIndicatorModel !== 'underline-accent') ||
                        (viewSettings.followIndicatorColor && viewSettings.followIndicatorColor !== 'sky') ||
                        (viewSettings.ratingIcon && viewSettings.ratingIcon !== 'star-2')
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-transparent'
                  }`}
                >
                  <span>İkon</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      openUiTestMenu === 'icon' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* 7. Tier List Stili */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenUiTestMenu((p) => (p === 'tierlist' ? null : 'tierlist'))
                  }
                  className={`px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    openUiTestMenu === 'tierlist'
                      ? 'bg-blue-600 text-white shadow border border-blue-500'
                      : uiExperiments.tierListStyle && uiExperiments.tierListStyle !== 'modern'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-transparent'
                  }`}
                >
                  <span>Tier List</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      openUiTestMenu === 'tierlist' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Reset Button (visible if any experiment is active) */}
                {(uiExperiments.toolbarStyle !== 'default' ||
                  uiExperiments.cardGlow ||
                  uiExperiments.cardVignette !== 'none' ||
                  uiExperiments.cardRadius !== 'normal' ||
                  uiExperiments.cardHoverMotion !== 'none' ||
                  uiExperiments.bgAtmosphere !== 'default' ||
                  uiExperiments.badgeStyle !== 'default' ||
                  uiExperiments.badgeDensity !== 'full' ||
                  (uiExperiments.tierListStyle && uiExperiments.tierListStyle !== 'modern') ||
                  (viewSettings.followIndicatorModel && viewSettings.followIndicatorModel !== 'underline-accent') ||
                  (viewSettings.followIndicatorColor && viewSettings.followIndicatorColor !== 'sky') ||
                  (viewSettings.ratingIcon && viewSettings.ratingIcon !== 'star-2')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDialogOptions({
                        type: 'confirm',
                        title: 'Görünüm Ayarlarını Sıfırla',
                        message: 'Tüm arayüz görünüm, rozet ve ikon efektleri varsayılan ayarlara döndürülecek. Emin misiniz?',
                        confirmText: 'Evet, Sıfırla',
                        cancelText: 'Vazgeç',
                        onConfirm: () => {
                          setUiExperiments({
                            toolbarStyle: 'default',
                            cardGlow: false,
                            cardVignette: 'none',
                            cardRadius: 'normal',
                            cardHoverMotion: 'none',
                            bgAtmosphere: 'default',
                            badgeStyle: 'default',
                            badgeDensity: 'full',
                            tierListStyle: 'modern',
                            followIndicatorModel: 'underline-accent',
                            followIndicatorColor: 'sky',
                            followIndicatorIcon: 'megaphone',
                            ratingIcon: 'star-2',
                          });
                          handleSelectFollowModel('underline-accent');
                          handleSelectFollowColor('sky');
                          handleSelectRatingIcon('star-2');
                          setOpenUiTestMenu(null);
                        },
                      });
                    }}
                    title="Görünüm ayarlarını varsayılana sıfırla"
                    className="p-1.5 sm:px-2 sm:py-1 rounded-lg text-[11px] font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3 shrink-0" />
                    <span className="hidden sm:inline">Sıfırla</span>
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
                  className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer ml-0.5 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
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
          initialTab={settingsInitialTab}
          highlightConnectFolder={highlightConnectFolder}
          searchQuery={searchQuery}
          onSearchTag={(tag, tagMainTab) => {
            if (tagMainTab && tagMainTab !== mainTab) {
              setMainTab(tagMainTab);
              setActiveCatId(null);
              setActiveSub(null);
            }
            setSearchMode('tag');
            setSearchQuery(tag);
            setIsSearchOpen(true);
          }}
          onUpdateViewSettings={(newSet) => {
            if (newSet.showQuickAppearanceBar && !viewSettings.showQuickAppearanceBar) {
              setHighlightQuickBar(true);
              setTimeout(() => setHighlightQuickBar(false), 2200);
            }
            setViewSettings((prev) => ({ ...prev, ...newSet }));
          }}
          onStartFabPositionEdit={() => {
            setIsSettingsOpen(false);
            setTempFabPositions(normalizeFabPositions(viewSettings.fabPositions));
            setSelectedFab(null);
            setIsEditingFabMode(true);
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
            if (!requireFolderOnDesktop()) return;
            setSelectedItem(item);
          }}
          onReplaceAllData={(newData) => {
            setAppData(newData);
          }}
          onClose={() => {
            setIsSettingsOpen(false);
            setHighlightConnectFolder(false);
            setSettingsInitialTab(undefined);
          }}
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

      {/* 4.5. Recent Activity Modal */}
      {isRecentActivityOpen && (
        <RecentActivityModal
          isOpen={isRecentActivityOpen}
          items={appData.items}
          categories={appData.categories}
          onSelectItem={(item) => {
            // Son aktivitelerde karta tıklandığında düzenleme yerine kart detay penceresi açılır
            setPreviewItem(item);
          }}
          onNavigateToCategory={(targetTab, catId, sub) => {
            setIsRecentActivityOpen(false);
            setMainTab(targetTab);
            setActiveCatId(catId);
            setActiveSub(sub);
            setViewMode('grid');
          }}
          onClose={() => setIsRecentActivityOpen(false)}
        />
      )}

      {/* 5. Image Large Preview Lightbox Modal */}
      {previewItem && (
        <ImagePreviewModal
          item={previewItem}
          categories={currentCategories}
          allItems={appData.items}
          allCategories={[...appData.categories.media, ...appData.categories.game]}
          viewSettings={viewSettings}
          onClose={() => setPreviewItem(null)}
          onSelectItem={(newItem) => setPreviewItem(newItem)}
          onEdit={(itemToEdit) => {
            if (!requireFolderOnDesktop()) return;
            setPreviewItem(null);
            setSelectedItem(itemToEdit);
          }}
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

      {/* 8. Live FAB Position Edit Overlay */}
      {isEditingFabMode && (
        <FabPositionEditOverlay
          isOpen={isEditingFabMode}
          positions={tempFabPositions}
          selectedFab={selectedFab}
          onSelectFab={(fab) => setSelectedFab(fab)}
          onChangeCoord={(id, axis, value) => {
            setTempFabPositions((prev) => ({
              ...prev,
              [id]: {
                ...(prev[id] || DEFAULT_FAB_POSITIONS[id]),
                [axis]: value,
              },
            }));
          }}
          onApplyPreset={(newPositions) => {
            setTempFabPositions(newPositions);
          }}
          profiles={
            viewSettings.fabProfiles && viewSettings.fabProfiles.length > 0
              ? viewSettings.fabProfiles
              : DEFAULT_FAB_PROFILES
          }
          onSaveProfile={(name) => {
            const currentPositions = normalizeFabPositions(tempFabPositions);
            const existing =
              viewSettings.fabProfiles && viewSettings.fabProfiles.length > 0
                ? viewSettings.fabProfiles
                : DEFAULT_FAB_PROFILES;
            if (existing.some((p) => areFabPositionsEqual(p.positions, currentPositions))) {
              return;
            }
            const newProfile: FabPositionProfile = {
              id: 'fab_prof_' + Date.now(),
              name,
              positions: { ...currentPositions },
              createdAt: Date.now(),
            };
            setViewSettings((prev) => ({
              ...prev,
              fabProfiles: [...existing, newProfile],
            }));
          }}
          onRenameProfile={(id, newName) => {
            const existing =
              viewSettings.fabProfiles && viewSettings.fabProfiles.length > 0
                ? viewSettings.fabProfiles
                : DEFAULT_FAB_PROFILES;
            const updated = existing.map((p) =>
              p.id === id ? { ...p, name: newName } : p
            );
            setViewSettings((prev) => ({
              ...prev,
              fabProfiles: updated,
            }));
          }}
          onDeleteProfile={(id) => {
            const existing =
              viewSettings.fabProfiles && viewSettings.fabProfiles.length > 0
                ? viewSettings.fabProfiles
                : DEFAULT_FAB_PROFILES;
            const filtered = existing.filter((p) => p.id !== id);
            setViewSettings((prev) => ({
              ...prev,
              fabProfiles: filtered,
            }));
          }}
          onSave={() => {
            setViewSettings((prev) => ({
              ...prev,
              fabPositions: tempFabPositions,
            }));
            setIsEditingFabMode(false);
          }}
          onCancel={() => {
            setTempFabPositions(normalizeFabPositions(viewSettings.fabPositions));
            setIsEditingFabMode(false);
          }}
        />
      )}
    </div>
  );
}
