import React from 'react';
import {
  Bookmark,
  LucideProps,
  Star,
  Flame,
  Heart,
} from 'lucide-react';
import {
  FollowIndicatorModel,
  FollowIndicatorColor,
  FollowIndicatorIconType,
  RatingIconType,
} from '../types';

/* 7 Farklı Gerçek Yıldız Tasarımı (Tümü hakiki geometrik yıldız formundadır) */
export const Star1Icon: React.FC<LucideProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 2L14.47 9.53L22 12L14.47 14.47L12 22L9.53 14.47L2 12L9.53 9.53Z" />
  </svg>
);

export const Star2Icon: React.FC<LucideProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 2L15.23 7.55L21.51 8.91L17.23 13.70L17.88 20.09L12 17.50L6.12 20.09L6.77 13.70L2.49 8.91L8.77 7.55Z" />
  </svg>
);

export const Star3Icon: React.FC<LucideProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 2L13.88 9.41L21.51 8.91L15.04 12.99L17.88 20.09L12 15.20L6.12 20.09L8.96 12.99L2.49 8.91L10.12 9.41Z" />
  </svg>
);

export const Star4Icon: React.FC<LucideProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 2L14.88 7L20.66 7L17.77 12L20.66 17L14.89 17L12 22L9.12 17L3.34 17L6.23 12L3.34 7L9.11 7Z" />
  </svg>
);

export const Star5Icon: React.FC<LucideProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 2L13.72 7.84L19.07 4.93L16.16 10.28L22 12L16.16 13.72L19.07 19.07L13.72 16.16L12 22L10.28 16.16L4.93 19.07L7.84 13.72L2 12L7.84 10.28L4.93 4.93L10.28 7.84Z" />
  </svg>
);

export const Star6Icon: React.FC<LucideProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 2L13.81 5.24L17 3.34L16.95 7.05L20.66 7L18.76 10.19L22 12L18.76 13.81L20.66 17L16.95 16.95L17 20.66L13.81 18.76L12 22L10.19 18.76L7 20.66L7.05 16.95L3.34 17L5.24 13.81L2 12L5.24 10.19L3.34 7L7.05 7.05L7 3.34L10.19 5.24Z" />
  </svg>
);

export const Star7Icon: React.FC<LucideProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 2L14 8.5L18.5 7L15.5 11L22 12L15.5 13L18.5 17L14 15.5L12 22L10 15.5L5.5 17L8.5 13L2 12L8.5 11L5.5 7L10 8.5Z" />
  </svg>
);

export interface RatingIconOption {
  id: RatingIconType;
  label: string;
  icon: React.ComponentType<LucideProps>;
}

export const RATING_ICON_OPTIONS: RatingIconOption[] = [
  { id: 'star', label: 'Yıldız 0', icon: Star },
  { id: 'flame', label: 'Alev', icon: Flame },
  { id: 'heart', label: 'Kalp', icon: Heart },
  { id: 'star-1', label: 'Yıldız 1', icon: Star1Icon },
  { id: 'star-2', label: 'Yıldız 2', icon: Star2Icon },
  { id: 'star-3', label: 'Yıldız 3', icon: Star3Icon },
  { id: 'star-4', label: 'Yıldız 4', icon: Star4Icon },
  { id: 'star-5', label: 'Yıldız 5', icon: Star5Icon },
  { id: 'star-6', label: 'Yıldız 6', icon: Star6Icon },
  { id: 'star-7', label: 'Yıldız 7', icon: Star7Icon },
];

export const RatingBadgeIcon: React.FC<{
  type?: RatingIconType;
  className?: string;
}> = ({
  type = 'star-2',
  className = 'w-2.5 h-2.5 fill-amber-400 text-amber-400',
}) => {
  const match =
    RATING_ICON_OPTIONS.find((opt) => opt.id === (type || 'star-2')) ||
    RATING_ICON_OPTIONS.find((opt) => opt.id === 'star-2') ||
    RATING_ICON_OPTIONS[0];
  const IconComp = match.icon;
  return <IconComp className={className} />;
};

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
