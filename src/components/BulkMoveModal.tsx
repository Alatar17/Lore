import React, { useState, useEffect } from 'react';
import { Category, MainTabType } from '../types';
import { FolderInput, X, ArrowRight, Layers } from 'lucide-react';

interface BulkMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  categories: Category[];
  mainTab: MainTabType;
  onMove: (targetCatId: string, targetSub: string | null) => void;
}

export const BulkMoveModal: React.FC<BulkMoveModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  categories,
  mainTab,
  onMove,
}) => {
  const [targetCatId, setTargetCatId] = useState<string>('');
  const [targetSub, setTargetSub] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (categories.length > 0) {
        setTargetCatId(categories[0].id);
      } else {
        setTargetCatId('');
      }
      setTargetSub('');
    }
  }, [isOpen, categories]);

  if (!isOpen) return null;

  const mainTabLabel = mainTab === 'media' ? 'Medya' : 'Oyun';
  const selectedCategory = categories.find((c) => c.id === targetCatId);
  const availableSubgroups = selectedCategory?.subgroups || [];

  const handleExecuteMove = () => {
    onMove(targetCatId, targetSub ? targetSub : null);
    onClose();
  };

  return (
    <div
      id="bulk-move-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="bulk-move-modal-content"
        className="w-full max-w-md bg-[#181818] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Toplu Yapım Taşıma</h2>
              <p className="text-xs text-neutral-400">
                Seçili <span className="text-blue-400 font-semibold">{selectedCount}</span> yapımı yeni bir kategoriye aktarın
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4">
          {/* Target Category Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Hedef Kategori ({mainTabLabel})</span>
            </label>
            <select
              id="bulk-target-category"
              value={targetCatId}
              onChange={(e) => {
                setTargetCatId(e.target.value);
                setTargetSub('');
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-[#222222] border border-white/15 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">(Kategorisiz / Havuz)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target Subgroup Select */}
          {targetCatId && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                <span>Alt Grup / Alt Klasör (İsteğe Bağlı)</span>
              </label>
              <select
                id="bulk-target-subgroup"
                value={targetSub}
                onChange={(e) => setTargetSub(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#222222] border border-white/15 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">(Yok / Ana Kategori)</option>
                {availableSubgroups.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
              {availableSubgroups.length === 0 && (
                <p className="text-[11px] text-neutral-500">
                  Bu kategoride tanımlı alt grup bulunmuyor.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            İptal
          </button>
          <button
            id="confirm-bulk-move-btn"
            onClick={handleExecuteMove}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FolderInput className="w-3.5 h-3.5" />
            <span>{selectedCount} Yapımı Taşı</span>
          </button>
        </div>
      </div>
    </div>
  );
};
