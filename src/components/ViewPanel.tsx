import React from 'react';
import { ViewSettings } from '../types';
import { Eye } from 'lucide-react';

interface ViewPanelProps {
  settings: ViewSettings;
  onChange: (newSettings: Partial<ViewSettings>) => void;
  onClose: () => void;
}

export const ViewPanel: React.FC<ViewPanelProps> = ({ settings, onChange }) => {
  return (
    <div
      id="view-panel"
      className="absolute top-11 right-0 z-30 w-56 p-3.5 bg-[#1e2129] border border-[#3e4454] rounded-xl shadow-2xl text-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 pb-2 mb-2.5 border-b border-[#2d313c]">
        <Eye className="w-3.5 h-3.5 text-blue-400" />
        <span className="font-semibold text-xs text-gray-400 uppercase tracking-wider">
          Görünüm Ayarları
        </span>
      </div>

      <div className="space-y-2.5">
        <label className="flex items-center gap-2.5 text-xs text-gray-200 cursor-pointer select-none hover:text-white">
          <input
            id="toggle-title-poster"
            type="checkbox"
            checked={settings.showTitleOnPoster}
            onChange={(e) => onChange({ showTitleOnPoster: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0"
          />
          <span>Başlığı posterde göster</span>
        </label>

        <label className="flex items-center gap-2.5 text-xs text-gray-200 cursor-pointer select-none hover:text-white">
          <input
            id="toggle-show-rating"
            type="checkbox"
            checked={settings.showRating}
            onChange={(e) => onChange({ showRating: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0"
          />
          <span>Puanı göster</span>
        </label>
      </div>
    </div>
  );
};
