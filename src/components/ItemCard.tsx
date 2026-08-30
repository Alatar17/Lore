import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArchiveItem, ViewSettings, UiExperimentsState } from '../types';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import { Tv, Star, Brain, Check, Calendar, X, BookmarkCheck } from 'lucide-react';
import { FollowBadge, getFollowColor } from './FollowIndicatorIcon';

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
  if (!item) return null;
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

  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  useEffect(() => {
    if (!showAnnouncementModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAnnouncementModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAnnouncementModal]);

  const showYear = viewSettings.showYear !== false;
  const showRating = viewSettings.showRating !== false;
  const showTitle = viewSettings.showTitle !== false;
  const showAnki = Boolean(viewSettings.showAnki) && Boolean(item.anki);
  const showWatching = viewSettings.showWatching !== false && !isGame && item.watching;
  const showFollowing = viewSettings.showFollowing !== false && !isGame && item.following;
  const showGameStatus = viewSettings.showGameStatus !== false && isGame;

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
    return 'border-white/10 group-hover:shadow-2xl group-hover:border-white/30';
  };

  const getRadiusClasses = () => {
    if (cardRadius === 'sharp') return 'rounded-none';
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
      return 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-cyan-400/60 shadow-[0_0_8px_rgba(34,211,238,0.4)]';
    }
    if (badgeStyle === 'minimal') {
      return 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent';
    }
    // 'default': mobilde otomatik minimal şeffaf, sm: ve üstü PC'de standart koyu kutu + kenarlık
    return 'bg-black/60 sm:bg-black/85 border-transparent sm:border-white/15 sm:backdrop-blur-md';
  };

  // Badge density visibility helper
  const isBadgeVisible = (_type?: 'year' | 'rating' | 'status') => {
    if (badgeDensity === 'hover-only') {
      return 'opacity-0 group-hover:opacity-100 transition-opacity duration-200';
    }
    return 'opacity-100';
  };

  const followModel = viewSettings?.followIndicatorModel || uiExperiments?.followIndicatorModel || 'status-dot';
  const followColor = viewSettings?.followIndicatorColor || uiExperiments?.followIndicatorColor || 'sky';
  const activeFollowColor = getFollowColor(followColor);

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

        {/* Cinematic Vignette Overlay Effects - Softened, Subtler and Lighter */}
        {cardVignette === 'bottom' && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent pointer-events-none z-10" />
        )}
        {cardVignette === 'corners' && (
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.30) 100%)',
            }}
          />
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
                ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] text-amber-300'
                : badgeStyle === 'minimal'
                ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent text-amber-400'
                : 'bg-black/60 sm:bg-black/85 border-transparent sm:border sm:border-amber-500/30 text-amber-400 sm:backdrop-blur-md'
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
                    ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]'
                    : badgeStyle === 'minimal'
                    ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent'
                    : 'bg-black/60 sm:bg-black/90 border-transparent sm:border sm:border-blue-500/50 sm:backdrop-blur-md'
                }`}
              >
                <Tv className="w-3 h-3" />
              </span>
            )}
            {showFollowing && (() => {
              const hasFollowInfo = Boolean(item.expectedDate?.trim() || item.followNotes?.trim());
              return (
                <FollowBadge
                  id={`badge-following-${item.id}`}
                  hasFollowInfo={hasFollowInfo}
                  model={followModel}
                  color={followColor}
                  badgeStyle={badgeStyle}
                  onClick={(e) => {
                    if (hasFollowInfo) {
                      e.stopPropagation();
                      setShowAnnouncementModal(true);
                    }
                  }}
                />
              );
            })()}
          </div>
        )}

        {/* Anki Badge (Bottom Right if media, or beside achievement on game) */}
        {showAnki && (
          <span
            id={`badge-anki-${item.id}`}
            title="Anki destesine eklendi"
            className={`absolute bottom-1.5 ${isGame && showGameStatus && item.achPercent !== null && item.achPercent !== undefined ? 'right-12' : 'right-1.5'} p-1 rounded-md text-emerald-400 shadow-md z-20 flex items-center justify-center ${
              badgeStyle === 'neon'
                ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                : badgeStyle === 'minimal'
                ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent'
                : 'bg-black/60 sm:bg-black/90 border-transparent sm:border sm:border-emerald-500/50 sm:backdrop-blur-md'
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
                      ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                      : badgeStyle === 'minimal'
                      ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent'
                      : 'bg-black/60 sm:bg-black/90 border-transparent sm:border sm:border-emerald-500/40 sm:backdrop-blur-md'
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

      {/* Spacious Announcement / Follow Details Dialog (No Backdrop Blur, Horizontally Widened, Clear View of Background) */}
      {showAnnouncementModal && typeof document !== 'undefined' && createPortal(
        <div
          id={`announcement-backdrop-${item.id}`}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/50 animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setShowAnnouncementModal(false);
          }}
        >
          <div
            id={`announcement-modal-${item.id}`}
            className="relative w-full max-w-xl sm:max-w-2xl bg-[#111520] border border-sky-500/35 rounded-2xl p-5 sm:p-7 shadow-2xl text-left space-y-4 sm:space-y-5"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: '0 25px 60px -12px rgba(0,0,0,0.95), 0 0 35px rgba(56,189,248,0.18)' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className="p-2 rounded-xl border shrink-0 flex items-center justify-center"
                    style={{
                      backgroundColor: `${activeFollowColor.hex}18`,
                      borderColor: `${activeFollowColor.hex}35`,
                      color: activeFollowColor.hex,
                    }}
                  >
                    <BookmarkCheck className="w-4 h-4" />
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight line-clamp-1">
                    {item.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 pl-10">
                  Takip Gelişmeleri & Çıkış Bilgisi
                </p>
              </div>
              <button
                type="button"
                id={`btn-close-announcement-${item.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAnnouncementModal(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Kapat (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-3.5 max-h-[62vh] overflow-y-auto custom-scrollbar pr-1">
              {item.expectedDate?.trim() && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3.5">
                  <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Beklenen Çıkış / Dönem
                    </span>
                    <span className="text-sm sm:text-base font-semibold text-slate-100 break-words">
                      {item.expectedDate}
                    </span>
                  </div>
                </div>
              )}

              {item.followNotes?.trim() ? (
                <div className="p-4 sm:p-4.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
                  <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Gelişme Notu & Açıklamalar
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {item.followNotes}
                  </p>
                </div>
              ) : (
                !item.expectedDate?.trim() && (
                  <p className="text-xs sm:text-sm text-slate-400 italic py-3 text-center">
                    Henüz kayıtlı bir çıkış tarihi veya gelişme notu bulunmuyor.
                  </p>
                )
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};


