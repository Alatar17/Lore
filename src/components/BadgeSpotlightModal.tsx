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
        className="relative w-full max-w-[340px] sm:max-w-[400px] bg-[#0d111a]/98 border rounded-3xl px-4 py-5 sm:p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200 transform-gpu will-change-transform"
        style={{
          borderColor: isGlowActive ? `${colorOpt.hex}55` : 'rgba(255, 255, 255, 0.18)',
          boxShadow: isGlowActive
            ? `0 25px 60px -12px rgba(0, 0, 0, 0.95), 0 0 45px ${colorOpt.hex}35`
            : '0 25px 60px -12px rgba(0, 0, 0, 0.95)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kapat Butonu (Mobilde gizli, sadece PC/masaüstünde görünür) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Vitrini Kapat"
          className="hidden sm:flex absolute top-3.5 right-3.5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Rozet Heybetli Vitrin Alanı (Mobilde 280px, Bilgisayarda Doğal 320px) */}
        <div className="relative flex items-center justify-center my-1 py-1">
          {/* Arkadaki Genişleyen Radyal Parıltı Havuzu (Donanım Hızlandırmalı) */}
          {isGlowActive && (
            <div
              className="absolute inset-0 m-auto w-72 h-72 sm:w-80 sm:h-80 rounded-full pointer-events-none transform-gpu"
              style={{
                background: `radial-gradient(circle, ${colorOpt.hex}50 0%, ${colorOpt.hex}18 50%, transparent 75%)`,
                filter: 'blur(22px)',
              }}
            />
          )}

          {/* Rozet İkonu Görseli (280px mobil, tam 320px masaüstü) */}
          <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] flex items-center justify-center">
            {badge.iconData && !badge.iconData.startsWith('images/') && !badge.iconData.startsWith('badges/') ? (
              <img
                src={badge.iconData}
                alt={badge.name}
                className="w-full h-full object-contain select-none"
                style={{
                  filter: isGlowActive
                    ? `drop-shadow(0 0 12px ${colorOpt.hex}) drop-shadow(0 8px 18px rgba(0,0,0,0.85))`
                    : 'drop-shadow(0 8px 18px rgba(0,0,0,0.85))',
                }}
                loading="eager"
              />
            ) : (
              <span className="text-8xl sm:text-9xl select-none leading-none">🏆</span>
            )}
          </div>
        </div>

        {/* Unvan Başlığı (Rozetin altına estetik ve ferah bir boşlukla yerleştirildi) */}
        <div className="mt-4 sm:mt-5 pt-0.5">
          <h3
            className="text-lg sm:text-xl font-black tracking-tight text-white line-clamp-2 px-2"
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
