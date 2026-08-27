import React, { useState, useEffect, useMemo } from 'react';
import { ArchiveItem, Category, MainTabType, TierRow } from '../types';
import { DEFAULT_TIER_COLORS, MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import { downloadTierListAsPng } from '../utils/tierImageExport';
import {
  Plus,
  Trash2,
  Edit2,
  Undo2,
  Palette,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Info,
  AlertTriangle,
  X,
  Check,
  Sparkles,
  Camera,
  Eye,
} from 'lucide-react';

interface TierListViewProps {
  mainTab: MainTabType;
  category: Category;
  items: ArchiveItem[];
  movedItemIds?: Set<string>;
  onUpdateTierPlacement: (
    itemId: string,
    tierRowId: string | null,
    targetItemId?: string | null,
    position?: 'before' | 'after'
  ) => void;
  onBatchUpdateTierPlacements?: (updates: { itemId: string; tierRowId: string | null }[]) => void;
  onUpdateCategoryRows: (newRows: TierRow[]) => void;
  onItemClick: (item: ArchiveItem) => void;
  onItemHover?: (item: ArchiveItem | null) => void;
  onItemPreview?: (item: ArchiveItem) => void;
}

interface RowContextMenuState {
  x: number;
  y: number;
  rowId: string;
}

interface CardContextMenuState {
  x: number;
  y: number;
  item: ArchiveItem;
}

interface DragOverTargetState {
  itemId: string;
  position: 'before' | 'after';
  rowId: string | null;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  isDanger?: boolean;
  iconType?: 'warning' | 'reset' | 'delete';
  onConfirm: () => void;
}

interface AddRowModalState {
  isOpen: boolean;
  insertIndex?: number;
  name: string;
  color: string;
}

const COLOR_SWATCHES = [
  '#e05252', // Red
  '#e07a52', // Orange-Red
  '#e0a052', // Orange
  '#dede52', // Yellow
  '#7fbf5f', // Green
  '#3fb8af', // Teal
  '#5f9fbf', // Blue
  '#8a6fbf', // Purple
  '#bf5fa0', // Pink
  '#525252', // Dark Gray
];

export const TierListView: React.FC<TierListViewProps> = ({
  mainTab,
  category,
  items,
  movedItemIds,
  onUpdateTierPlacement,
  onBatchUpdateTierPlacements,
  onUpdateCategoryRows,
  onItemClick,
  onItemHover,
  onItemPreview,
}) => {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTargetState | null>(null);

  const [rowContextMenu, setRowContextMenu] = useState<RowContextMenuState | null>(null);
  const [cardContextMenu, setCardContextMenu] = useState<CardContextMenuState | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState('');

  // Custom Modal States
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [addRowModal, setAddRowModal] = useState<AddRowModalState | null>(null);

  const catItems = useMemo(
    () => (items || []).filter((it) => it && it.mainTab === mainTab && it.cat === category?.id),
    [items, mainTab, category?.id]
  );

  const validRowIds = useMemo(
    () => new Set((category?.tierRows || []).map((r) => r.id)),
    [category?.tierRows]
  );

  const poolItems = useMemo(
    () => catItems.filter((it) => !it.tier || !validRowIds.has(it.tier)),
    [catItems, validRowIds]
  );

  // Close context menus on outside click or escape
  useEffect(() => {
    const handleCloseMenus = () => {
      setRowContextMenu(null);
      setCardContextMenu(null);
    };
    window.addEventListener('click', handleCloseMenus);
    window.addEventListener('scroll', handleCloseMenus, true);
    return () => {
      window.removeEventListener('click', handleCloseMenus);
      window.removeEventListener('scroll', handleCloseMenus, true);
    };
  }, []);

  // HTML5 Drag Handlers
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItemId(itemId);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverRowId(null);
    setDragOverTarget(null);
  };

  // Row Dropzone Drag Over
  const handleRowDragOver = (e: React.DragEvent, rowId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRowId !== rowId) {
      setDragOverRowId(rowId);
    }
  };

  const handleRowDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the actual container
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !e.currentTarget.contains(related)) {
      if (dragOverRowId) {
        setDragOverRowId(null);
      }
    }
  };

  // Card Hover Drag Over (Calculates left or right insertion target)
  const handleCardDragOver = (
    e: React.DragEvent,
    targetItem: ArchiveItem,
    rowId: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedItemId || draggedItemId === targetItem.id) {
      setDragOverTarget(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const position = mouseX < rect.width / 2 ? 'before' : 'after';

    if (dragOverRowId !== rowId) {
      setDragOverRowId(rowId);
    }

    if (
      !dragOverTarget ||
      dragOverTarget.itemId !== targetItem.id ||
      dragOverTarget.position !== position ||
      dragOverTarget.rowId !== rowId
    ) {
      setDragOverTarget({
        itemId: targetItem.id,
        position,
        rowId,
      });
    }
  };

  const handleCardDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Do not aggressively clear target to prevent flickering between card boundaries
  };

  // Drop on Row background or tier row
  const handleRowDrop = (e: React.DragEvent, targetRowId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const currentOverTarget = dragOverTarget;
    const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;

    setDragOverRowId(null);
    setDragOverTarget(null);

    if (!itemId) return;

    if (
      currentOverTarget &&
      currentOverTarget.itemId !== itemId &&
      currentOverTarget.rowId === targetRowId
    ) {
      onUpdateTierPlacement(
        itemId,
        targetRowId,
        currentOverTarget.itemId,
        currentOverTarget.position
      );
    } else {
      onUpdateTierPlacement(itemId, targetRowId);
    }

    setDraggedItemId(null);
  };

  // Drop directly onto a specific card
  const handleCardDrop = (
    e: React.DragEvent,
    targetItem: ArchiveItem,
    rowId: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const currentOverTarget = dragOverTarget;
    const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;

    setDragOverRowId(null);
    setDragOverTarget(null);

    if (!itemId) return;

    if (itemId === targetItem.id) {
      setDraggedItemId(null);
      return;
    }

    const position =
      currentOverTarget?.itemId === targetItem.id
        ? currentOverTarget.position
        : 'after';

    onUpdateTierPlacement(itemId, rowId, targetItem.id, position);
    setDraggedItemId(null);
  };

  // Row Management Functions
  const handleOpenAddRowModal = (index?: number) => {
    const defaultNames = ['S+', 'S', 'A', 'B', 'C', 'D', 'E', 'F'];
    const currentNames = new Set(category.tierRows.map((r) => r.name.toUpperCase()));
    const suggestedName = defaultNames.find((n) => !currentNames.has(n)) || 'A+';
    const suggestedColor =
      DEFAULT_TIER_COLORS[category.tierRows.length % DEFAULT_TIER_COLORS.length] || '#5f9fbf';

    setAddRowModal({
      isOpen: true,
      insertIndex: index,
      name: suggestedName,
      color: suggestedColor,
    });
    setRowContextMenu(null);
  };

  const handleConfirmAddRow = () => {
    if (!addRowModal || !addRowModal.name.trim()) return;

    const newRow: TierRow = {
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: addRowModal.name.trim(),
      color: addRowModal.color,
    };

    if (typeof addRowModal.insertIndex === 'number') {
      const updated = [...category.tierRows];
      updated.splice(addRowModal.insertIndex, 0, newRow);
      onUpdateCategoryRows(updated);
    } else {
      onUpdateCategoryRows([...category.tierRows, newRow]);
    }

    setAddRowModal(null);
  };

  const handleDeleteRow = (rowId: string) => {
    const row = category.tierRows.find((r) => r.id === rowId);
    const count = catItems.filter((it) => it.tier === rowId).length;

    setConfirmModal({
      isOpen: true,
      title: `"${row?.name || 'Seçili'}" Satırını Sil`,
      message:
        count > 0
          ? `Bu satır silindiğinde içindeki ${count} kart havuza geri aktarılacaktır. Devam etmek istiyor musunuz?`
          : `"${row?.name || 'Bu'}" satırını silmek istediğinize emin misiniz?`,
      confirmText: 'Satırı Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      iconType: 'delete',
      onConfirm: () => {
        const toMove = catItems.filter((it) => it.tier === rowId);
        if (onBatchUpdateTierPlacements) {
          onBatchUpdateTierPlacements(toMove.map((it) => ({ itemId: it.id, tierRowId: null })));
        } else {
          toMove.forEach((it) => onUpdateTierPlacement(it.id, null));
        }
        onUpdateCategoryRows(category.tierRows.filter((r) => r.id !== rowId));
        setConfirmModal(null);
      },
    });
    setRowContextMenu(null);
  };

  const handleClearRow = (rowId: string) => {
    const row = category.tierRows.find((r) => r.id === rowId);
    const count = catItems.filter((it) => it.tier === rowId).length;
    if (count === 0) return;

    setConfirmModal({
      isOpen: true,
      title: `"${row?.name || ''}" Satırındaki Kartları Boşalt`,
      message: `Bu satırdaki ${count} adet kart havuza geri taşınacaktır. Onaylıyor musunuz?`,
      confirmText: 'Havuza Taşı',
      cancelText: 'Vazgeç',
      isDanger: false,
      iconType: 'reset',
      onConfirm: () => {
        const placed = catItems.filter((it) => it.tier === rowId);
        if (onBatchUpdateTierPlacements) {
          onBatchUpdateTierPlacements(placed.map((it) => ({ itemId: it.id, tierRowId: null })));
        } else {
          placed.forEach((it) => onUpdateTierPlacement(it.id, null));
        }
        setConfirmModal(null);
      },
    });
    setRowContextMenu(null);
  };

  const handleClearAllTiers = () => {
    const placedCount = catItems.filter((it) => it.tier).length;
    if (placedCount === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Tüm Kartları Havuza Geri Çek',
      message: `Tier listesinde yerleştirilmiş olan toplam ${placedCount} kart havuza geri aktarılacaktır. Onaylıyor musunuz?`,
      confirmText: 'Hepsini Havuza Topla',
      cancelText: 'Vazgeç',
      isDanger: false,
      iconType: 'reset',
      onConfirm: () => {
        const placed = catItems.filter((it) => it.tier);
        if (onBatchUpdateTierPlacements) {
          onBatchUpdateTierPlacements(placed.map((it) => ({ itemId: it.id, tierRowId: null })));
        } else {
          placed.forEach((it) => onUpdateTierPlacement(it.id, null));
        }
        setConfirmModal(null);
      },
    });
  };

  const handleMoveRow = (rowId: string, direction: 'up' | 'down') => {
    const idx = category.tierRows.findIndex((r) => r.id === rowId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= category.tierRows.length) return;

    const updated = [...category.tierRows];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    onUpdateCategoryRows(updated);
    setRowContextMenu(null);
  };

  const handleColorChange = (rowId: string, color: string) => {
    onUpdateCategoryRows(
      category.tierRows.map((r) => (r.id === rowId ? { ...r, color } : r))
    );
  };

  const handleStartRename = (row: TierRow) => {
    setEditingRowId(row.id);
    setEditNameText(row.name);
    setRowContextMenu(null);
  };

  const handleSaveRename = (rowId: string) => {
    if (editNameText.trim()) {
      onUpdateCategoryRows(
        category.tierRows.map((r) =>
          r.id === rowId ? { ...r, name: editNameText.trim() } : r
        )
      );
    }
    setEditingRowId(null);
  };

  // Context Menu Trigger on Row Label
  const handleRowContextMenu = (e: React.MouseEvent, rowId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCardContextMenu(null);
    setRowContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 240),
      y: Math.min(e.clientY, window.innerHeight - 300),
      rowId,
    });
  };

  // Context Menu Trigger on Card
  const handleCardContextMenu = (e: React.MouseEvent, item: ArchiveItem) => {
    e.preventDefault();
    e.stopPropagation();
    setRowContextMenu(null);
    setCardContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 280),
      item,
    });
  };

  const activeContextRow = rowContextMenu
    ? category.tierRows.find((r) => r.id === rowContextMenu.rowId)
    : null;

  return (
    <div
      id="tier-list-container"
      className="flex flex-col min-h-[calc(100vh-140px)] select-none pb-8"
    >
      {/* Tier Rows Area */}
      <div className="space-y-2 flex-1 mb-4">
        {category.tierRows.map((row) => {
          const rowItems = catItems.filter((it) => it.tier === row.id);
          const isOverRow = dragOverRowId === row.id;

          return (
            <div
              key={row.id}
              id={`tier-row-${row.id}`}
              onDragOver={(e) => handleRowDragOver(e, row.id)}
              onDragLeave={handleRowDragLeave}
              onDrop={(e) => handleRowDrop(e, row.id)}
              className={`flex rounded-xl overflow-hidden border border-white/10 bg-[#161616] min-h-[88px] shadow-md transition-all ${
                isOverRow
                  ? 'ring-2 ring-sky-400/60 shadow-lg shadow-sky-500/15'
                  : ''
              }`}
            >
              {/* Left Tier Box (Label) - Fully Droppable */}
              <div
                id={`tier-label-${row.id}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverRowId !== row.id) {
                    setDragOverRowId(row.id);
                  }
                  if (dragOverTarget) {
                    setDragOverTarget(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;
                  setDragOverRowId(null);
                  setDragOverTarget(null);
                  if (itemId) {
                    onUpdateTierPlacement(itemId, row.id);
                  }
                  setDraggedItemId(null);
                }}
                onContextMenu={(e) => handleRowContextMenu(e, row.id)}
                title="Sürükle-Bırak: Bu satıra ekle | Sağ tık: Satır seçenekleri"
                className="w-18 sm:w-20 shrink-0 flex flex-col items-center justify-center p-2 relative select-none font-bold text-center cursor-context-menu border-r border-black/40 transition-transform active:scale-95 group"
                style={{
                  backgroundColor: row.color,
                  color: '#ffffff',
                  textShadow: '0 2px 4px rgba(0,0,0,0.85)',
                }}
              >
                {editingRowId === row.id ? (
                  <input
                    type="text"
                    value={editNameText}
                    autoFocus
                    onChange={(e) => setEditNameText(e.target.value)}
                    onBlur={() => handleSaveRename(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(row.id);
                      if (e.key === 'Escape') setEditingRowId(null);
                    }}
                    className="w-full text-center bg-black/70 text-white font-bold text-base rounded border border-white/40 p-1 focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-xl sm:text-2xl font-black tracking-wide break-words max-w-full leading-tight">
                    {row.name}
                  </span>
                )}

                {/* Subtle right-click indicator on hover */}
                <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-75 transition-opacity">
                  <div className="w-2 h-2 rounded-full bg-white/90 shadow" />
                </div>
              </div>

              {/* Row Dropzone & Cards */}
              <div
                id={`dropzone-${row.id}`}
                onDragOver={(e) => handleRowDragOver(e, row.id)}
                onDragLeave={handleRowDragLeave}
                onDrop={(e) => handleRowDrop(e, row.id)}
                className={`flex-1 px-2.5 py-1.5 flex flex-wrap gap-2 items-center content-center min-h-[88px] transition-colors ${
                  isOverRow
                    ? 'bg-neutral-800/90 ring-2 ring-inset ring-sky-400/50'
                    : 'bg-[#141414]'
                }`}
              >
                {rowItems.map((item) => {
                  const isCurrentDragged = draggedItemId === item.id;
                  const isTargetBefore =
                    dragOverTarget?.itemId === item.id && dragOverTarget.position === 'before';
                  const isTargetAfter =
                    dragOverTarget?.itemId === item.id && dragOverTarget.position === 'after';

                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleCardDragOver(e, item, row.id)}
                      onDragLeave={handleCardDragLeave}
                      onDrop={(e) => handleCardDrop(e, item, row.id)}
                      onContextMenu={(e) => handleCardContextMenu(e, item)}
                      onClick={() => onItemClick(item)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onItemPreview?.(item);
                      }}
                      onMouseEnter={() => onItemHover?.(item)}
                      onMouseLeave={() => onItemHover?.(null)}
                      className={`group relative w-[72px] sm:w-[84px] aspect-[2/3] max-h-[124px] rounded-lg overflow-visible cursor-grab active:cursor-grabbing transition-all select-none ${
                        isCurrentDragged
                          ? 'opacity-30 scale-95'
                          : 'hover:scale-105 hover:z-20'
                      }`}
                      title={`${item.title}\n• F: Büyük Afişi Göster\n• Çift Tık: Önizleme\n• Sürükle: İki kartın arasına veya istediğin sıraya bırak\n• Sağ tık: Menü\n• Sol tık: Detay`}
                    >
                      {/* Left Insertion Indicator */}
                      {isTargetBefore && (
                        <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.9)] z-30 pointer-events-none animate-pulse" />
                      )}

                      {/* Right Insertion Indicator */}
                      {isTargetAfter && (
                        <div className="absolute -right-1.5 top-0 bottom-0 w-1 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.9)] z-30 pointer-events-none animate-pulse" />
                      )}

                      {/* Actual Card Body */}
                      <div className="w-full h-full rounded-lg overflow-hidden border border-white/15 bg-neutral-900 shadow-md flex items-center justify-center text-center relative group-hover:border-white/40">
                        {/* Moved / Added in this session Sparkle Indicator */}
                        {movedItemIds && movedItemIds.has(item.id) && (
                          <div
                            title="Bu oturumda taşındı / eklendi"
                            className="absolute top-1 left-1 z-20 w-4 h-4 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center shadow-[0_0_8px_rgba(251,191,36,0.9)] ring-1 ring-black/70 pointer-events-none"
                          >
                            <Sparkles className="w-2.5 h-2.5 fill-current" />
                          </div>
                        )}

                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            draggable={false}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <div className="w-full h-full p-1.5 flex items-center justify-center bg-neutral-800">
                            <span className="text-[11px] font-semibold text-white line-clamp-3 leading-tight pointer-events-none">
                              {item.title}
                            </span>
                          </div>
                        )}

                        {/* Title Overlay on Hover */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="text-[11px] font-bold text-white line-clamp-1">
                            {item.title}
                          </span>
                        </div>

                        {/* Quick Undo to Pool Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateTierPlacement(item.id, null);
                          }}
                          title="Havuza geri çek"
                          className="absolute top-1 right-1 w-5 h-5 rounded-md bg-black/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity hover:bg-red-600 cursor-pointer shadow z-10"
                        >
                          <Undo2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unranked Pool */}
      <div
        id="tier-unranked-pool"
        className="mt-auto sticky bottom-3 z-20 rounded-2xl border border-white/15 bg-[#141414]/95 backdrop-blur-xl p-3 sm:p-4 shadow-2xl space-y-2.5"
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-neutral-200 uppercase tracking-wider">
              Havuz
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              ({poolItems.length} yapım henüz sıralanmamış)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* PNG Export Button */}
            <button
              id="download-tier-png-btn"
              onClick={() => downloadTierListAsPng(category, catItems, mainTab)}
              title="Tüm satırları ve havuzu içeren yüksek çözünürlüklü PNG görsel afişini indir"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>PNG İndir</span>
            </button>

            {/* Havuza Topla Button */}
            {catItems.length - poolItems.length > 0 && (
              <button
                id="clear-all-tier-cards-btn"
                onClick={handleClearAllTiers}
                title="Tüm sıralanmış kartları havuza geri çek"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-medium transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Havuza Topla</span>
              </button>
            )}
          </div>
        </div>

        <div
          id="tier-pool-dropzone"
          onDragOver={(e) => handleRowDragOver(e, null)}
          onDragLeave={handleRowDragLeave}
          onDrop={(e) => handleRowDrop(e, null)}
          className={`px-2.5 py-2 rounded-xl border border-dashed border-white/15 bg-neutral-900/70 min-h-[96px] max-h-[240px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2 items-center content-center transition-colors ${
            dragOverRowId === null && draggedItemId
              ? 'bg-neutral-800/90 border-sky-400/50'
              : ''
          }`}
        >
          {poolItems.map((item) => {
            const isCurrentDragged = draggedItemId === item.id;
            const isTargetBefore =
              dragOverTarget?.itemId === item.id && dragOverTarget.position === 'before';
            const isTargetAfter =
              dragOverTarget?.itemId === item.id && dragOverTarget.position === 'after';

            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleCardDragOver(e, item, null)}
                onDragLeave={handleCardDragLeave}
                onDrop={(e) => handleCardDrop(e, item, null)}
                onContextMenu={(e) => handleCardContextMenu(e, item)}
                onClick={() => onItemClick(item)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onItemPreview?.(item);
                }}
                onMouseEnter={() => onItemHover?.(item)}
                onMouseLeave={() => onItemHover?.(null)}
                className={`group relative w-[72px] sm:w-[84px] aspect-[2/3] max-h-[124px] rounded-lg overflow-visible cursor-grab active:cursor-grabbing transition-all select-none ${
                  isCurrentDragged
                    ? 'opacity-30 scale-95'
                    : 'hover:scale-105 hover:z-20'
                }`}
                title={`${item.title}\n• F: Büyük Afişi Göster\n• Çift Tık: Önizleme\n• Sürükle: Sıralama satırına taşı\n• Sağ tık: Menü\n• Sol tık: Detay`}
              >
                {/* Left Insertion Indicator */}
                {isTargetBefore && (
                  <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.9)] z-30 pointer-events-none animate-pulse" />
                )}

                {/* Right Insertion Indicator */}
                {isTargetAfter && (
                  <div className="absolute -right-1.5 top-0 bottom-0 w-1 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.9)] z-30 pointer-events-none animate-pulse" />
                )}

                <div className="w-full h-full rounded-lg overflow-hidden border border-white/15 bg-neutral-800 shadow-md flex items-center justify-center text-center relative group-hover:border-white/40">
                  {/* Moved / Added in this session Sparkle Indicator */}
                  {movedItemIds && movedItemIds.has(item.id) && (
                    <div
                      title="Bu oturumda taşındı / eklendi"
                      className="absolute top-1 left-1 z-20 w-4 h-4 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center shadow-[0_0_8px_rgba(251,191,36,0.9)] ring-1 ring-black/70 pointer-events-none"
                    >
                      <Sparkles className="w-2.5 h-2.5 fill-current" />
                    </div>
                  )}

                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      draggable={false}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full p-1.5 flex items-center justify-center bg-neutral-800">
                      <span className="text-[11px] font-semibold text-white line-clamp-3 leading-tight pointer-events-none">
                        {item.title}
                      </span>
                    </div>
                  )}

                  {/* Title Overlay on Hover */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="text-[11px] font-bold text-white line-clamp-1">
                      {item.title}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {poolItems.length === 0 && (
            <div className="w-full text-center py-8 text-sm text-neutral-400 font-medium">
              ✨ Tüm yapımlar satırlara yerleştirildi!
            </div>
          )}
        </div>
      </div>

      {/* --- Context Menu: Row Options (Sağ Tık Menüsü) --- */}
      {rowContextMenu && activeContextRow && (
        <div
          id="tier-row-context-menu"
          style={{ top: rowContextMenu.y, left: rowContextMenu.x }}
          className="fixed z-50 w-56 p-1.5 bg-[#1c1c1c] border border-white/15 rounded-xl shadow-2xl text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 border-b border-white/10 font-bold flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/30"
              style={{ backgroundColor: activeContextRow.color }}
            />
            <span className="text-white truncate">
              {activeContextRow.name} Satırı
            </span>
          </div>

          <div className="py-1 space-y-0.5">
            {/* Ad Değiştir */}
            <button
              onClick={() => handleStartRename(activeContextRow)}
              className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2 text-left transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-neutral-400" />
              <span>Satır Adını Değiştir</span>
            </button>

            {/* Renk Paleti */}
            <div className="px-2.5 py-1.5">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 block mb-1.5 flex items-center gap-1">
                <Palette className="w-3 h-3" /> Renk Seç
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {COLOR_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => handleColorChange(activeContextRow.id, hex)}
                    className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 cursor-pointer ${
                      activeContextRow.color.toLowerCase() === hex.toLowerCase()
                        ? 'border-white ring-1 ring-white'
                        : 'border-white/20'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            <div className="h-[1px] bg-white/10 my-1" />

            {/* Yukarı Satır Ekle */}
            <button
              onClick={() => {
                const idx = category.tierRows.findIndex((r) => r.id === activeContextRow.id);
                handleOpenAddRowModal(idx);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2 text-left transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-neutral-400" />
              <span>Yukarıya Satır Ekle</span>
            </button>

            {/* Aşağı Satır Ekle */}
            <button
              onClick={() => {
                const idx = category.tierRows.findIndex((r) => r.id === activeContextRow.id);
                handleOpenAddRowModal(idx + 1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2 text-left transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-neutral-400" />
              <span>Aşağıya Satır Ekle</span>
            </button>

            {/* Yukarı Taşı */}
            <button
              onClick={() => handleMoveRow(activeContextRow.id, 'up')}
              className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2 text-left transition-colors cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5 text-neutral-400" />
              <span>Yukarı Taşı</span>
            </button>

            {/* Aşağı Taşı */}
            <button
              onClick={() => handleMoveRow(activeContextRow.id, 'down')}
              className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2 text-left transition-colors cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5 text-neutral-400" />
              <span>Aşağı Taşı</span>
            </button>

            <div className="h-[1px] bg-white/10 my-1" />

            {/* Satırı Boşalt */}
            <button
              onClick={() => handleClearRow(activeContextRow.id)}
              className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-amber-400 flex items-center gap-2 text-left transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Kartları Havuza Gönder</span>
            </button>

            {/* Satırı Sil */}
            <button
              onClick={() => handleDeleteRow(activeContextRow.id)}
              className="w-full px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 flex items-center gap-2 text-left transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Satırı Sil</span>
            </button>
          </div>
        </div>
      )}

      {/* --- Context Menu: Card Quick Move (Kart Sağ Tık Menüsü) --- */}
      {cardContextMenu && (
        <div
          id="tier-card-context-menu"
          style={{ top: cardContextMenu.y, left: cardContextMenu.x }}
          className="fixed z-50 w-56 p-1.5 bg-[#1c1c1c] border border-white/15 rounded-xl shadow-2xl text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 border-b border-white/10 font-bold truncate text-white">
            {cardContextMenu.item.title}
          </div>

          <div className="py-1">
            <span className="text-[10px] uppercase font-semibold text-neutral-400 px-2.5 py-1 block">
              Hızlıca Taşı:
            </span>
            <div className="grid grid-cols-4 gap-1 px-2 mb-2">
              {category.tierRows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onUpdateTierPlacement(cardContextMenu.item.id, r.id);
                    setCardContextMenu(null);
                  }}
                  className={`py-1 text-center rounded text-xs font-bold transition-transform hover:scale-105 cursor-pointer ${
                    cardContextMenu.item.tier === r.id
                      ? 'ring-2 ring-white scale-105'
                      : ''
                  }`}
                  style={{
                    backgroundColor: r.color,
                    color: '#ffffff',
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  }}
                >
                  {r.name}
                </button>
              ))}
            </div>

            {cardContextMenu.item.tier && (
              <button
                onClick={() => {
                  onUpdateTierPlacement(cardContextMenu.item.id, null);
                  setCardContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-amber-400 flex items-center gap-2 text-left transition-colors cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Havuza Gönder</span>
              </button>
            )}

            <button
              onClick={() => {
                onItemPreview?.(cardContextMenu.item);
                setCardContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-neutral-200 flex items-center justify-between text-left transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>Büyük Afişi Göster</span>
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] font-mono font-bold text-neutral-300">
                F
              </kbd>
            </button>

            <button
              onClick={() => {
                onItemClick(cardContextMenu.item);
                setCardContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-neutral-300 flex items-center gap-2 text-left transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-neutral-400" />
              <span>Kart Detaylarını Aç</span>
            </button>
          </div>
        </div>
      )}

      {/* --- CUSTOM BEAUTIFUL CONFIRMATION MODAL (Tarayıcı Uyarısı Yerine) --- */}
      {confirmModal && confirmModal.isOpen && (
        <div
          id="custom-confirm-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150"
          onClick={() => setConfirmModal(null)}
        >
          <div
            id="custom-confirm-modal"
            className="w-full max-w-md bg-[#1c1c1e] border border-white/15 rounded-2xl p-6 shadow-2xl text-white animate-in zoom-in-95 duration-200 relative space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Icon */}
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.isDanger
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {confirmModal.iconType === 'delete' ? (
                  <Trash2 className="w-6 h-6" />
                ) : confirmModal.iconType === 'reset' ? (
                  <RotateCcw className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold tracking-tight text-white">
                  {confirmModal.title}
                </h3>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-sm font-medium transition-colors cursor-pointer"
              >
                {confirmModal.cancelText || 'Vazgeç'}
              </button>

              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-5 py-2 rounded-xl text-sm font-bold shadow-lg transition-all cursor-pointer ${
                  confirmModal.isDanger
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/40'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM BEAUTIFUL ADD ROW MODAL --- */}
      {addRowModal && addRowModal.isOpen && (
        <div
          id="custom-add-row-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150"
          onClick={() => setAddRowModal(null)}
        >
          <div
            id="custom-add-row-modal"
            className="w-full max-w-sm bg-[#1c1c1e] border border-white/15 rounded-2xl p-5 shadow-2xl text-white animate-in zoom-in-95 duration-200 relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-400" />
                <span>Yeni Tier Satırı Ekle</span>
              </h3>
              <button
                onClick={() => setAddRowModal(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                  Satır Adı (Örn: S+, EX, S, A, B)
                </label>
                <input
                  type="text"
                  value={addRowModal.name}
                  autoFocus
                  onChange={(e) =>
                    setAddRowModal({ ...addRowModal, name: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmAddRow();
                    if (e.key === 'Escape') setAddRowModal(null);
                  }}
                  className="w-full bg-neutral-900 border border-white/20 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-sky-400"
                  placeholder="Satır adı..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                  Satır Rengi
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setAddRowModal({ ...addRowModal, color: hex })}
                      className={`h-8 rounded-lg border transition-transform hover:scale-105 cursor-pointer flex items-center justify-center ${
                        addRowModal.color.toLowerCase() === hex.toLowerCase()
                          ? 'border-white ring-2 ring-white scale-105'
                          : 'border-white/20'
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {addRowModal.color.toLowerCase() === hex.toLowerCase() && (
                        <Check className="w-4 h-4 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setAddRowModal(null)}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-medium cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmAddRow}
                disabled={!addRowModal.name.trim()}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg cursor-pointer"
              >
                Satırı Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
