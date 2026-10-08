import React, { useState, useMemo } from 'react';
import { ArchiveItem, Category, MainTabType } from '../types';
import {
  calculateAnkiCounts,
  initAnkiCard,
  AnkiDeckCounts,
  getAnkiStudyQueue,
} from '../utils/ankiUtils';
import { CustomDialog, DialogOptions } from './CustomDialog';
import { AnkiCardsModal } from './AnkiCardsModal';
import {
  X,
  Play,
  RotateCcw,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface AnkiHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ArchiveItem[];
  categories: {
    media: Category[];
    game: Category[];
    book: Category[];
  };
  virtualTimeOffsetMs: number;
  onSetVirtualTimeOffsetMs: (offsetOrUpdater: number | ((prev: number) => number)) => void;
  showSimulator?: boolean;
  onUpdateItem: (updatedItem: ArchiveItem) => void;
  onDeleteItem?: (id: string) => void;
  onStartStudy?: (studyItems: ArchiveItem[], deckTitle: string) => void;
}

interface DeckTreeNode {
  id: string;
  name: string;
  depth: number;
  counts: AnkiDeckCounts;
  items: ArchiveItem[];
  children?: DeckTreeNode[];
}

const ANKI_COLLAPSED_STORAGE_KEY = 'yapim_anki_collapsed_nodes';

export const AnkiHubModal: React.FC<AnkiHubModalProps> = ({
  isOpen,
  onClose,
  items,
  categories,
  virtualTimeOffsetMs,
  onSetVirtualTimeOffsetMs,
  showSimulator = false,
  onUpdateItem,
  onDeleteItem,
  onStartStudy,
}) => {
  // Collapsed / expanded branches state (keys: node.id) - Persisted in localStorage, default is true (collapsed)
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(ANKI_COLLAPSED_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {};
  });

  // Default is true (collapsed/closed)
  const isNodeCollapsed = (nodeId: string): boolean => {
    return collapsedNodes[nodeId] ?? true;
  };

  const toggleNodeCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => {
      const current = prev[nodeId] ?? true;
      const next = {
        ...prev,
        [nodeId]: !current,
      };
      try {
        localStorage.setItem(ANKI_COLLAPSED_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [resetAllSuccess, setResetAllSuccess] = useState<boolean>(false);
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);
  const [isCardsModalOpen, setIsCardsModalOpen] = useState<boolean>(false);

  const virtualNow = useMemo(() => {
    return new Date(Date.now() + virtualTimeOffsetMs);
  }, [virtualTimeOffsetMs]);

  // Filter only items that have Anki enabled
  const ankiItems = useMemo(() => {
    return items.filter((item) => item.anki === true);
  }, [items]);

  const handleResetAllCards = () => {
    ankiItems.forEach((item) => {
      const newCard = initAnkiCard(virtualNow);
      onUpdateItem({
        ...item,
        ankiCard: newCard,
      });
    });
    setResetAllSuccess(true);
    setTimeout(() => {
      setResetAllSuccess(false);
    }, 1800);
  };

  const handlePromptResetAllCards = () => {
    setDialogOptions({
      type: 'confirm',
      title: 'Anki İlerlemesini Sıfırla',
      message:
        'Tüm kartların çalışma ve tekrar geçmişi sıfırlanacaktır. Kartlarınız, afişleriniz ve blur ayarlarınız korunur. Sıfırlamak istiyor musunuz?',
      confirmText: 'Tümünü Sıfırla',
      cancelText: 'Vazgeç',
      isDestructive: true,
      onConfirm: () => {
        handleResetAllCards();
      },
    });
  };

  // Overall totals across entire app
  const overallCounts = useMemo(() => {
    return calculateAnkiCounts(ankiItems, virtualNow);
  }, [ankiItems, virtualNow]);

  // Build the hierarchical deck tree purely from mainTab, category and subgroups
  const deckTree = useMemo(() => {
    const mainTabs: { key: MainTabType; label: string }[] = [
      { key: 'media', label: 'Medya' },
      { key: 'game', label: 'Oyun' },
      { key: 'book', label: 'Kitap' },
    ];

    const tree: DeckTreeNode[] = [];

    for (const tab of mainTabs) {
      const tabItems = ankiItems.filter((i) => i.mainTab === tab.key);
      const tabCategories = categories[tab.key] || [];

      const catChildren: DeckTreeNode[] = [];

      for (const cat of tabCategories) {
        const catItems = tabItems.filter((i) => i.cat === cat.id);
        if (catItems.length === 0) continue;

        // Subgroups if present
        const subMap = new Map<string, ArchiveItem[]>();
        const noSubItems: ArchiveItem[] = [];

        for (const item of catItems) {
          if (item.sub && item.sub.trim()) {
            const current = subMap.get(item.sub.trim()) || [];
            current.push(item);
            subMap.set(item.sub.trim(), current);
          } else {
            noSubItems.push(item);
          }
        }

        const subChildren: DeckTreeNode[] = [];
        subMap.forEach((subItems, subName) => {
          subChildren.push({
            id: `${tab.key}:${cat.id}:${subName}`,
            name: subName,
            depth: 2,
            items: subItems,
            counts: calculateAnkiCounts(subItems, virtualNow),
          });
        });

        catChildren.push({
          id: `${tab.key}:${cat.id}`,
          name: cat.name,
          depth: 1,
          items: catItems,
          counts: calculateAnkiCounts(catItems, virtualNow),
          children: subChildren.length > 0 ? subChildren : undefined,
        });
      }

      // If there are items without an existing category
      const uncategorizedItems = tabItems.filter(
        (i) => !tabCategories.some((c) => c.id === i.cat)
      );
      if (uncategorizedItems.length > 0) {
        catChildren.push({
          id: `${tab.key}:uncategorized`,
          name: 'Diğer / Kategorisiz',
          depth: 1,
          items: uncategorizedItems,
          counts: calculateAnkiCounts(uncategorizedItems, virtualNow),
        });
      }

      // Add main category node if it has any items
      if (tabItems.length > 0) {
        tree.push({
          id: tab.key,
          name: tab.label,
          depth: 0,
          items: tabItems,
          counts: calculateAnkiCounts(tabItems, virtualNow),
          children: catChildren,
        });
      }
    }

    return tree;
  }, [ankiItems, categories, virtualNow]);

  const formatOffsetLabel = (offsetMs: number) => {
    if (offsetMs <= 0) return '';
    const minutes = Math.floor(offsetMs / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      const remHours = hours % 24;
      return remHours > 0 ? `+${days} Gün ${remHours} Saat` : `+${days} Gün`;
    }
    if (hours > 0) {
      const remMinutes = minutes % 60;
      return remMinutes > 0 ? `+${hours} Sa ${remMinutes} Dk` : `+${hours} Saat`;
    }
    return `+${minutes} Dakika`;
  };

  if (!isOpen) return null;

  return (
    <div
      id="anki-hub-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (!isCardsModalOpen) {
          onClose();
        }
      }}
    >
      <div
        id="anki-hub-modal-window"
        className="w-full max-w-xl sm:max-w-[580px] h-[82vh] sm:h-[640px] max-h-[92vh] bg-[#14161f] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="hidden sm:flex w-8 h-8 rounded-xl bg-white/10 border border-white/15 items-center justify-center text-slate-200 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                Anki Deste Hub&apos;ı
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Cards (Kartlar) modal open button */}
            <button
              type="button"
              onClick={() => setIsCardsModalOpen(true)}
              title="Kartlar Penceresini Aç"
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer mr-0.5"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Kartlar</span>
            </button>

            {/* Reset all cards button: placed directly to the left of the X button, icon-only */}
            <button
              type="button"
              onClick={handlePromptResetAllCards}
              title={resetAllSuccess ? "Tüm kartlar sıfırlandı" : "Tüm Anki İlerlemesini Sıfırla"}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                resetAllSuccess
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-rose-300 hover:bg-rose-500/15'
              }`}
            >
              {resetAllSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Kapat"
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Virtual Time Simulator Bar (Test & Geliştirici Aracı - Yalnızca Ayarlar'dan Test Modu açıkken veya sanal ofset > 0 iken) */}
        {(showSimulator || virtualTimeOffsetMs > 0) && (
          <div className="px-4 sm:px-6 py-2.5 bg-neutral-900/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Sanal Zaman:</span>
              </span>
              {virtualTimeOffsetMs > 0 ? (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold font-mono text-[11px] border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>{formatOffsetLabel(virtualTimeOffsetMs)} aktif</span>
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 font-mono">Gerçek Zaman</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onSetVirtualTimeOffsetMs((prev) => prev + 10 * 60 * 1000)}
                title="10 Dakika İleri Sar (Öğrenme adımlarını doldurur)"
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
              >
                +10 Dk
              </button>
              <button
                type="button"
                onClick={() => onSetVirtualTimeOffsetMs((prev) => prev + 24 * 60 * 60 * 1000)}
                title="1 Gün İleri Sar (Yarına sarar, vadesi gelen tekrarları açar)"
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
              >
                +1 Gün
              </button>
              <button
                type="button"
                onClick={() => onSetVirtualTimeOffsetMs((prev) => prev + 3 * 24 * 60 * 60 * 1000)}
                title="3 Gün İleri Sar"
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
              >
                +3 Gün
              </button>
              {virtualTimeOffsetMs > 0 && (
                <button
                  type="button"
                  onClick={() => onSetVirtualTimeOffsetMs(0)}
                  title="Sanal zamanı sıfırla ve gerçek zamana dön"
                  className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-bold text-rose-300 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Gerçek Zamana Dön</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Virtual Time Banner */}
        {virtualTimeOffsetMs > 0 && (
          <div className="px-4 sm:px-6 py-1.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                SANAL ZAMAN AKTİF ({formatOffsetLabel(virtualTimeOffsetMs)}) — Test
                Modundasınız. Vade ve sayaçlar bu tarihe göre hesaplanıyor.
              </span>
            </span>
            <span className="font-mono text-[10px] text-amber-200/80">
              {virtualNow.toLocaleDateString('tr-TR')} {virtualNow.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
          {ankiItems.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">
                  Henüz Anki Deste Kartı Bulunmuyor
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                  Herhangi bir Medya, Oyun veya Kitap yapımını düzenleyip{' '}
                  <span className="text-emerald-400 font-semibold">&quot;Anki&quot;</span> kutucuğunu
                  işaretleyerek buraya otomatik dahil edebilirsiniz.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Minimalist Deck Hierarchy Table (Orijinal Anki Sade Tipografisi - Emojisiz) */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                {/* Table Header */}
                <div className="flex items-center px-3 sm:px-4 py-2 bg-white/5 border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none">
                  <div className="flex-1 min-w-0 pr-1 sm:pr-2 flex items-center gap-1.5">
                    <span>Deste</span>
                    <span className="text-[10px] text-slate-500 font-mono font-normal">
                      ({ankiItems.length})
                    </span>
                  </div>
                  <div className="w-10 sm:w-16 shrink-0 text-center text-blue-400" title="Yeni: Henüz çalışılmamış kartlar">Yeni</div>
                  <div className="w-14 sm:w-22 shrink-0 text-center text-rose-400 truncate" title="Öğreniliyor: Öğrenme adımında olan kartlar">
                    <span className="sm:hidden">Öğr.</span>
                    <span className="hidden sm:inline">Öğreniliyor</span>
                  </div>
                  <div className="w-10 sm:w-16 shrink-0 text-center text-emerald-400" title="Tekrar: Gün sonu kuralı dahilinde vadesi gelen kartlar">Tekrar</div>
                </div>

                {/* Table Rows (Hierarchical Tree) */}
                <div className="divide-y divide-white/5 font-sans">
                  {deckTree.map((mainNode) => {
                    const isMainCollapsed = isNodeCollapsed(mainNode.id);
                    const hasChildren = Boolean(mainNode.children && mainNode.children.length > 0);

                    return (
                      <React.Fragment key={mainNode.id}>
                        {/* Main Tab Row (e.g. Medya, Oyun, Kitap) */}
                        <div
                          className="flex items-center px-3 sm:px-4 py-2.5 hover:bg-white/[0.04] transition-colors group cursor-pointer text-xs"
                          onClick={() => {
                            if (hasChildren) toggleNodeCollapse(mainNode.id);
                          }}
                        >
                          <div className="flex-1 min-w-0 pr-1 sm:pr-2 flex items-center gap-1.5 sm:gap-2">
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleNodeCollapse(mainNode.id);
                                }}
                                className="w-4 h-4 rounded text-slate-400 hover:text-white flex items-center justify-center font-mono text-xs select-none shrink-0"
                              >
                                {isMainCollapsed ? '[+]' : '[-]'}
                              </button>
                            ) : (
                              <span className="w-4 inline-block shrink-0" />
                            )}
                            <span className="font-bold text-slate-200 tracking-wide truncate shrink-0 max-w-[110px] sm:max-w-none">
                              {mainNode.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              ({mainNode.items.length})
                            </span>

                            {/* Deck Study Button */}
                            {mainNode.counts.newCount +
                              mainNode.counts.learningCount +
                              mainNode.counts.reviewCount >
                              0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const queue = getAnkiStudyQueue(mainNode.items, virtualNow);
                                  if (queue.length > 0 && onStartStudy) {
                                    onStartStudy(queue, mainNode.name);
                                  }
                                }}
                                title={`"${mainNode.name}" destesini çalış`}
                                className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                              >
                                <Play className="w-2.5 h-2.5 fill-emerald-300" />
                                <span>Çalış</span>
                              </button>
                            )}
                          </div>

                          {/* Counters: New (Blue), Learning (Red), Review (Green) */}
                          <div
                            className={`w-10 sm:w-16 shrink-0 text-center font-mono font-semibold ${
                              mainNode.counts.newCount > 0
                                ? 'text-blue-400'
                                : 'text-neutral-600'
                            }`}
                          >
                            {mainNode.counts.newCount}
                          </div>
                          <div
                            className={`w-14 sm:w-22 shrink-0 text-center font-mono font-semibold ${
                              mainNode.counts.learningCount > 0
                                ? 'text-rose-400'
                                : 'text-neutral-600'
                            }`}
                          >
                            {mainNode.counts.learningCount}
                          </div>
                          <div
                            className={`w-10 sm:w-16 shrink-0 text-center font-mono font-semibold ${
                              mainNode.counts.reviewCount > 0
                                ? 'text-emerald-400'
                                : 'text-neutral-600'
                            }`}
                          >
                            {mainNode.counts.reviewCount}
                          </div>
                        </div>

                        {/* Category Rows (Depth 1) */}
                        {!isMainCollapsed &&
                          mainNode.children?.map((catNode) => {
                            const isCatCollapsed = isNodeCollapsed(catNode.id);
                            const hasSubChildren = Boolean(
                              catNode.children && catNode.children.length > 0
                            );

                            return (
                              <React.Fragment key={catNode.id}>
                                <div
                                  className="flex items-center px-3 sm:px-4 py-2 bg-white/[0.01] hover:bg-white/[0.04] transition-colors group text-xs"
                                  onClick={() => {
                                    if (hasSubChildren) toggleNodeCollapse(catNode.id);
                                  }}
                                >
                                  <div className="flex-1 min-w-0 pr-1 sm:pr-2 flex items-center gap-1.5 sm:gap-2 pl-5 sm:pl-7">
                                    {hasSubChildren ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleNodeCollapse(catNode.id);
                                        }}
                                        className="w-4 h-4 rounded text-slate-400 hover:text-white flex items-center justify-center font-mono text-[11px] select-none shrink-0"
                                      >
                                        {isCatCollapsed ? '[+]' : '[-]'}
                                      </button>
                                    ) : (
                                      <span className="w-3 inline-block shrink-0" />
                                    )}
                                    <span className="font-medium text-slate-300 min-w-0 truncate">
                                      {catNode.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                      ({catNode.items.length})
                                    </span>

                                    {/* Category Deck Study Button */}
                                    {catNode.counts.newCount +
                                      catNode.counts.learningCount +
                                      catNode.counts.reviewCount >
                                      0 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const queue = getAnkiStudyQueue(catNode.items, virtualNow);
                                          if (queue.length > 0 && onStartStudy) {
                                            onStartStudy(queue, `${mainNode.name} > ${catNode.name}`);
                                          }
                                        }}
                                        title={`"${catNode.name}" destesini çalış`}
                                        className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                                      >
                                        <Play className="w-2 h-2 fill-emerald-300" />
                                        <span>Çalış</span>
                                      </button>
                                    )}
                                  </div>

                                  <div
                                    className={`w-10 sm:w-16 shrink-0 text-center font-mono text-xs ${
                                      catNode.counts.newCount > 0
                                        ? 'text-blue-400 font-semibold'
                                        : 'text-neutral-600'
                                    }`}
                                  >
                                    {catNode.counts.newCount}
                                  </div>
                                  <div
                                    className={`w-14 sm:w-22 shrink-0 text-center font-mono text-xs ${
                                      catNode.counts.learningCount > 0
                                        ? 'text-rose-400 font-semibold'
                                        : 'text-neutral-600'
                                    }`}
                                  >
                                    {catNode.counts.learningCount}
                                  </div>
                                  <div
                                    className={`w-10 sm:w-16 shrink-0 text-center font-mono text-xs ${
                                      catNode.counts.reviewCount > 0
                                        ? 'text-emerald-400 font-semibold'
                                        : 'text-neutral-600'
                                    }`}
                                  >
                                    {catNode.counts.reviewCount}
                                  </div>
                                </div>

                                {/* Subgroup Rows (Depth 2) */}
                                {!isCatCollapsed &&
                                  catNode.children?.map((subNode) => (
                                    <div
                                      key={subNode.id}
                                      className="flex items-center px-3 sm:px-4 py-1.5 bg-white/[0.015] hover:bg-white/[0.05] transition-colors text-[11px]"
                                    >
                                      <div className="flex-1 min-w-0 pr-1 sm:pr-2 flex items-center gap-1.5 sm:gap-2 pl-10 sm:pl-14 text-slate-400">
                                        <span className="w-2 h-[1px] bg-slate-600 shrink-0" />
                                        <span className="min-w-0 truncate">{subNode.name}</span>
                                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                          ({subNode.items.length})
                                        </span>

                                        {/* Subgroup Study Button */}
                                        {subNode.counts.newCount +
                                          subNode.counts.learningCount +
                                          subNode.counts.reviewCount >
                                          0 && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const queue = getAnkiStudyQueue(subNode.items, virtualNow);
                                              if (queue.length > 0 && onStartStudy) {
                                                onStartStudy(
                                                  queue,
                                                  `${mainNode.name} > ${catNode.name} > ${subNode.name}`
                                                );
                                              }
                                            }}
                                            title={`"${subNode.name}" alt grubunu çalış`}
                                            className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                                          >
                                            <Play className="w-2 h-2 fill-emerald-300" />
                                            <span>Çalış</span>
                                          </button>
                                        )}
                                      </div>

                                      <div
                                        className={`w-10 sm:w-16 shrink-0 text-center font-mono ${
                                          subNode.counts.newCount > 0
                                            ? 'text-blue-400 font-semibold'
                                            : 'text-neutral-600'
                                        }`}
                                      >
                                        {subNode.counts.newCount}
                                      </div>
                                      <div
                                        className={`w-14 sm:w-22 shrink-0 text-center font-mono ${
                                          subNode.counts.learningCount > 0
                                            ? 'text-rose-400 font-semibold'
                                            : 'text-neutral-600'
                                        }`}
                                      >
                                        {subNode.counts.learningCount}
                                      </div>
                                      <div
                                        className={`w-10 sm:w-16 shrink-0 text-center font-mono ${
                                          subNode.counts.reviewCount > 0
                                            ? 'text-emerald-400 font-semibold'
                                            : 'text-neutral-600'
                                        }`}
                                      >
                                        {subNode.counts.reviewCount}
                                      </div>
                                    </div>
                                  ))}
                              </React.Fragment>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions & Summary Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-neutral-950/80 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Today Reviewed & Progress Summary */}
          <div className="flex items-center gap-3 text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>
                Bugün <strong className="text-white font-mono">{overallCounts.todayReviewed}</strong> kart çalışıldı
              </span>
            </span>
            <span className="text-slate-600">•</span>
            <span>
              Toplam Vadesi Dolan:{' '}
              <strong className="text-emerald-400 font-mono">
                {overallCounts.newCount + overallCounts.learningCount + overallCounts.reviewCount}
              </strong>
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                const queue = getAnkiStudyQueue(ankiItems, virtualNow);
                if (onStartStudy) {
                  onStartStudy(queue, 'Tümü');
                }
              }}
              disabled={
                overallCounts.newCount + overallCounts.learningCount + overallCounts.reviewCount === 0
              }
              title={
                overallCounts.newCount + overallCounts.learningCount + overallCounts.reviewCount === 0
                  ? 'Şu anda vadesi gelen kart yok (Sanal zaman ile yarına sarabilirsiniz)'
                  : 'Vadesi gelen tüm kartları öncelik sırasıyla çalış'
              }
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-102 active:scale-98"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Tümünü Çalış</span>
            </button>
          </div>
        </div>
      </div>

      {/* Anki Cards Modal (Kartlar Penceresi) */}
      <AnkiCardsModal
        isOpen={isCardsModalOpen}
        onClose={() => setIsCardsModalOpen(false)}
        items={items}
        categories={categories}
        virtualTimeOffsetMs={virtualTimeOffsetMs}
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
      />

      {/* Confirmation Dialog */}
      <CustomDialog options={dialogOptions} onClose={() => setDialogOptions(null)} />
    </div>
  );
};
