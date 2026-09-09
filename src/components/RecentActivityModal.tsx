import React, { useState, useMemo, useEffect } from 'react';
import { ArchiveItem, Category, MainTabType } from '../types';
import {
  History,
  X,
  Film,
  Gamepad2,
  ChevronRight,
} from 'lucide-react';

interface RecentActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ArchiveItem[];
  categories: {
    media: Category[];
    game: Category[];
  };
  onSelectItem: (item: ArchiveItem) => void;
  onNavigateToCategory: (mainTab: MainTabType, catId: string, sub: string | null) => void;
}

type ActivityActionType = 'added' | 'updated';

interface ActivityRecord {
  item: ArchiveItem;
  action: ActivityActionType;
  timestamp: number;
}

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return 'Bilinmiyor';
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 0) return 'Az önce';

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Az önce';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} dk önce`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce`;

  return `${Math.floor(days / 365)} yıl önce`;
}

function formatFullDateTime(timestamp?: number): string {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const RecentActivityModal: React.FC<RecentActivityModalProps> = ({
  isOpen,
  onClose,
  items,
  categories,
  onSelectItem,
  onNavigateToCategory,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'added' | 'updated'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'media' | 'game'>('all');

  // Reset to 'all' whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setFilterTab('all');
      setScopeFilter('all');
    }
  }, [isOpen]);

  // ESC key listener to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fast category lookup map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.media.forEach((c) => map.set(c.id, c.name));
    categories.game.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Build activity records
  const { addedList, updatedList, allList } = useMemo(() => {
    // 1. Filter by scope (all / media / game)
    const scopedItems = items.filter((it) => {
      if (scopeFilter === 'media') return it.mainTab === 'media';
      if (scopeFilter === 'game') return it.mainTab === 'game';
      return true;
    });

    // 2. Added records
    const addedRecords: ActivityRecord[] = [];
    scopedItems.forEach((it) => {
      if (it.createdAt && typeof it.createdAt === 'number') {
        addedRecords.push({
          item: it,
          action: 'added',
          timestamp: it.createdAt,
        });
      }
    });
    addedRecords.sort((a, b) => b.timestamp - a.timestamp);
    const topAdded = addedRecords.slice(0, 30);

    // 3. Updated records
    const updatedRecords: ActivityRecord[] = [];
    scopedItems.forEach((it) => {
      if (it.updatedAt && typeof it.updatedAt === 'number') {
        const isModified = !it.createdAt || it.updatedAt - it.createdAt > 2000;
        if (isModified) {
          updatedRecords.push({
            item: it,
            action: 'updated',
            timestamp: it.updatedAt,
          });
        }
      }
    });
    updatedRecords.sort((a, b) => b.timestamp - a.timestamp);
    const topUpdated = updatedRecords.slice(0, 30);

    // 4. Combined 'all' list
    const combined = [...topAdded, ...topUpdated];
    const uniqueCombinedMap = new Map<string, ActivityRecord>();
    combined.forEach((rec) => {
      const key = `${rec.item.id}_${rec.action}_${rec.timestamp}`;
      uniqueCombinedMap.set(key, rec);
    });
    const mergedList = Array.from(uniqueCombinedMap.values());
    mergedList.sort((a, b) => b.timestamp - a.timestamp);
    const topAll = mergedList.slice(0, 50);

    return {
      addedList: topAdded,
      updatedList: topUpdated,
      allList: topAll,
    };
  }, [items, scopeFilter]);

  if (!isOpen) return null;

  const currentList =
    filterTab === 'added'
      ? addedList
      : filterTab === 'updated'
      ? updatedList
      : allList;

  return (
    <div
      id="recent-activity-modal-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="recent-activity-modal-box"
        className="relative w-full max-w-2xl bg-[#141824] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar - Clean title without subtitle (~10% vertical reduction on mobile: py-2.5 sm:py-3.5) */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3.5 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <History className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">Son Aktiviteler</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-slate-200 border border-white/10">
                {currentList.length}
              </span>
            </div>
          </div>

          <button
            id="close-recent-activity-btn"
            onClick={onClose}
            title="Kapat (ESC)"
            className="p-1.5 sm:p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* DESKTOP FILTER CONTROLS ROW - Tutarlı buton boyutları ve Tümü desteği */}
        <div className="hidden sm:flex px-5 py-3 border-b border-white/10 bg-white/[0.02] items-center justify-between gap-3">
          {/* Main Action Tabs (Tümü | Yeni Eklenenler | Son Düzenlenenler) */}
          <div className="flex items-center p-1 bg-black/50 rounded-xl border border-white/10 gap-1 text-xs font-semibold">
            <button
              id="activity-tab-all-desktop"
              onClick={() => setFilterTab('all')}
              title="Tüm aktiviteleri göster"
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-white/15 text-white font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              Tümü
            </button>
            <button
              id="activity-tab-added-desktop"
              onClick={() => setFilterTab('added')}
              title="Yeni eklenenleri filtrele"
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === 'added'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              Yeni Eklenenler
            </button>
            <button
              id="activity-tab-updated-desktop"
              onClick={() => setFilterTab('updated')}
              title="Son düzenlenenleri filtrele"
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === 'updated'
                  ? 'bg-sky-600 text-white shadow-xs font-bold'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              Son Düzenlenenler
            </button>
          </div>

          {/* Scope Filters (Tümü | Medya | Oyun) - Eşit buton boyutları */}
          <div className="flex items-center p-1 bg-black/50 rounded-xl border border-white/10 gap-1 text-xs font-semibold">
            <button
              id="activity-scope-all-desktop"
              onClick={() => setScopeFilter('all')}
              title="Tüm kategorileri göster"
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                scopeFilter === 'all'
                  ? 'bg-white/15 text-white font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              Tümü
            </button>
            <button
              id="activity-scope-media-desktop"
              onClick={() => setScopeFilter('media')}
              title="Sadece Medya yapımlarını filtrele"
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                scopeFilter === 'media'
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              <Film className={`w-3.5 h-3.5 ${scopeFilter === 'media' ? 'text-white' : 'text-amber-400'}`} />
              <span>Medya</span>
            </button>
            <button
              id="activity-scope-game-desktop"
              onClick={() => setScopeFilter('game')}
              title="Sadece Oyun yapımlarını filtrele"
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                scopeFilter === 'game'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              <Gamepad2 className={`w-3.5 h-3.5 ${scopeFilter === 'game' ? 'text-white' : 'text-emerald-400'}`} />
              <span>Oyun</span>
            </button>
          </div>
        </div>

        {/* MOBİL FİLTRE DÜZENİ - Tutarlı buton boyutları ve Tümü seçeneği */}
        <div className="flex sm:hidden flex-col px-3 py-2.5 border-b border-white/10 bg-white/[0.02] gap-2">
          {/* Üst Katman: Tümü / Yeni Eklenenler / Son Düzenlenenler */}
          <div className="grid grid-cols-3 p-1 bg-black/50 rounded-xl border border-white/10 gap-1 text-[11px] font-semibold">
            <button
              id="activity-tab-all-mobile"
              onClick={() => setFilterTab('all')}
              className={`py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer truncate ${
                filterTab === 'all'
                  ? 'bg-white/15 text-white font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Tümü
            </button>
            <button
              id="activity-tab-added-mobile"
              onClick={() => setFilterTab('added')}
              className={`py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer truncate ${
                filterTab === 'added'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Yeni Eklenenler
            </button>
            <button
              id="activity-tab-updated-mobile"
              onClick={() => setFilterTab('updated')}
              className={`py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer truncate ${
                filterTab === 'updated'
                  ? 'bg-sky-600 text-white shadow-xs font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Son Düzenlenenler
            </button>
          </div>

          {/* Alt Katman: Tümü / Medya / Oyun */}
          <div className="grid grid-cols-3 p-1 bg-black/50 rounded-xl border border-white/10 gap-1 text-[11px] font-semibold">
            <button
              id="activity-scope-all-mobile"
              onClick={() => setScopeFilter('all')}
              className={`py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer truncate ${
                scopeFilter === 'all'
                  ? 'bg-white/15 text-white font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Tümü
            </button>
            <button
              id="activity-scope-media-mobile"
              onClick={() => setScopeFilter('media')}
              className={`py-1.5 px-1 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate ${
                scopeFilter === 'media'
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Film className={`w-3.5 h-3.5 shrink-0 ${scopeFilter === 'media' ? 'text-white' : 'text-amber-400'}`} />
              <span>Medya</span>
            </button>
            <button
              id="activity-scope-game-mobile"
              onClick={() => setScopeFilter('game')}
              className={`py-1.5 px-1 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate ${
                scopeFilter === 'game'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Gamepad2 className={`w-3.5 h-3.5 shrink-0 ${scopeFilter === 'game' ? 'text-white' : 'text-emerald-400'}`} />
              <span>Oyun</span>
            </button>
          </div>
        </div>

        {/* Activity Feed List Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 custom-scrollbar space-y-2">
          {currentList.length === 0 ? (
            <div className="py-14 text-center px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-neutral-400">
                <History className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">Henüz Kayıtlı Aktivite Bulunmuyor</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                Yeni bir yapım eklediğinizde veya bir kartı güncellediğinizde burada anlık olarak listelenecektir.
              </p>
            </div>
          ) : (
            currentList.map((record, index) => {
              const { item, action, timestamp } = record;
              const catName = categoryMap.get(item.cat) || 'Genel';
              const catText = item.sub ? `${catName} - ${item.sub}` : catName;
              const fullTimeStr = formatFullDateTime(timestamp);
              const relativeTimeStr = formatRelativeTime(timestamp);

              // Background gradient from thumbnail area to right:
              // Added -> emerald green gradient (slightly enhanced)
              // Updated -> sky blue gradient (slightly enhanced)
              const cardGradientClasses =
                action === 'added'
                  ? 'bg-gradient-to-r from-emerald-500/35 via-emerald-600/[0.08] to-transparent border-emerald-500/35 hover:border-emerald-500/55 hover:from-emerald-500/45'
                  : 'bg-gradient-to-r from-sky-500/35 via-sky-600/[0.08] to-transparent border-sky-500/35 hover:border-sky-500/55 hover:from-sky-500/45';

              return (
                <div
                  key={`${item.id}_${action}_${timestamp}_${index}`}
                  onClick={() => onSelectItem(item)}
                  title={`${item.title} - Detayları açmak için tıklayın\nİşlem Zamanı: ${fullTimeStr}`}
                  className={`group flex items-center justify-between gap-3.5 p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${cardGradientClasses}`}
                >
                  {/* Left: 40x56px Thumbnail */}
                  <div className="w-10 h-14 rounded-lg overflow-hidden bg-neutral-900 border border-white/10 shrink-0 flex items-center justify-center relative shadow-sm">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500 bg-white/5">
                        {item.mainTab === 'media' ? (
                          <Film className="w-4 h-4 opacity-50" />
                        ) : (
                          <Gamepad2 className="w-4 h-4 opacity-50" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Middle: Title & Category (Clean, no badges, no rating, hyphenated category) */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                      {item.title}
                    </h4>

                    {/* Category - Subgroup link */}
                    <div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToCategory(item.mainTab, item.cat, item.sub || null);
                        }}
                        title={`${catText} kategorisine git`}
                        className="text-[11px] text-neutral-400 hover:text-blue-300 hover:underline transition-colors font-medium cursor-pointer"
                      >
                        {catText}
                      </button>
                    </div>
                  </div>

                  {/* Right: Clean Timestamp (No clock icon, no number below) */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors"
                      title={fullTimeStr}
                    >
                      {relativeTimeStr}
                    </span>

                    <div className="p-1 rounded-lg text-neutral-500 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
