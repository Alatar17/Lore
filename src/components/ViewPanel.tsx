import React from 'react';
import { ViewSettings } from '../types';
import { Eye, ZoomIn, ZoomOut } from 'lucide-react';

interface ViewPanelProps {
  settings: ViewSettings;
  onChange: (newSettings: Partial<ViewSettings>) => void;
  onClose: () => void;
}

export const ViewPanel: React.FC<ViewPanelProps> = ({ settings, onChange }) => {
  const cardSize = settings.cardSize || 3;

  return (
    <div
      id="view-panel"
      className="absolute top-12 right-0 z-40 w-64 p-4 bg-[#141b28]/95 backdrop-blur-md border border-[#273248] rounded-xl shadow-2xl text-sm animate-in fade-in zoom-in-95 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-[#222c40]">
        <Eye className="w-4 h-4 text-blue-400" />
        <span className="font-semibold text-xs text-gray-300 uppercase tracking-wider">
          Görünüm Seçenekleri
        </span>
      </div>

      <div className="space-y-3">
        {/* Checkboxes matching mockup */}
        <label className="flex items-center gap-2.5 text-xs text-gray-200 cursor-pointer select-none hover:text-white transition-colors">
          <input
            id="toggle-title-poster"
            type="checkbox"
            checked={settings.showTitleOnPoster}
            onChange={(e) => onChange({ showTitleOnPoster: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800/80 text-blue-500 focus:ring-0 cursor-pointer accent-blue-500"
          />
          <span>Başlığı posterde göster</span>
        </label>

        <label className="flex items-center gap-2.5 text-xs text-gray-200 cursor-pointer select-none hover:text-white transition-colors">
          <input
            id="toggle-show-rating"
            type="checkbox"
            checked={settings.showRating}
            onChange={(e) => onChange({ showRating: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800/80 text-blue-500 focus:ring-0 cursor-pointer accent-blue-500"
          />
          <span>Puanı göster</span>
        </label>

        {/* Poster Boyutu Slider */}
        <div className="pt-3 border-t border-[#222c40]">
          <div className="flex items-center justify-between text-xs text-gray-300 mb-1.5">
            <span className="font-medium flex items-center gap-1.5">
              <span>Kart Boyutu</span>
            </span>
            <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
              {cardSize === 1
                ? 'Mini'
                : cardSize === 2
                ? 'Küçük'
                : cardSize === 3
                ? 'Standart'
                : cardSize === 4
                ? 'Büyük'
                : 'Ekstra'}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <ZoomOut className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              id="slider-card-size"
              type="range"
              min={1}
              max={5}
              step={1}
              value={cardSize}
              onChange={(e) => onChange({ cardSize: Number(e.target.value) })}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <ZoomIn className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-1">
            <span>Kompakt</span>
            <span>Geniş</span>
          </div>
        </div>
      </div>
    </div>
  );
};

