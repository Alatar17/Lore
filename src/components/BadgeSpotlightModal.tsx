import React, { useEffect } from 'react';
import { CustomBadge, getBadgeColorOption } from '../types';
import { X } from 'lucide-react';

interface BadgeSpotlightModalProps {
  isOpen: boolean;
  badge: CustomBadge | null;
  glowEnabled?: boolean;
  onClose: () => void;
}

export const BadgeSpotlightModal: React.FC<BadgeSpotlightModalProps> = ({
  isOpen,
  badge,
  glowEnabled = true,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !badge) return null;

  const colorOpt = getBadgeColorOption(badge.color);
  const isGlowActive = glowEnabled !== false;

  return (
    <div
      id="badge-spotlight-overlay"
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="badge-spotlight-card"
        className="relative w-full max-w-[320px] sm:max-w-[380px] bg-[#0d111a]/95 border rounded-3xl p-6 sm:p-7 text-center shadow-2xl backdrop-blur-xl transition-all animate-in zoom-in-95 duration-200"
        style={{
          borderColor: isGlowActive ? `${colorOpt.hex}55` : 'rgba(255, 255, 255, 0.18)',
          boxShadow: isGlowActive
            ? `0 25px 60px -12px rgba(0, 0, 0, 0.95), 0 0 45px ${colorOpt.hex}35`
            : '0 25px 60px -12px rgba(0, 0, 0, 0.95)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kapat Butonu */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Vitrini Kapat"
          className="absolute top-3.5 right-3.5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Rozet Heybetli Vitrin Alanı (Mobilde 180px, Bilgisayarda 220px) */}
        <div className="relative flex items-center justify-center my-3 py-2">
          {/* Arkadaki Genişleyen Radyal Parıltı Havuzu */}
          {isGlowActive && (
            <div
              className="absolute inset-0 m-auto w-52 h-52 sm:w-64 sm:h-64 rounded-full pointer-events-none transition-all duration-300"
              style={{
                background: `radial-gradient(circle, ${colorOpt.hex}45 0%, ${colorOpt.hex}15 45%, transparent 72%)`,
                filter: 'blur(20px)',
              }}
            />
          )}

          {/* Rozet İkonu Görseli (180px mobil, 220px masaüstü) */}
          <div className="relative w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] flex items-center justify-center">
            {badge.iconData && !badge.iconData.startsWith('images/') && !badge.iconData.startsWith('badges/') ? (
              <img
                src={badge.iconData}
                alt={badge.name}
                className="w-full h-full object-contain select-none transition-transform duration-200"
                style={{
                  transform: badge.scale && badge.scale !== 1 ? `scale(${badge.scale})` : undefined,
                  filter: isGlowActive
                    ? `drop-shadow(0 0 2px rgba(0,0,0,0.98)) drop-shadow(0 0 5px rgba(0,0,0,0.9)) drop-shadow(0 0 18px ${colorOpt.hex}) drop-shadow(0 0 38px ${colorOpt.hex}80) drop-shadow(0 8px 18px rgba(0,0,0,0.95))`
                    : 'drop-shadow(0 0 2px rgba(0,0,0,0.98)) drop-shadow(0 0 5px rgba(0,0,0,0.9)) drop-shadow(0 8px 18px rgba(0,0,0,0.95))',
                }}
                loading="eager"
              />
            ) : (
              <span className="text-6xl sm:text-7xl select-none leading-none">🏆</span>
            )}
          </div>
        </div>

        {/* Unvan Başlığı */}
        <div className="mt-2">
          <h3
            className="text-lg sm:text-xl font-black tracking-tight text-white line-clamp-2 px-1"
            style={{
              textShadow: isGlowActive ? `0 0 12px ${colorOpt.hex}60` : undefined,
            }}
          >
            {badge.name}
          </h3>
        </div>
      </div>
    </div>
  );
};
