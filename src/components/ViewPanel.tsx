import React from 'react';
import { ViewSettings, MainTabType, SortOption } from '../types';
import { SlidersHorizontal, ZoomIn, ZoomOut, Tv, Bookmark, Star, Calendar, Brain, Gamepad2, Type, ArrowUpDown } from 'lucide-react';

interface ViewPanelProps {
  settings: ViewSettings;
  mainTab: MainTabType;
  onChange: (newSettings: Partial<ViewSettings>) => void;
  onClose: () => void;
}

export const ViewPanel: React.FC<ViewPanelProps> = ({ settings, mainTab, onChange }) => {
  const cardSize = settings.cardSize || 3;
  const currentSort: SortOption = settings.sortBy || 'date-desc';

  return (
    <div
      id="view-panel"
      className="absolute top-12 right-0 z-50 w-72 p-4 bg-[#181818]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-sm animate-in fade-in zoom-in-95 duration-150 text-neutral-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-white/10">
        <SlidersHorizontal className="w-4 h-4 text-white" />
        <span className="font-semibold text-xs text-neutral-200 uppercase tracking-wider">
          Görünüm & Sıralama
        </span>
      </div>

      <div className="space-y-3">
        {/* Sort Order Selector */}
        <div className="space-y-1.5 pb-2.5 border-b border-white/10">
          <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
            <span>Sıralama Ölçütü</span>
          </label>
          <select
            id="view-sort-select"
            value={currentSort}
            onChange={(e) => onChange({ sortBy: e.target.value as SortOption })}
            className="w-full bg-neutral-800 text-neutral-200 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value="date-desc" className="bg-neutral-900 text-white">
              İzleme / Bitirme Tarihi (Yeniden Eskiye) [Varsayılan]
            </option>
            <option value="date-asc" className="bg-neutral-900 text-white">
              İzleme / Bitirme Tarihi (Eskiden Yeniye)
            </option>
            <option value="rating-desc" className="bg-neutral-900 text-white">
              Puan (Yüksekten Düşüğe)
            </option>
            <option value="rating-asc" className="bg-neutral-900 text-white">
              Puan (Düşükten Yükseğe)
            </option>
            <option value="title-asc" className="bg-neutral-900 text-white">
              İsim (A-Z)
            </option>
            <option value="title-desc" className="bg-neutral-900 text-white">
              İsim (Z-A)
            </option>
          </select>
        </div>
        {/* Common: Title */}
        <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-2">
            <Type className="w-3.5 h-3.5 text-neutral-400" />
            <span>Kart Başlıklarını Göster</span>
          </div>
          <input
            id="toggle-show-title"
            type="checkbox"
            checked={settings.showTitle !== false}
            onChange={(e) => onChange({ showTitle: e.target.checked })}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-white focus:ring-0 cursor-pointer accent-white"
          />
        </label>

        {/* Common: Rating */}
        <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            <span>Puan Rozetini Göster</span>
          </div>
          <input
            id="toggle-show-rating"
            type="checkbox"
            checked={settings.showRating !== false}
            onChange={(e) => onChange({ showRating: e.target.checked })}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-white focus:ring-0 cursor-pointer accent-white"
          />
        </label>

        {/* Common: Year */}
        <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span>Yıl Bilgisini Göster</span>
          </div>
          <input
            id="toggle-show-year"
            type="checkbox"
            checked={settings.showYear !== false}
            onChange={(e) => onChange({ showYear: e.target.checked })}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-white focus:ring-0 cursor-pointer accent-white"
          />
        </label>

        {/* Common: Anki */}
        <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-emerald-400" />
            <span>Anki Rozetini Göster</span>
          </div>
          <input
            id="toggle-show-anki"
            type="checkbox"
            checked={Boolean(settings.showAnki)}
            onChange={(e) => onChange({ showAnki: e.target.checked })}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-white focus:ring-0 cursor-pointer accent-white"
          />
        </label>

        {/* Media Specific Controls */}
        {mainTab === 'media' && (
          <div className="pt-2 border-t border-white/10 space-y-2">
            <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">Medya Rozetleri</span>
            
            <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <Tv className="w-3.5 h-3.5 text-blue-400" />
                <span>İzleniyor (TV) Rozeti</span>
              </div>
              <input
                id="toggle-show-watching"
                type="checkbox"
                checked={settings.showWatching !== false}
                onChange={(e) => onChange({ showWatching: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-white focus:ring-0 cursor-pointer accent-white"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>Takip Listesi Rozeti</span>
              </div>
              <input
                id="toggle-show-following"
                type="checkbox"
                checked={settings.showFollowing !== false}
                onChange={(e) => onChange({ showFollowing: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-white focus:ring-0 cursor-pointer accent-white"
              />
            </label>
          </div>
        )}

        {/* Game Specific Controls */}
        {mainTab === 'game' && (
          <div className="pt-2 border-t border-white/10 space-y-2">
            <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">Oyun Rozetleri</span>
            
            <label className="flex items-center justify-between text-xs text-neutral-300 hover:text-white cursor-pointer select-none py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Oyun Durumu / Başarım</span>
              </div>
              <input
                id="toggle-show-game-status"
                type="checkbox"
                checked={settings.showGameStatus !== false}
                onChange={(e) => onChange({ showGameStatus: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-white focus:ring-0 cursor-pointer accent-white"
              />
            </label>
          </div>
        )}

        {/* Poster Boyutu Slider */}
        <div className="pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-neutral-300 mb-1.5">
            <span className="font-medium">Kart Boyutu</span>
            <span className="text-[11px] font-semibold text-neutral-300 bg-white/10 px-2 py-0.5 rounded border border-white/10">
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
            <ZoomOut className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <input
              id="slider-card-size"
              type="range"
              min={1}
              max={5}
              step={1}
              value={cardSize}
              onChange={(e) => onChange({ cardSize: Number(e.target.value) })}
              className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <ZoomIn className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          </div>
          <div className="flex justify-between text-[10px] text-neutral-500 mt-1 px-1">
            <span>Kompakt</span>
            <span>Geniş</span>
          </div>
        </div>
      </div>
    </div>
  );
};


