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

        {/* Poster Boyutu Slider (Masaüstü için, mobilde 3 kart grid sabit olduğu için gizlenir) */}
        <div className="hidden sm:block pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-neutral-300 mb-2">
            <span className="font-medium text-slate-300">Kart Boyutu</span>
            <span className="text-[11px] font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-lg">
              {cardSize === 1
                ? 'Küçük'
                : cardSize === 2
                ? 'Standart'
                : cardSize === 3
                ? 'Orta-Büyük'
                : cardSize === 4
                ? 'Büyük'
                : 'Ekstra'}
            </span>
          </div>

          {/* Range Slider */}
          <div className="relative flex items-center px-0.5">
            <input
              id="slider-card-size"
              type="range"
              min={1}
              max={5}
              step={1}
              value={cardSize}
              onChange={(e) => onChange({ cardSize: Number(e.target.value) })}
              className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
          </div>

          {/* 5 Indicator Dots under the slider */}
          <div className="flex items-center justify-between px-2 mt-2">
            {[1, 2, 3, 4, 5].map((step) => {
              const isActive = cardSize === step;
              const stepName =
                step === 1
                  ? 'Küçük'
                  : step === 2
                  ? 'Standart'
                  : step === 3
                  ? 'Orta-Büyük'
                  : step === 4
                  ? 'Büyük'
                  : 'Ekstra';
              return (
                <button
                  key={step}
                  type="button"
                  id={`btn-card-size-step-${step}`}
                  title={`Kart boyutu: ${stepName}`}
                  onClick={() => onChange({ cardSize: step })}
                  className="p-1 -m-1 flex items-center justify-center cursor-pointer group"
                >
                  <span
                    className={`transition-all rounded-full ${
                      isActive
                        ? 'w-2.5 h-2.5 bg-sky-400 ring-4 ring-sky-400/25 shadow-[0_0_8px_rgba(56,189,248,0.9)]'
                        : 'w-1.5 h-1.5 bg-white/25 group-hover:bg-white/60 group-hover:scale-125'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Interactive Zoom Buttons (Kompakt / Geniş with clickable Magnifying Glasses) */}
          <div className="flex justify-between items-center text-[11px] text-neutral-400 mt-2.5 px-0.5">
            <button
              type="button"
              id="btn-zoom-out-card-size"
              disabled={cardSize <= 1}
              onClick={() => onChange({ cardSize: Math.max(1, cardSize - 1) })}
              className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer py-0.5 px-1.5 rounded hover:bg-white/5"
              title="Boyutu Küçült (Kompakt)"
            >
              <ZoomOut className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[10px] font-medium">Kompakt</span>
            </button>

            <button
              type="button"
              id="btn-zoom-in-card-size"
              disabled={cardSize >= 5}
              onClick={() => onChange({ cardSize: Math.min(5, cardSize + 1) })}
              className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer py-0.5 px-1.5 rounded hover:bg-white/5"
              title="Boyutu Büyüt (Geniş)"
            >
              <span className="text-[10px] font-medium">Geniş</span>
              <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


