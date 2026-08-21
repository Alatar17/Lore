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
  loadDataFromLocalStorage,
  loadDataFromIndexedDB,
  saveDataToLocalStorage,
  getStoredDirectoryHandle,
  storeDirectoryHandle,
  clearStoredDirectoryHandle,
  verifyPermission,
  readDataFromFolder,
  writeDataToFolder,
} from './utils/fileSystem';
import { HeaderTabs, TRACKED_TAB_ID } from './components/HeaderTabs';
import { ItemCard } from './components/ItemCard';
import { TrackedView } from './components/TrackedView';
import { TierListView } from './components/TierListView';
import { ItemDetailModal } from './components/ItemDetailModal';
import { AddItemModal } from './components/AddItemModal';
import { SettingsModal } from './components/SettingsModal';
import { Plus } from 'lucide-react';

export default function App() {
  // --- Persistent App Data State ---
  const [appData, setAppData] = useState<AppData>(() => loadDataFromLocalStorage());
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // --- UI & View Navigation State ---
  const [mainTab, setMainTab] = useState<MainTabType>('media');
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'tier'>('grid');

  // Search & Panels
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Modals
  const [selectedItem, setSelectedItem] = useState<ArchiveItem | null>(null);

  // Filters State
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    minRating: 0,
    watchingOnly: false,
    followingOnly: false,
    ankiFilter: 'all',
  });

  // View Settings State with card size slider support
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    showTitleOnPoster: false,
    showRating: true,
    cardSize: 3,
  });

  // --- 1. Initial Load: Check IndexedDB / Directory Handle & Permissions ---
  useEffect(() => {
    async function initStorage() {
      try {
        // Try IndexedDB first (supports huge image databases)
        const idbData = await loadDataFromIndexedDB();
        if (idbData && idbData.categories && idbData.items) {
          setAppData(idbData);
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

  // Close panels on background click
  const closeAllPanels = useCallback(() => {
    setIsFilterOpen(false);
    setIsViewOpen(false);
  }, []);

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
    await clearStoredDirectoryHandle();
    setDirHandle(null);
  };

  // Main Tab Switch Handler
  const handleMainTabChange = (newTab: MainTabType) => {
    setMainTab(newTab);
    setActiveCatId(null);
    setActiveSub(null);
    setViewMode('grid');
    closeAllPanels();
  };

  // Category Switch Handler
  const handleCategorySelect = (catId: string | null) => {
    setActiveCatId(catId);
    setActiveSub(null);
    setViewMode('grid');
    closeAllPanels();
  };

  // Item Updates
  const handleSaveItem = (updatedItem: ArchiveItem) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      items: prev.items.map((it) => (it.id === updatedItem.id ? updatedItem : it)),
    }));
    if (selectedItem?.id === updatedItem.id) {
      setSelectedItem(updatedItem);
    }
  };

  const handleAddItem = (newItem: ArchiveItem) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      items: [newItem, ...prev.items],
    }));
  };

  const handleDeleteItem = (itemId: string) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      items: prev.items.filter((it) => it.id !== itemId),
    }));
    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
    }
  };

  // Tier Placement
  const handleUpdateTierPlacement = (itemId: string, tierRowId: string | null) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      items: prev.items.map((it) =>
        it.id === itemId ? { ...it, tier: tierRowId } : it
      ),
    }));
  };

  // Update Category Tier Rows
  const handleUpdateCategoryTierRows = (catId: string, newRows: TierRow[]) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      categories: {
        ...prev.categories,
        [mainTab]: prev.categories[mainTab].map((c) =>
          c.id === catId ? { ...c, tierRows: newRows } : c
        ),
      },
    }));
  };

  // Update Categories in Settings
  const handleUpdateCategories = (tab: MainTabType, newCategories: Category[]) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      categories: {
        ...prev.categories,
        [tab]: newCategories,
      },
    }));
  };

  // Replace Entire AppData (JSON Import)
  const handleReplaceAllData = (newData: AppData) => {
    setAppData(newData);
    setActiveCatId(null);
    setActiveSub(null);
    setSelectedItem(null);
  };

  // Current categories list for current mainTab
  const currentCategories = useMemo(
    () => appData.categories[mainTab] || [],
    [appData.categories, mainTab]
  );

  const activeCategory = useMemo(() => {
    if (!activeCatId || activeCatId === TRACKED_TAB_ID) return null;
    return currentCategories.find((c) => c.id === activeCatId) || null;
  }, [currentCategories, activeCatId]);

  // Filtered Items logic
  const filteredItems = useMemo(() => {
    return appData.items.filter((item) => {
      // 1. Main tab filter
      if (item.mainTab !== mainTab) return false;

      // 2. Category filter
      if (activeCatId && activeCatId !== TRACKED_TAB_ID) {
        if (item.cat !== activeCatId) return false;
        if (activeSub && item.sub !== activeSub) return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.desc?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // 4. Rating filter
      if (filters.minRating > 0 && item.rating < filters.minRating) {
        return false;
      }

      // 5. Media special filters
      if (mainTab === 'media') {
        if (filters.watchingOnly && !item.watching) return false;
        if (filters.followingOnly && !item.following) return false;
      }

      // 6. Anki filter
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

  return (
    <div
      id="app-root"
      onClick={closeAllPanels}
      className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white relative overflow-x-hidden"
    >
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(37,99,235,0.08),rgba(255,255,255,0))]" />

      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-12 py-3 sm:py-5 flex-1 flex flex-col space-y-4 relative z-10">
        {/* Header Tabs & Navigation */}
        <HeaderTabs
          mainTab={mainTab}
          categories={appData.categories}
          activeCatId={activeCatId}
          activeSub={activeSub}
          viewMode={viewMode}
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
            setIsSearchOpen(!isSearchOpen);
            setIsFilterOpen(false);
            setIsViewOpen(false);
          }}
          onToggleFilter={() => {
            setIsFilterOpen(!isFilterOpen);
            setIsViewOpen(false);
          }}
          onToggleView={() => {
            setIsViewOpen(!isViewOpen);
            setIsFilterOpen(false);
          }}
          onOpenSettings={() => {
            closeAllPanels();
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
            /* C: Fluid & Dynamic Poster Grid */
            <div id="items-grid-section">
              {filteredItems.length > 0 ? (
                <div
                  id="items-grid"
                  className="grid gap-3 sm:gap-4.5 transition-all duration-300"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinWidth}px, 1fr))`,
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
                  className="py-20 text-center rounded-2xl border border-dashed border-[#1e273a] bg-[#0e1320]/60 p-8 space-y-4 max-w-lg mx-auto"
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

      {/* Floating Action Button (FAB) for Adding Items */}
      <button
        id="fab-add-item-btn"
        onClick={() => {
          closeAllPanels();
          setIsAddModalOpen(true);
        }}
        title={mainTab === 'game' ? 'Yeni Oyun Ekle (+)' : 'Yeni Yapım Ekle (+)'}
        className="fixed bottom-7 right-7 z-40 w-13 h-13 rounded-full bg-blue-600/85 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/50 hover:shadow-blue-500/40 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 border border-blue-400/40 backdrop-blur-md cursor-pointer group"
      >
        <Plus className="w-6 h-6 transition-transform duration-300 group-hover:rotate-90" />
      </button>

      {/* --- Modals --- */}

      {/* 1. Item Detail & Edit Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          categories={currentCategories}
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
          onConnectFolder={handleConnectFolder}
          onDisconnectFolder={handleDisconnectFolder}
          onUpdateCategories={handleUpdateCategories}
          onReplaceAllData={handleReplaceAllData}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
