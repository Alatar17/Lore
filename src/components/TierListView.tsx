import React, { useState } from 'react';
import { ArchiveItem, Category, MainTabType, TierRow } from '../types';
import { DEFAULT_TIER_COLORS, MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import { Plus, X, Trash2, Edit2, Undo2 } from 'lucide-react';

interface TierListViewProps {
  mainTab: MainTabType;
  category: Category;
  items: ArchiveItem[];
  onUpdateTierPlacement: (itemId: string, tierRowId: string | null) => void;
  onUpdateCategoryRows: (newRows: TierRow[]) => void;
  onItemClick: (item: ArchiveItem) => void;
}

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
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState<string>('');

  const catItems = items.filter((it) => it.mainTab === mainTab && it.cat === category.id);
  const palette = mainTab === 'game' ? GAME_COLORS : MEDIA_COLORS;
  const baseColor = palette[category.id] || '#3b82f6';

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId);
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
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

  // Row operations
  const handleAddRow = () => {
    const name = window.prompt('Yeni satır adı (ör: S+, EX, B+):', 'A+');
    if (!name || !name.trim()) return;
    const newColor =
      DEFAULT_TIER_COLORS[category.tierRows.length % DEFAULT_TIER_COLORS.length] ||
      '#6366f1';
    const newRow: TierRow = {
      id: `row_${Date.now()}`,
      name: name.trim(),
      color: newColor,
    };
    onUpdateCategoryRows([...category.tierRows, newRow]);
  };

  const handleDeleteRow = (rowId: string) => {
    // Return cards in this row to pool
    const placedCardsInThisRow = catItems.filter((it) => it.tier === rowId);
    placedCardsInThisRow.forEach((it) => onUpdateTierPlacement(it.id, null));
    onUpdateCategoryRows(category.tierRows.filter((r) => r.id !== rowId));
  };

  const handleRenameRow = (rowId: string) => {
    const row = category.tierRows.find((r) => r.id === rowId);
    if (!row) return;
    const newName = window.prompt('Satır adı:', row.name);
    if (newName && newName.trim()) {
      onUpdateCategoryRows(
        category.tierRows.map((r) =>
          r.id === rowId ? { ...r, name: newName.trim() } : r
        )
      );
    }
  };

  const handleColorChange = (rowId: string, color: string) => {
    onUpdateCategoryRows(
      category.tierRows.map((r) => (r.id === rowId ? { ...r, color } : r))
    );
  };

  const poolItems = catItems.filter((it) => !it.tier);

  return (
    <div id="tier-list-container" className="space-y-4 my-3">
      {/* Tier Rows */}
      <div className="space-y-2">
        {category.tierRows.map((row) => {
          const rowItems = catItems.filter((it) => it.tier === row.id);
          const isOver = dragOverRowId === row.id;

          return (
            <div
              key={row.id}
              id={`tier-row-${row.id}`}
              className="flex rounded-xl overflow-hidden border border-[#2e3342] bg-[#161820] min-h-[84px] shadow-sm transition-all"
            >
              {/* Row Label (Left) */}
              <div
                className="w-24 sm:w-28 shrink-0 flex flex-col items-center justify-center p-2 relative select-none font-bold border-r border-[#2e3342]"
                style={{
                  backgroundColor: `${row.color}30`,
                  color: row.color,
                }}
              >
                <button
                  onClick={() => handleDeleteRow(row.id)}
                  title="Satırı sil (kartlar havuza döner)"
                  className="absolute top-1.5 right-1.5 p-0.5 rounded text-gray-400 hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1">
                  <span
                    onClick={() => handleRenameRow(row.id)}
                    className="text-base sm:text-lg cursor-pointer hover:underline tracking-wide text-center"
                    title="Yeniden adlandırmak için tıkla"
                  >
                    {row.name}
                  </span>
                  <button
                    onClick={() => handleRenameRow(row.id)}
                    className="opacity-40 hover:opacity-100 transition-opacity text-xs"
                    title="Adı değiştir"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Color input */}
                <input
                  type="color"
                  value={row.color}
                  onChange={(e) => handleColorChange(row.id, e.target.value)}
                  title="Satır rengini değiştir"
                  className="w-5 h-4 mt-1 p-0 border-0 rounded cursor-pointer bg-transparent"
                />
              </div>

              {/* Row Dropzone (Right) */}
              <div
                id={`dropzone-${row.id}`}
                onDragOver={(e) => handleDragOver(e, row.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, row.id)}
                className={`flex-1 p-2.5 flex flex-wrap gap-2.5 items-center content-start min-h-[84px] transition-colors ${
                  isOver ? 'bg-[#252a38] ring-2 ring-blue-500/50 inset-0' : 'bg-[#181a22]'
                }`}
              >
                {rowItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    className="group relative w-14 sm:w-16 aspect-[2/3] rounded-md overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing hover:scale-105 transition-transform shadow flex items-center justify-center text-center select-none"
                    style={{
                      backgroundColor: `${baseColor}40`,
                    }}
                    title={`${item.title} (Havuza göndermek için tıkla veya sürükle)`}
                  >
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-semibold px-1 text-white line-clamp-3 leading-tight">
                        {item.title}
                      </span>
                    )}

                    {/* Quick remove to pool button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTierPlacement(item.id, null);
                      }}
                      title="Havuza geri çek"
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity hover:bg-red-600"
                    >
                      <Undo2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {rowItems.length === 0 && (
                  <span className="text-xs text-gray-400 italic py-4 px-2">
                    Kartları buraya sürükleyin...
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Row Button */}
      <button
        id="add-tier-row-btn"
        onClick={handleAddRow}
        className="w-full py-2.5 rounded-xl border border-dashed border-[#383e50] hover:border-blue-500/70 hover:bg-blue-500/5 text-gray-300 hover:text-blue-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
      >
        <Plus className="w-4 h-4" /> Yeni Satır Ekle
      </button>

      {/* Unranked Pool */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Havuz (Henüz sıralanmamış — {poolItems.length} yapım)
          </span>
          <span className="text-[11px] text-gray-400">
            Kartları yukarıdaki satırlara sürükleyin
          </span>
        </div>

        <div
          id="tier-pool-dropzone"
          onDragOver={(e) => handleDragOver(e, null)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, null)}
          className={`p-3.5 rounded-xl border border-[#2e3342] bg-[#14151b] min-h-[96px] flex flex-wrap gap-2.5 items-center content-start transition-colors ${
            dragOverRowId === null && draggedItemId
              ? 'bg-[#1e222e] border-blue-500/50'
              : ''
          }`}
        >
          {poolItems.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              className="group relative w-14 sm:w-16 aspect-[2/3] rounded-md overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing hover:scale-105 transition-transform shadow flex items-center justify-center text-center select-none"
              style={{
                backgroundColor: `${baseColor}30`,
              }}
              title={`${item.title} (Detay için tıkla, satıra taşımak için sürükle)`}
            >
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[10px] font-semibold px-1 text-white line-clamp-3 leading-tight">
                  {item.title}
                </span>
              )}
            </div>
          ))}

          {poolItems.length === 0 && (
            <div className="w-full text-center py-5 text-xs text-gray-400 italic">
              Tüm yapımlar satırlara yerleştirildi!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
