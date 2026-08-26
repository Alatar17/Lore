import React from 'react';
import { ArchiveItem, ViewSettings, UiExperimentsState } from '../types';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import { Tv, Bookmark, Star, Brain, Check } from 'lucide-react';

interface ItemCardProps {
  item: ArchiveItem;
  viewSettings: ViewSettings;
  uiExperiments?: UiExperimentsState;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  viewSettings,
  uiExperiments,
  onClick,
  onMouseEnter,
  onMouseLeave,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}) => {
  const isGame = item.mainTab === 'game';
  const palette = isGame ? GAME_COLORS : MEDIA_COLORS;
  const baseColor = palette[item.cat] || '#ffffff';

  // Format date as only YYYY (or ?? if unknown/empty)
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

  const showYear = viewSettings.showYear !== false;
  const showRating = viewSettings.showRating !== false;
  const showTitle = viewSettings.showTitle !== false;
  const showAnki = Boolean(viewSettings.showAnki) && Boolean(item.anki);
  const showWatching = viewSettings.showWatching !== false && !isGame && item.watching;
  const showFollowing = viewSettings.showFollowing !== false && !isGame && item.following;
  const showGameStatus = viewSettings.showGameStatus !== false && isGame;

  const cardGlow = Boolean(uiExperiments?.cardGlow);
  const cardVignette = uiExperiments?.cardVignette || 'none';
  const cardRadius = uiExperiments?.cardRadius || 'normal';
  const cardHoverMotion = uiExperiments?.cardHoverMotion || 'lift';
  const badgeStyle = uiExperiments?.badgeStyle || 'default';
  const badgeDensity = uiExperiments?.badgeDensity || 'full';

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.stopPropagation();
      onToggleSelect?.();
    } else {
      onClick();
    }
  };

  const getPosterBorderClasses = () => {
    if (isSelected) {
      return 'border-blue-500 ring-2 ring-blue-500/80 shadow-lg shadow-blue-500/20';
    }
    if (isSelectionMode) {
      return 'border-white/20 hover:border-blue-400/50';
    }
    if (cardGlow) {
      return 'border-white/10 group-hover:border-blue-400/70 group-hover:shadow-[0_0_24px_rgba(59,130,246,0.35)]';
    }
    return 'border-white/10 group-hover:shadow-2xl group-hover:border-white/30';
  };

  const getRadiusClasses = () => {
    if (cardRadius === 'sharp') return 'rounded-none';
    if (cardRadius === 'soft') return 'rounded-2xl';
    return 'rounded-xl';
  };

  const getHoverMotionClasses = () => {
    if (isSelectionMode) return 'hover:scale-[1.02]';
    if (cardHoverMotion === 'zoom') return 'hover:scale-105';
    if (cardHoverMotion === 'none') return '';
    return 'hover:-translate-y-1.5';
  };

  const getBadgeBaseClasses = () => {
    if (badgeStyle === 'neon') {
      return 'bg-black/90 backdrop-blur-md border border-cyan-400/60 shadow-[0_0_8px_rgba(34,211,238,0.4)]';
    }
    if (badgeStyle === 'minimal') {
      return 'bg-black/40 backdrop-blur-sm border-transparent';
    }
    return 'bg-black/85 backdrop-blur-md border border-white/15';
  };

  // Badge density visibility helper
  const isBadgeVisible = (type: 'year' | 'rating' | 'status') => {
    if (badgeDensity === 'hover-only') {
      return 'opacity-0 group-hover:opacity-100 transition-opacity duration-200';
    }
    if (badgeDensity === 'compact' && type === 'year') {
      return 'hidden'; // Hide secondary year in compact mode
    }
    return 'opacity-100';
  };

  return (
    <div
      id={`card-${item.id}`}
      onClick={handleCardClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`group cursor-pointer flex flex-col transition-all duration-300 ${getHoverMotionClasses()} select-none relative`}
    >
      {/* Poster Container */}
      <div
        className={`relative w-full aspect-[2/3] ${getRadiusClasses()} overflow-hidden border bg-[#181818] shadow-md transition-all duration-300 ${getPosterBorderClasses()}`}
        style={{
          background: item.thumbnail
            ? '#141414'
            : `radial-gradient(circle at 50% 30%, ${baseColor}25 0%, #141414 100%)`,
        }}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className={`w-full h-full object-cover transition-transform duration-500 ease-out ${
              isSelectionMode ? '' : 'group-hover:scale-105'
            }`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
            <span
              className="text-xs md:text-sm font-semibold tracking-wide text-neutral-200 line-clamp-3 leading-snug drop-shadow-md px-1"
              style={{ color: baseColor }}
            >
              {item.title}
            </span>
          </div>
        )}

        {/* Cinematic Vignette Overlay Effects */}
        {cardVignette === 'bottom' && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent pointer-events-none z-10" />
        )}
        {cardVignette === 'top' && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/10 to-transparent pointer-events-none z-10" />
        )}
        {cardVignette === 'both' && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/50 pointer-events-none z-10" />
        )}

        {/* Selection Checkbox Overlay */}
        {isSelectionMode && (
          <div
            id={`select-checkbox-${item.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            className={`absolute top-2 left-2 z-30 w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 shadow-md ${
              isSelected
                ? 'bg-blue-600 border border-blue-400 text-white scale-110'
                : 'bg-black/70 border border-white/40 text-transparent hover:border-white hover:bg-black/90'
            }`}
          >
            <Check className={`w-4 h-4 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
          </div>
        )}

        {/* Date Badge: Top Left for Both Media and Game */}
        {showYear && !isSelectionMode && (
          <div
            id={`badge-date-${item.id}`}
            title={`Yıl: ${formattedYear}`}
            className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-neutral-300 shadow-md z-20 tracking-tight ${getBadgeBaseClasses()} ${isBadgeVisible('year')}`}
          >
            {formattedYear}
          </div>
        )}

        {/* Rating Badge (Top Right) */}
        {showRating && item.rating > 0 && (
          <div
            id={`badge-rating-${item.id}`}
            className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md ${
              badgeStyle === 'neon'
                ? 'bg-black/90 backdrop-blur-md border border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] text-amber-300'
                : 'bg-black/85 backdrop-blur-md border border-amber-500/30 text-amber-400'
            } text-[11px] font-bold flex items-center gap-0.5 shadow-md z-20 ${isBadgeVisible('rating')}`}
          >
            <Star className="w-2.5 h-2.5 fill-amber-400" />
            <span>{item.rating}</span>
          </div>
        )}

        {/* Media Badges (Bottom Left: Watching Tv / Following Bookmark) */}
        {!isGame && (showWatching || showFollowing) && (
          <div className={`absolute bottom-1.5 left-1.5 flex items-center gap-1 z-20 ${isBadgeVisible('status')}`}>
            {showWatching && (
              <span
                id={`badge-watching-${item.id}`}
                title="Şu an izleniyor"
                className={`p-1 rounded-md text-blue-400 shadow-md flex items-center justify-center ${
                  badgeStyle === 'neon'
                    ? 'bg-black/90 backdrop-blur-md border border-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]'
                    : 'bg-black/90 backdrop-blur-md border border-blue-500/50'
                }`}
              >
                <Tv className="w-3 h-3" />
              </span>
            )}
            {showFollowing && (
              <span
                id={`badge-following-${item.id}`}
                title="Takip listesinde"
                className={`p-1 rounded-md text-amber-400 shadow-md flex items-center justify-center ${
                  badgeStyle === 'neon'
                    ? 'bg-black/90 backdrop-blur-md border border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                    : 'bg-black/90 backdrop-blur-md border border-amber-500/50'
                }`}
              >
                <Bookmark className="w-3 h-3 fill-amber-400" />
              </span>
            )}
          </div>
        )}

        {/* Anki Badge (Bottom Right if media, or beside achievement on game) */}
        {showAnki && (
          <span
            id={`badge-anki-${item.id}`}
            title="Anki destesine eklendi"
            className={`absolute bottom-1.5 ${isGame && showGameStatus && item.achPercent !== null && item.achPercent !== undefined ? 'right-12' : 'right-1.5'} p-1 rounded-md text-emerald-400 shadow-md z-20 flex items-center justify-center ${
              badgeStyle === 'neon'
                ? 'bg-black/90 backdrop-blur-md border border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                : 'bg-black/90 backdrop-blur-md border border-emerald-500/50'
            } ${isBadgeVisible('status')}`}
          >
            <Brain className="w-3 h-3" />
          </span>
        )}

        {/* Game Badges: Hours on Left, Achievement % on Right */}
        {isGame && showGameStatus && (
          <>
            {/* Hours (Bottom-Left) */}
            {item.hours !== undefined && item.hours > 0 && (
              <div className={`absolute bottom-1.5 left-1.5 flex items-center gap-1 z-20 ${isBadgeVisible('status')}`}>
                <span
                  id={`badge-hours-${item.id}`}
                  title="Oynanma süresi"
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-neutral-300 shadow-md ${getBadgeBaseClasses()}`}
                >
                  {item.hours}s
                </span>
              </div>
            )}

            {/* Achievement % (Bottom-Right) */}
            {item.achPercent !== null && item.achPercent !== undefined && (
              <div className={`absolute bottom-1.5 right-1.5 flex items-center gap-1 z-20 ${isBadgeVisible('status')}`}>
                <span
                  id={`badge-ach-${item.id}`}
                  title="Başarım tamamlanma yüzdesi"
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-emerald-400 shadow-md ${
                    badgeStyle === 'neon'
                      ? 'bg-black/90 backdrop-blur-md border border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                      : 'bg-black/90 backdrop-blur-md border border-emerald-500/40'
                  }`}
                >
                  %{item.achPercent}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Caption below poster */}
      {showTitle && (
        <p
          id={`caption-${item.id}`}
          className="mt-1.5 text-xs md:text-sm text-neutral-300 group-hover:text-white font-medium line-clamp-1 leading-snug px-0.5 transition-colors"
          title={item.title}
        >
          {item.title}
        </p>
      )}
    </div>
  );
};


