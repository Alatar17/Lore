import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AppData,
  ArchiveItem,
  Category,
  FilterState,
  MainTabType,
  TierRow,
  ViewSettings,
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
} from './utils/fileSystem';

import { HeaderTabs, TRACKED_TAB_ID } from './components/HeaderTabs';
import { ItemCard } from './components/ItemCard';
import { TrackedView } from './components/TrackedView';
import { TierListView } from './components/TierListView';
import { ItemDetailModal } from './components/ItemDetailModal';
import { AddItemModal } from './components/AddItemModal';
import { SettingsModal } from './components/SettingsModal';
import { StatisticsModal } from './components/StatisticsModal';
import { Plus, BarChart3 } from 'lucide-react';

export default function App() {
  // --- Persistent App Data State ---
  const [appData, setAppData] = useState<AppData>(() => {
    return loadDataFromLocalStorage() || INITIAL_DATA;
  });

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

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

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    minRating: 0,
    watchingOnly: false,
    followingOnly: false,
    ankiFilter: 'all',
  });

  // View Settings State with card size slider and theme support
  const [viewSettings, setViewSettings] = useState<ViewSettings>(() => {
    const saved = localStorage.getItem('yapim_view_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
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
          ...parsed,
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
    localStorage.setItem('yapim_view_settings', JSON.stringify(viewSettings));
    document.documentElement.setAttribute(
      'data-theme',
      viewSettings.theme || 'deep-slate'
    );
  }, [viewSettings]);

  // --- 1. Initial Load: Check IndexedDB / Directory Handle & Permissions ---
  useEffect(() => {
    async function initStorage() {
      try {
        const local = loadDataFromLocalStorage();
        if (local && local.categories && local.items) {
          setAppData(local);
        }

        const storedHandle = await getStoredDirectoryHandle();
        if (storedHandle) {
          const hasPerm = await verifyPermission(storedHandle, true);
          if (hasPerm) {
            setDirHandle(storedHandle);
            const folderData = await readDataFromFolder(storedHandle);
            if (folderData && folderData.categories && folderData.items) {
              setAppData(folderData);
              saveDataToLocalStorage(folderData);
            }
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

  // Close panels
  const closeAllPanels = useCallback(() => {
    setIsFilterOpen(false);
    setIsViewOpen(false);
  }, []);

  // Current category list for active main tab
  const currentCategories = appData.categories[mainTab] || [];
  const activeCategory =
    activeCatId && activeCatId !== TRACKED_TAB_ID
      ? currentCategories.find((c) => c.id === activeCatId)
      : null;

  // --- 3. Global Keyboard Shortcuts (1: Media Home, 2: Game Home, 3: Tracked, 'W': Add, 'Escape': Smart ESC/Settings, 'Tab': Grid/Tier, 'Space': Fullscreen) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 'Escape' key -> Smart ESC:
      // If modal/panel/search is open -> close active window.
      // If no window is open -> open Settings (or close if already open).
      if (e.key === 'Escape') {
        e.preventDefault();
        if (selectedItem) {
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

      // '1' key -> Nerede olursan ol Medya Ana Sayfasına götürür
      if (e.key === '1') {
        e.preventDefault();
        closeAllPanels();
        setSelectedItem(null);
        setIsAddModalOpen(false);
        setIsSettingsOpen(false);
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
  }, [closeAllPanels, selectedItem, isAddModalOpen, isSettingsOpen, isFilterOpen, isViewOpen, isSearchOpen, activeCategory]);

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
    setAppData((prev) => ({
      ...prev,
      items: [newItem, ...prev.items],
    }));
    setIsAddModalOpen(false);
  };

  const handleSaveItem = (updatedItem: ArchiveItem) => {
    setAppData((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === updatedItem.id ? updatedItem : it)),
    }));
    setSelectedItem(null);
  };

  const handleDeleteItem = (itemId: string) => {
    setAppData((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== itemId),
    }));
    setSelectedItem(null);
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

  const handleUpdateTierPlacement = (
    itemId: string,
    tierId: string | null
  ) => {
    setAppData((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === itemId ? { ...it, tier: tierId } : it
      ),
    }));
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

  // --- Filter and Search Logic ---
  const filteredItems = useMemo(() => {
    return appData.items.filter((item) => {
      // 1. Tab match
      if (item.mainTab !== mainTab) return false;

      // 2. Tracked View
      if (mainTab === 'media' && activeCatId === TRACKED_TAB_ID) {
        if (!item.watching && !item.following && !(item as any).isWatching && !(item as any).isFollowing) return false;
      } else if (activeCatId) {
        // 3. Category match
        if (item.cat !== activeCatId) return false;
        // Subgroup match
        if (activeSub && item.sub !== activeSub) return false;
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
  }, [appData.items, mainTab, activeCatId, activeSub, searchQuery, filters]);

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
      case 'dark-slate':
        return {
          bg: 'bg-[#181b22]',
          ambient: 'bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(96,165,250,0.14),transparent)]',
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
          onMainTabChange={handleMainTabChange}
          onCategorySelect={handleCategorySelect}
          onSubgroupSelect={setActiveSub}
          onViewModeChange={setViewMode}
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
          onOpenSettings={() => {
            closeAllPanels();
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
              onItemClick={(item) => setSelectedItem(item)}
            />
          ) : activeCategory && activeCategory.tierEnabled && viewMode === 'tier' ? (
            /* B: Tier List View */
            <TierListView
              mainTab={mainTab}
              category={activeCategory}
              items={appData.items}
              onUpdateTierPlacement={handleUpdateTierPlacement}
              onUpdateCategoryRows={(rows) =>
                handleUpdateCategoryTierRows(activeCategory.id, rows)
              }
              onItemClick={(item) => setSelectedItem(item)}
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
                      onClick={() => setSelectedItem(item)}
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

          {/* Floating Right Bottom Add Button */}
          <button
            id="fab-add-item-btn"
            onClick={(e) => {
              e.stopPropagation();
              closeAllPanels();
              setIsAddModalOpen(true);
            }}
            title={`Yeni Ekle (Kısayol: W)`}
            className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white shadow-lg shadow-black/40 hover:shadow-blue-600/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10 hover:border-blue-400/40 backdrop-blur-md cursor-pointer group"
          >
            <Plus className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
          </button>
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
          onUpdateViewSettings={(newSet) =>
            setViewSettings((prev) => ({ ...prev, ...newSet }))
          }
          onConnectFolder={handleConnectFolder}
          onDisconnectFolder={handleDisconnectFolder}
          onUpdateCategories={handleUpdateCategories}
          onUpdateItems={(newItems) => {
            setAppData((prev) => ({ ...prev, items: newItems }));
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
    </div>
  );
}
