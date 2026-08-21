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

  // View Settings State
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    showTitleOnPoster: false,
    showRating: true,
  });

  // --- 1. Initial Load: Check Directory Handle & Permissions ---
  useEffect(() => {
    async function initStorage() {
      try {
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

  return (
    <div
      id="app-root"
      onClick={closeAllPanels}
      className="min-h-screen bg-[#121316] text-gray-100 flex flex-col selection:bg-blue-600 selection:text-white"
    >
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col space-y-4">
        {/* Header Tabs & Navigation */}
        <HeaderTabs
          mainTab={mainTab}
          categories={currentCategories}
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
          onOpenAddModal={() => {
            closeAllPanels();
            setIsAddModalOpen(true);
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
        <main className="flex-1">
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
            /* C: Standard Netflix-style Card Grid */
            <div id="items-grid-section">
              {filteredItems.length > 0 ? (
                <div
                  id="items-grid"
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 sm:gap-4"
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
                  className="py-16 text-center rounded-2xl border border-dashed border-[#2b303e] bg-[#15171e] p-8 space-y-3"
                >
                  <p className="text-gray-300 text-sm font-medium">
                    Bu filtreye veya kategoriye uyan yapım bulunamadı.
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-colors"
                  >
                    + Yeni Yapım Ekle
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

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
