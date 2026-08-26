import React, { useEffect } from 'react';
import { ArchiveItem } from '../types';
import { X, Star, Calendar, Clock, Trophy, Tv, Bookmark, Brain } from 'lucide-react';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';

interface ImagePreviewModalProps {
  item: ArchiveItem;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ item, onClose }) => {
  const isGame = item.mainTab === 'game';
  const palette = isGame ? GAME_COLORS : MEDIA_COLORS;
  const baseColor = palette[item.cat] || '#ffffff';

  // Format date
  const formattedYear = (() => {
    if (!item.date || item.date === '??.??' || item.date === '??' || item.date === 'unknown' || item.date.startsWith('0000')) {
      return '??';
    }
    const parts = item.date.split('-');
    if (parts.length >= 1 && parts[0] && parts[0].length === 4) {
      return parts[0];
    }
    return '??';
  })();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on 'f', 'F' or 'Escape'
      if (e.key === 'f' || e.key === 'F' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return (
    <div
      id="image-preview-overlay"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
    >
      {/* Modal Container */}
      <div
        id="image-preview-card"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] max-w-[90vw] md:max-w-2xl lg:max-w-3xl flex flex-col rounded-2xl overflow-hidden bg-[#12151f] border border-white/20 shadow-2xl shadow-black/80 select-none animate-in zoom-in-95 duration-200"
      >
        {/* Close Button Top Right */}
        <button
          id="close-preview-btn"
          onClick={onClose}
          title="Kapat (F veya ESC)"
          className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/70 hover:bg-black text-slate-200 hover:text-white border border-white/20 shadow-lg transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Poster Image or Placeholder */}
        <div className="relative w-full overflow-hidden flex items-center justify-center bg-black/60 min-h-[300px] max-h-[72vh]">
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt={item.title}
              className="w-full h-full max-h-[72vh] object-contain"
            />
          ) : (
            <div className="p-16 text-center space-y-3">
              <span
                className="text-2xl font-bold block"
                style={{ color: baseColor }}
              >
                {item.title}
              </span>
              <span className="text-xs text-slate-400">Görsel bulunmuyor</span>
            </div>
          )}

          {/* Quick Badges in Image */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
            {formattedYear !== '??' && (
              <span className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 text-xs font-semibold text-neutral-200 flex items-center gap-1 shadow">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formattedYear}
              </span>
            )}
            {item.rating > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-amber-500/40 text-xs font-bold text-amber-400 flex items-center gap-1 shadow">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                {item.rating}/10
              </span>
            )}
          </div>
        </div>

        {/* Footer Info Strip */}
        <div className="p-4 sm:p-5 bg-[#161a26] border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-100 truncate flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: baseColor }}
              />
              {item.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              {item.genre && item.genre.length > 0 && (
                <span>{item.genre.slice(0, 4).join(', ')}</span>
              )}
              {item.sub && (
                <>
                  {item.genre && item.genre.length > 0 && <span>•</span>}
                  <span className="font-medium text-slate-300">{item.sub}</span>
                </>
              )}
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center gap-2 shrink-0">
            {!isGame && item.watching && (
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-medium flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5" /> İzleniyor
              </span>
            )}
            {!isGame && item.following && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 fill-amber-400" /> Takipte
              </span>
            )}
            {Boolean(item.anki) && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> Anki
              </span>
            )}
            {isGame && item.hours !== undefined && item.hours > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 border border-white/15 text-xs font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> {item.hours}s
              </span>
            )}
            {isGame && item.achPercent !== null && item.achPercent !== undefined && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> %{item.achPercent}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
