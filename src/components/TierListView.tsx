import React, { useState, useRef, useEffect } from 'react';
import { ArchiveItem, Category, MainTabType, TierRow } from '../types';
import { DEFAULT_TIER_COLORS, MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import {
  Plus,
  Trash2,
  Edit2,
  Undo2,
  Palette,
  ArrowUp,
  ArrowDown,
  Layers,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Info,
} from 'lucide-react';

interface TierListViewProps {
  mainTab: MainTabType;
  category: Category;
  items: ArchiveItem[];
  onUpdateTierPlacement: (itemId: string, tierRowId: string | null) => void;
  onUpdateCategoryRows: (newRows: TierRow[]) => void;
  onItemClick: (item: ArchiveItem) => void;
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
  onUpdateTierPlacement,
  onUpdateCategoryRows,
  onItemClick,
}) => {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [rowContextMenu, setRowContextMenu] = useState<RowContextMenuState | null>(null);
  const [cardContextMenu, setCardContextMenu] = useState<CardContextMenuState | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState('');

  const catItems = items.filter((it) => it.mainTab === mainTab && it.cat === category.id);
  const palette = mainTab === 'game' ? GAME_COLORS : MEDIA_COLORS;
  const baseColor = palette[category.id] || '#404040';

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
  };

  const handleDragOver = (e: React.DragEvent, rowId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRowId !== rowId) {
      setDragOverRowId(rowId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRowId(null);
  };

  const handleDrop = (e: React.DragEvent, targetRowId: string | null) => {
    e.preventDefault();
    setDragOverRowId(null);
    const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;
    if (itemId) {
      onUpdateTierPlacement(itemId, targetRowId);
    }
    setDraggedItemId(null);
  };

  // Row Management Functions
  const handleAddRow = (index?: number) => {
    const defaultNames = ['S+', 'S', 'A', 'B', 'C', 'D', 'E', 'F'];
    const currentNames = new Set(category.tierRows.map((r) => r.name.toUpperCase()));
    const suggestedName = defaultNames.find((n) => !currentNames.has(n)) || 'A+';
    
    const name = window.prompt('Yeni Tier Satırı Adı (örn: S+, EX, A, B):', suggestedName);
    if (!name || !name.trim()) return;

    const newColor =
      DEFAULT_TIER_COLORS[category.tierRows.length % DEFAULT_TIER_COLORS.length] ||
      '#5f9fbf';

    const newRow: TierRow = {
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      color: newColor,
    };

    if (typeof index === 'number') {
      const updated = [...category.tierRows];
      updated.splice(index, 0, newRow);
      onUpdateCategoryRows(updated);
    } else {
      onUpdateCategoryRows([...category.tierRows, newRow]);
    }
    setRowContextMenu(null);
  };

  const handleDeleteRow = (rowId: string) => {
    const row = category.tierRows.find((r) => r.id === rowId);
    const count = catItems.filter((it) => it.tier === rowId).length;
    
    const confirmMsg = count > 0
      ? `"${row?.name || 'Bu'}" satırını silmek istiyor musunuz? İçindeki ${count} kart havuza geri dönecektir.`
      : `"${row?.name || 'Bu'}" satırını silmek istiyor musunuz?`;

    if (window.confirm(confirmMsg)) {
      catItems.filter((it) => it.tier === rowId).forEach((it) => {
        onUpdateTierPlacement(it.id, null);
      });
      onUpdateCategoryRows(category.tierRows.filter((r) => r.id !== rowId));
    }
    setRowContextMenu(null);
  };

  const handleClearRow = (rowId: string) => {
    const placed = catItems.filter((it) => it.tier === rowId);
    placed.forEach((it) => onUpdateTierPlacement(it.id, null));
    setRowContextMenu(null);
  };

  const handleClearAllTiers = () => {
    if (window.confirm('Tüm kartlar Tier satırlarından havuza geri taşınacak. Onaylıyor musunuz?')) {
      catItems.forEach((it) => {
        if (it.tier) onUpdateTierPlacement(it.id, null);
      });
    }
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

  const poolItems = catItems.filter((it) => !it.tier);
  const activeContextRow = rowContextMenu
    ? category.tierRows.find((r) => r.id === rowContextMenu.rowId)
    : null;

  return (
    <div
      id="tier-list-container"
      className="flex flex-col min-h-[calc(100vh-140px)] select-none pb-6"
    >
      {/* Tier Rows Area (Expands to fill top portion) */}
      <div className="space-y-2 flex-1 mb-5">
        {category.tierRows.map((row, index) => {
          const rowItems = catItems.filter((it) => it.tier === row.id);
          const isOver = dragOverRowId === row.id;

          return (
            <div
              key={row.id}
              id={`tier-row-${row.id}`}
              className="flex rounded-xl overflow-hidden border border-white/10 bg-[#161616] min-h-[92px] shadow-sm transition-all"
            >
              {/* Minimal Left Tier Box */}
              <div
                id={`tier-label-${row.id}`}
                onContextMenu={(e) => handleRowContextMenu(e, row.id)}
                title="Sağ tık: Satır seçenekleri (Ad, Renk, Sil, Ekle)"
                className="w-14 sm:w-16 shrink-0 flex flex-col items-center justify-center p-2 relative select-none font-bold text-center cursor-context-menu border-r border-black/30 transition-transform active:scale-95 group"
                style={{
                  backgroundColor: row.color,
                  color: '#ffffff',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
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
                    className="w-full text-center bg-black/60 text-white font-bold text-sm rounded border border-white/30 p-0.5 focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-lg sm:text-xl font-extrabold tracking-wider break-words max-w-full leading-none">
                    {row.name}
                  </span>
                )}

                {/* Subtle right-click indicator on hover */}
                <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-60 transition-opacity">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
                </div>
              </div>

              {/* Row Dropzone & Cards */}
              <div
                id={`dropzone-${row.id}`}
                onDragOver={(e) => handleDragOver(e, row.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, row.id)}
                className={`flex-1 p-2.5 flex flex-wrap gap-2 items-center content-start min-h-[92px] transition-colors ${
                  isOver
                    ? 'bg-neutral-800/80 ring-2 ring-inset ring-white/30'
                    : 'bg-[#141414]'
                }`}
              >
                {rowItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                    onContextMenu={(e) => handleCardContextMenu(e, item)}
                    onClick={() => onItemClick(item)}
                    className="group relative w-14 sm:w-16 aspect-[2/3] rounded-lg overflow-hidden border border-white/15 bg-neutral-900 cursor-grab active:cursor-grabbing hover:scale-105 hover:border-white/40 transition-all shadow-md flex items-center justify-center text-center select-none"
                    title={`${item.title}\n• Sürükle: Yerini değiştir\n• Sağ tık: Hızlı taşı / Menü\n• Sol tık: Detay`}
                  >
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        draggable={false}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                    ) : (
                      <span className="text-[10px] font-semibold px-1 text-white line-clamp-3 leading-tight pointer-events-none">
                        {item.title}
                      </span>
                    )}

                    {/* Quick Undo to Pool Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTierPlacement(item.id, null);
                      }}
                      title="Havuza geri çek"
                      className="absolute top-1 right-1 w-4 h-4 rounded bg-black/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity hover:bg-red-600 cursor-pointer shadow"
                    >
                      <Undo2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unranked Pool (Pinned at bottom, spacious and clean) */}
      <div
        id="tier-unranked-pool"
        className="mt-auto sticky bottom-2 z-20 rounded-2xl border border-white/10 bg-[#141414]/95 backdrop-blur-xl p-3.5 shadow-2xl space-y-2.5"
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
              Havuz
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              ({poolItems.length} yapım henüz sıralanmamış)
            </span>
          </div>

          {/* Havuza Topla Button */}
          {catItems.length - poolItems.length > 0 && (
            <button
              id="clear-all-tier-cards-btn"
              onClick={handleClearAllTiers}
              title="Tüm sıralanmış kartları havuza geri çek"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Havuza Topla</span>
            </button>
          )}
        </div>

        <div
          id="tier-pool-dropzone"
          onDragOver={(e) => handleDragOver(e, null)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, null)}
          className={`p-2 rounded-xl border border-dashed border-white/10 bg-neutral-900/60 min-h-[96px] max-h-[220px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2 items-center content-start transition-colors ${
            dragOverRowId === null && draggedItemId
              ? 'bg-neutral-800/80 border-white/30'
              : ''
          }`}
        >
          {poolItems.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragEnd={handleDragEnd}
              onContextMenu={(e) => handleCardContextMenu(e, item)}
              onClick={() => onItemClick(item)}
              className="group relative w-14 sm:w-16 aspect-[2/3] rounded-lg overflow-hidden border border-white/15 bg-neutral-800 cursor-grab active:cursor-grabbing hover:scale-105 hover:border-white/40 transition-all shadow-md flex items-center justify-center text-center select-none"
              title={`${item.title}\n• Sürükle: Satıra taşı\n• Sağ tık: Hızlı taşı / Menü\n• Sol tık: Detay`}
            >
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  draggable={false}
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : (
                <span className="text-[10px] font-semibold px-1 text-white line-clamp-3 leading-tight pointer-events-none">
                  {item.title}
                </span>
              )}
            </div>
          ))}

          {poolItems.length === 0 && (
            <div className="w-full text-center py-6 text-xs text-neutral-400 font-medium">
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
          className="fixed z-50 w-56 p-1.5 bg-[#1a1a1a] border border-white/15 rounded-xl shadow-2xl text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 border-b border-white/10 font-bold flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0 border border-white/30"
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
                handleAddRow(idx);
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
                handleAddRow(idx + 1);
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
          className="fixed z-50 w-52 p-1.5 bg-[#1a1a1a] border border-white/15 rounded-xl shadow-2xl text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 border-b border-white/10 font-semibold truncate text-white">
            {cardContextMenu.item.title}
          </div>

          <div className="py-1">
            <span className="text-[10px] uppercase font-semibold text-neutral-400 px-2.5 py-1 block">
              Hızlıca Taşı:
            </span>
            <div className="grid grid-cols-3 gap-1 px-2 mb-1.5">
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
                      ? 'ring-2 ring-white'
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
    </div>
  );
};
