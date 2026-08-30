import React from 'react';
import { Bookmark, LucideProps } from 'lucide-react';
import { FollowIndicatorModel, FollowIndicatorColor, FollowIndicatorIconType } from '../types';

export interface FollowModelOption {
  id: FollowIndicatorModel;
  title: string;
  shortLabel: string;
  desc: string;
}

export interface FollowColorOption {
  id: FollowIndicatorColor;
  label: string;
  hex: string;
  glowHex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const FOLLOW_MODELS: FollowModelOption[] = [
  {
    id: 'status-dot',
    title: 'Mikro Nokta',
    shortLabel: 'Mikro Nokta',
    desc: 'Yer iminin sağ üst ucunda parlak bir mikro bildirim noktası yanar.',
  },
  {
    id: 'color-shift',
    title: 'Renk Değişimi',
    shortLabel: 'Renk Değişimi',
    desc: 'Not veya gelişme varsa ikonun kendisi seçilen canlı renge bürünür.',
  },
  {
    id: 'underline-accent',
    title: 'Alt Vurgu',
    shortLabel: 'Alt Vurgu',
    desc: 'İkon kutusunun alt tabanında zarif neon bir vurgu çizgisi yerleşir.',
  },
];

export const FOLLOW_COLORS: FollowColorOption[] = [
  {
    id: 'sky',
    label: 'Buzul Mavisi',
    hex: '#38bdf8',
    glowHex: 'rgba(56, 189, 248, 0.7)',
    bgClass: 'bg-sky-400',
    textClass: 'text-sky-400',
    borderClass: 'border-sky-400/60',
  },
  {
    id: 'amber',
    label: 'Altın Sarısı',
    hex: '#fbbf24',
    glowHex: 'rgba(251, 191, 36, 0.7)',
    bgClass: 'bg-amber-400',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-400/60',
  },
  {
    id: 'emerald',
    label: 'Canlı Zümrüt',
    hex: '#34d399',
    glowHex: 'rgba(52, 211, 153, 0.7)',
    bgClass: 'bg-emerald-400',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-400/60',
  },
  {
    id: 'purple',
    label: 'Ametist Moru',
    hex: '#c084fc',
    glowHex: 'rgba(192, 132, 252, 0.7)',
    bgClass: 'bg-purple-400',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-400/60',
  },
  {
    id: 'rose',
    label: 'Kor Mercan',
    hex: '#fb7185',
    glowHex: 'rgba(251, 113, 133, 0.7)',
    bgClass: 'bg-rose-400',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-400/60',
  },
  {
    id: 'white',
    label: 'Saf Beyaz / Gümüş',
    hex: '#f8fafc',
    glowHex: 'rgba(248, 250, 252, 0.7)',
    bgClass: 'bg-white',
    textClass: 'text-white',
    borderClass: 'border-white/70',
  },
];

export function getFollowColor(colorId?: FollowIndicatorColor): FollowColorOption {
  return FOLLOW_COLORS.find((c) => c.id === colorId) || FOLLOW_COLORS[0];
}

export function getFollowModel(modelId?: FollowIndicatorModel): FollowModelOption {
  return FOLLOW_MODELS.find((m) => m.id === modelId) || FOLLOW_MODELS[2]; // Default is underline-accent (Alt Vurgu)
}

interface FollowBadgeProps {
  id?: string;
  hasFollowInfo: boolean;
  model?: FollowIndicatorModel;
  color?: FollowIndicatorColor;
  badgeStyle?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const FollowBadge: React.FC<FollowBadgeProps> = ({
  id,
  hasFollowInfo,
  model = 'underline-accent',
  color = 'sky',
  badgeStyle = 'default',
  className = '',
  onClick,
}) => {
  const activeColor = getFollowColor(color);
  const colorHex = activeColor.hex;

  const renderContent = () => {
    switch (model) {
      case 'status-dot': {
        // Model 1: Minimalist Status Dot
        return (
          <div
            className={`relative p-1 rounded-md flex items-center justify-center transition-all ${
              badgeStyle === 'neon'
                ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-amber-400/60'
                : badgeStyle === 'minimal'
                ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent'
                : 'bg-black/60 sm:bg-black/90 border-transparent sm:border sm:border-amber-500/40 sm:backdrop-blur-md'
            }`}
          >
            <Bookmark className="w-3 h-3 fill-amber-400 text-amber-400" />
            {hasFollowInfo && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-1.5 ring-black"
                style={{
                  backgroundColor: colorHex,
                  boxShadow: `0 0 6px ${colorHex}`,
                }}
                title="Gelişme & Çıkış Notu Mevcut"
              />
            )}
          </div>
        );
      }

      case 'color-shift': {
        // Model 2: Zero extra layer, whole bookmark shifts to accent color
        const isAccent = hasFollowInfo;
        return (
          <div
            className="p-1 rounded-md flex items-center justify-center transition-all"
            style={{
              backgroundColor: badgeStyle === 'minimal' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.88)',
              borderColor: badgeStyle === 'minimal' && !isAccent ? 'transparent' : isAccent ? colorHex : 'rgba(245, 158, 11, 0.4)',
              borderWidth: 1,
              borderStyle: 'solid',
              boxShadow: isAccent ? `0 0 8px ${activeColor.glowHex}` : undefined,
            }}
          >
            <Bookmark
              className="w-3 h-3 transition-colors"
              style={{
                fill: isAccent ? colorHex : '#f59e0b',
                color: isAccent ? colorHex : '#f59e0b',
              }}
            />
          </div>
        );
      }

      case 'underline-accent':
      default: {
        // Model 3: Alt Vurgu (Default)
        return (
          <div
            className={`relative p-1 rounded-md flex items-center justify-center overflow-hidden transition-all ${
              badgeStyle === 'neon'
                ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-amber-400/60'
                : badgeStyle === 'minimal'
                ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent'
                : 'bg-black/60 sm:bg-black/90 border-transparent sm:border sm:border-amber-500/40 sm:backdrop-blur-md'
            }`}
          >
            <Bookmark className="w-3 h-3 fill-amber-400 text-amber-400" />
            {hasFollowInfo && (
              <span
                className="absolute bottom-0 inset-x-0 h-[2px] rounded-b-md"
                style={{
                  backgroundColor: colorHex,
                  boxShadow: `0 0 5px ${colorHex}`,
                }}
              />
            )}
          </div>
        );
      }
    }
  };

  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      title={
        hasFollowInfo
          ? 'Takip listesinde (Gelişmeleri & çıkış notunu görmek için tıkla)'
          : 'Takip listesinde'
      }
      className={`shadow-md flex items-center justify-center transition-all duration-200 ${
        hasFollowInfo
          ? 'cursor-pointer hover:scale-110 active:scale-95'
          : 'cursor-default'
      } ${className}`}
    >
      {renderContent()}
    </button>
  );
};
