import React, { useState, useRef, useEffect } from 'react';
import { AnkiBlurBox, AnkiExtraImage } from '../types';
import { optimizeImageFile } from '../utils/imageOptimizer';
import {
  X,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  Upload,
  Maximize2,
  Layers,
} from 'lucide-react';

interface AnkiEditorModalProps {
  isOpen: boolean;
  itemTitle: string;
  initialThumbnail?: string;
  initialMainBlurs?: AnkiBlurBox[];
  initialExtraImages?: AnkiExtraImage[];
  onApply: (data: {
    thumbnail?: string;
    mainBlurs: AnkiBlurBox[];
    extraImages: AnkiExtraImage[];
  }) => void;
  onClose: () => void;
}

export const AnkiEditorModal: React.FC<AnkiEditorModalProps> = ({
  isOpen,
  itemTitle,
  initialThumbnail,
  initialMainBlurs = [],
  initialExtraImages = [],
  onApply,
  onClose,
}) => {
  // Local copies of state to enable Cancel / Apply workflow
  const [currentThumbnail, setCurrentThumbnail] = useState<string | undefined>(initialThumbnail);
  const [mainBlurs, setMainBlurs] = useState<AnkiBlurBox[]>(() =>
    initialMainBlurs.map((b) => ({ ...b }))
  );
  const [extraImages, setExtraImages] = useState<AnkiExtraImage[]>(() =>
    initialExtraImages.map((img) => ({
      ...img,
      blurs: img.blurs.map((b) => ({ ...b })),
    }))
  );

  // Active view: 0 = Main Thumbnail, 1..N = Extra Images (index = activeImageIndex - 1)
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [isBlurVisible, setIsBlurVisible] = useState<boolean>(true); // Preview blur vs transparent

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extraFileInputRef = useRef<HTMLInputElement>(null);

  // Total images: 1 (main) + extraImages.length (max 3 total)
  const totalImages = 1 + extraImages.length;

  // Active image URL and blurs
  const currentImageUrl =
    activeImageIndex === 0
      ? currentThumbnail
      : extraImages[activeImageIndex - 1]?.url;

  const currentBlurs: AnkiBlurBox[] =
    activeImageIndex === 0
      ? mainBlurs
      : extraImages[activeImageIndex - 1]?.blurs || [];

  // Functional update for current active image's blurs
  const updateCurrentBlurs = (updater: (prev: AnkiBlurBox[]) => AnkiBlurBox[]) => {
    if (activeImageIndex === 0) {
      setMainBlurs((prev) => updater(prev));
    } else {
      const extraIdx = activeImageIndex - 1;
      setExtraImages((prev) => {
        const updated = [...prev];
        if (updated[extraIdx]) {
          updated[extraIdx] = {
            ...updated[extraIdx],
            blurs: updater(updated[extraIdx].blurs),
          };
        }
        return updated;
      });
    }
  };

  // Add new blur box with smart default position
  const handleAddBlurBox = () => {
    const newBox: AnkiBlurBox = {
      id: `blur_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: 15,
      y: 45,
      width: 70,
      height: 14,
    };
    updateCurrentBlurs((prev) => [...prev, newBox]);
    setSelectedBoxId(newBox.id);
  };

  // Remove a specific blur box
  const handleRemoveBlurBox = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    updateCurrentBlurs((prev) => prev.filter((b) => b.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  };

  // Keyboard shortcut: Space toggles Blur visible / transparent
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        setIsBlurVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Bulletproof Drag Implementation using Pointer Capture
  const handleDragPointerDown = (box: AnkiBlurBox, e: React.PointerEvent<HTMLDivElement>) => {
    // If clicking on delete button or resize handle, skip drag
    if (
      (e.target as HTMLElement).closest('.delete-btn') ||
      (e.target as HTMLElement).closest('.resize-handle')
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setSelectedBoxId(box.id);

    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origBoxX = box.x;
    const origBoxY = box.y;
    const boxW = box.width;
    const boxH = box.height;

    const onPointerMove = (moveEv: PointerEvent) => {
      const deltaXPercent = ((moveEv.clientX - startClientX) / containerRect.width) * 100;
      const deltaYPercent = ((moveEv.clientY - startClientY) / containerRect.height) * 100;
      const newX = Math.max(0, Math.min(100 - boxW, origBoxX + deltaXPercent));
      const newY = Math.max(0, Math.min(100 - boxH, origBoxY + deltaYPercent));

      updateCurrentBlurs((prev) =>
        prev.map((b) =>
          b.id === box.id
            ? { ...b, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 }
            : b
        )
      );
    };

    const onPointerUp = (upEv: PointerEvent) => {
      try {
        target.releasePointerCapture(upEv.pointerId);
      } catch {}
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('pointercancel', onPointerUp);
    };

    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
    target.addEventListener('pointercancel', onPointerUp);
  };

  // Bulletproof Resize Implementation supporting nw, sw, se handles
  const handleResizePointerDown = (
    box: AnkiBlurBox,
    corner: 'se' | 'sw' | 'nw',
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setSelectedBoxId(box.id);

    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origBoxW = box.width;
    const origBoxH = box.height;
    const origBoxX = box.x;
    const origBoxY = box.y;
    const origRight = origBoxX + origBoxW;
    const origBottom = origBoxY + origBoxH;

    const onPointerMove = (moveEv: PointerEvent) => {
      const deltaXPercent = ((moveEv.clientX - startClientX) / containerRect.width) * 100;
      const deltaYPercent = ((moveEv.clientY - startClientY) / containerRect.height) * 100;

      let nextX = origBoxX;
      let nextY = origBoxY;
      let nextW = origBoxW;
      let nextH = origBoxH;

      if (corner === 'se') {
        // Bottom-Right: Top-Left stays fixed
        nextW = Math.max(8, Math.min(100 - origBoxX, origBoxW + deltaXPercent));
        nextH = Math.max(4, Math.min(100 - origBoxY, origBoxH + deltaYPercent));
      } else if (corner === 'sw') {
        // Bottom-Left: Top-Right stays fixed
        nextX = Math.max(0, Math.min(origRight - 8, origBoxX + deltaXPercent));
        nextW = origRight - nextX;
        nextH = Math.max(4, Math.min(100 - origBoxY, origBoxH + deltaYPercent));
      } else if (corner === 'nw') {
        // Top-Left: Bottom-Right stays fixed
        nextX = Math.max(0, Math.min(origRight - 8, origBoxX + deltaXPercent));
        nextW = origRight - nextX;
        nextY = Math.max(0, Math.min(origBottom - 4, origBoxY + deltaYPercent));
        nextH = origBottom - nextY;
      }

      updateCurrentBlurs((prev) =>
        prev.map((b) =>
          b.id === box.id
            ? {
                ...b,
                x: Math.round(nextX * 10) / 10,
                y: Math.round(nextY * 10) / 10,
                width: Math.round(nextW * 10) / 10,
                height: Math.round(nextH * 10) / 10,
              }
            : b
        )
      );
    };

    const onPointerUp = (upEv: PointerEvent) => {
      try {
        target.releasePointerCapture(upEv.pointerId);
      } catch {}
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('pointercancel', onPointerUp);
    };

    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
    target.addEventListener('pointercancel', onPointerUp);
  };

  // Handle image upload for main thumbnail
  const handleUploadMainThumbnail = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeImageFile(file, 800, 1200, 0.88);
      setCurrentThumbnail(optimized);
    } catch {}
  };

  // Handle upload for extra image
  const handleUploadExtraImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (extraImages.length >= 2) {
      return;
    }
    try {
      const optimized = await optimizeImageFile(file, 800, 1200, 0.88);
      const newImg: AnkiExtraImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        url: optimized,
        blurs: [],
      };
      setExtraImages((prev) => [...prev, newImg]);
      setActiveImageIndex(extraImages.length + 1);
    } catch {}
  };

  // Delete current extra image
  const handleDeleteCurrentExtraImage = () => {
    if (activeImageIndex === 0) return; // Main poster cannot be deleted
    const extraIdx = activeImageIndex - 1;
    const nextExtra = extraImages.filter((_, idx) => idx !== extraIdx);
    setExtraImages(nextExtra);
    setActiveImageIndex(0);
    setSelectedBoxId(null);
  };

  // Apply changes to parent
  const handleApply = () => {
    onApply({
      thumbnail: currentThumbnail,
      mainBlurs,
      extraImages,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      // Dışarı tıklama güvenliği: Tıklanınca KAPANMAZ!
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="relative w-full max-w-md sm:max-w-lg bg-slate-950 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: Sade ve Kompakt "Anki Editörü" */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2 truncate">
              <span>Anki Editörü</span>
              {itemTitle && (
                <span className="text-xs font-normal text-slate-400 truncate max-w-[200px] sm:max-w-[280px]">
                  ({itemTitle})
                </span>
              )}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Kapat"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center: Stage with 2:3 Aspect Ratio Poster & Image Navigator Directly Beneath Poster */}
        <div className="flex-1 min-h-[420px] sm:min-h-[480px] max-h-[68vh] overflow-hidden p-3 sm:p-4 flex flex-col items-center justify-center bg-slate-900/60 select-none">
          {currentImageUrl ? (
            <div className="flex flex-col items-center justify-center h-full max-h-full">
              <div
                ref={containerRef}
                className="relative w-auto h-[48vh] sm:h-[54vh] aspect-[2/3] mx-auto rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-black select-none shrink"
                style={{ touchAction: 'none' }}
                onClick={() => setSelectedBoxId(null)}
              >
                {/* Background Poster Image */}
                <img
                  src={currentImageUrl}
                  alt={itemTitle || 'Afiş'}
                  className="w-full h-full object-cover pointer-events-none select-none"
                  draggable={false}
                />

                {/* Blur Boxes Layer */}
                {currentBlurs.map((box, index) => {
                  const isSelected = selectedBoxId === box.id;
                  return (
                    <div
                      key={box.id}
                      onPointerDown={(e) => handleDragPointerDown(box, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBoxId(box.id);
                      }}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                        touchAction: 'none',
                      }}
                      className={`absolute cursor-move rounded-lg transition-none select-none group ${
                        isBlurVisible
                          ? 'backdrop-blur-xl bg-white/10 border border-white/35 shadow-lg'
                          : 'bg-emerald-500/15 border-2 border-dashed border-emerald-400 shadow-[0_0_0_1px_rgba(0,0,0,0.8)]'
                      } ${
                        isSelected
                          ? 'z-20'
                          : 'z-10'
                      }`}
                    >
                      {/* Sol Üst: Boyutlandırma Tutamacı */}
                      <div
                        onPointerDown={(e) => handleResizePointerDown(box, 'nw', e)}
                        title="Sol Üstten Boyutlandır"
                        className="resize-handle absolute left-0.5 top-0.5 w-3.5 h-3.5 cursor-nw-resize flex items-center justify-center text-white/70 hover:text-white drop-shadow transition-colors"
                      >
                        <Maximize2 className="w-2 h-2 rotate-90" />
                      </div>

                      {/* Sol Üst: "Blur #1" Etiketi (Tutamaçın hemen sağında) */}
                      <div className="absolute top-0.5 left-4 flex items-center gap-1 pointer-events-none select-none">
                        <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                          Blur #{index + 1}
                        </span>
                      </div>

                      {/* Sol Alt: Boyutlandırma Tutamacı */}
                      <div
                        onPointerDown={(e) => handleResizePointerDown(box, 'sw', e)}
                        title="Sol Alttan Boyutlandır"
                        className="resize-handle absolute left-0.5 bottom-0.5 w-3.5 h-3.5 cursor-sw-resize flex items-center justify-center text-white/70 hover:text-white drop-shadow transition-colors"
                      >
                        <Maximize2 className="w-2 h-2" />
                      </div>

                      {/* Sağ Üst: Zarif Silme (X) Butonu - Arka plansız, hafif gölgeli, hover'da kırmızı */}
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => handleRemoveBlurBox(box.id, e)}
                        title="Kutuyu Sil"
                        className="delete-btn absolute top-1 right-1 p-0.5 text-white/80 hover:text-red-400 transition-colors cursor-pointer drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                      >
                        <X className="w-2.5 h-2.5 stroke-[2.5]" />
                      </button>

                      {/* Sağ Alt: Boyutlandırma Tutamacı */}
                      <div
                        onPointerDown={(e) => handleResizePointerDown(box, 'se', e)}
                        title="Sağ Alttan Boyutlandır"
                        className="resize-handle absolute right-0.5 bottom-0.5 w-3.5 h-3.5 cursor-se-resize flex items-center justify-center text-white/70 hover:text-white drop-shadow transition-colors"
                      >
                        <Maximize2 className="w-2 h-2 rotate-90" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resim Seçici & Sayacı: Doğrudan Resmin Altında */}
              <div className="flex items-center justify-center gap-2 mt-2.5 px-3 py-1 rounded-full bg-slate-950/85 border border-white/15 shadow-md select-none shrink-0">
                <button
                  type="button"
                  disabled={activeImageIndex <= 0}
                  onClick={() => {
                    setActiveImageIndex((prev) => Math.max(0, prev - 1));
                    setSelectedBoxId(null);
                  }}
                  className="p-1 rounded-full hover:bg-white/10 text-slate-300 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Önceki Görsel"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1.5 px-1.5 text-xs">
                  <span className="font-semibold text-slate-200 whitespace-nowrap">
                    {activeImageIndex === 0 ? '1. Ana Afiş' : `${activeImageIndex + 1}. Ek Resim`}
                  </span>
                  <span className="text-slate-500 font-normal">/ {totalImages}</span>
                </div>

                <button
                  type="button"
                  disabled={activeImageIndex >= totalImages - 1}
                  onClick={() => {
                    setActiveImageIndex((prev) => Math.min(totalImages - 1, prev + 1));
                    setSelectedBoxId(null);
                  }}
                  className="p-1 rounded-full hover:bg-white/10 text-slate-300 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Sonraki Görsel"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Missing Poster Fallback */
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm rounded-2xl border-2 border-dashed border-white/20 bg-black/40">
              <Layers className="w-10 h-10 text-slate-500 mb-3" />
              <h3 className="text-sm font-bold text-slate-200 mb-1">Afiş Bulunmuyor</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Kartın ön yüzünde görselden tanıma yapabilmek için afiş veya sahne görseli ekleyin.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadMainThumbnail}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Afiş Görseli Yükle</span>
              </button>
            </div>
          )}
        </div>

        {/* Toolbar: Sol (Blur Araçları), Sağ (Ek Resim Ekle / Resmi Sil) */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-4 py-2.5 bg-slate-900 border-t border-white/10 text-xs">
          {/* Sol: Blur Araçları */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!currentImageUrl}
              onClick={handleAddBlurBox}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Blur Kutusu Ekle</span>
            </button>

            <button
              type="button"
              disabled={!currentImageUrl || currentBlurs.length === 0}
              onClick={() => setIsBlurVisible(!isBlurVisible)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isBlurVisible
                  ? 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/20'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              {isBlurVisible ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isBlurVisible ? 'Şeffaf Yap' : 'Blur Önizle'}</span>
            </button>
          </div>

          {/* Sağ: Ek Resim Ekle / Resmi Sil */}
          <div className="flex items-center gap-1.5">
            {activeImageIndex > 0 && (
              <button
                type="button"
                onClick={handleDeleteCurrentExtraImage}
                title="Bu ek resmi sil"
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">Resmi Sil</span>
              </button>
            )}

            {extraImages.length < 2 && (
              <>
                <input
                  ref={extraFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadExtraImage}
                />
                <button
                  type="button"
                  onClick={() => extraFileInputRef.current?.click()}
                  title="2. veya 3. ek sahne resmi ekle"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ek Resim Ekle</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom Actions: Vazgeç vs Uygula ve Kapat */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-slate-950">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-xs border border-white/10 transition-colors cursor-pointer"
          >
            Vazgeç
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Uygula ve Kapat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
