import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArchiveItem,
  ViewSettings,
  UiExperimentsState,
  isPlannedItem,
  isOngoingItem,
  CustomBadge,
  getBadgeColorOption,
} from '../types';
import { MEDIA_COLORS, GAME_COLORS, BOOK_COLORS } from '../data/initialData';
import { Tv, Star, Layers, Check, Calendar, X, BookmarkCheck, PauseCircle, BookOpen, Gamepad2 } from 'lucide-react';
import { FollowBadge, getFollowColor, RatingBadgeIcon } from './FollowIndicatorIcon';

interface ItemCardProps {
  item: ArchiveItem;
  viewSettings: ViewSettings;
  uiExperiments?: UiExperimentsState;
  customBadges?: CustomBadge[];
  onClick?: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onBadgeClick?: (badge: CustomBadge, item: ArchiveItem) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  viewSettings,
  uiExperiments,
  customBadges,
  onClick,
  onPreview,
  onEdit,
  onMouseEnter,
  onMouseLeave,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onBadgeClick,
}) => {
  if (!item) return null;
  const isGame = item.mainTab === 'game';
  const isBook = item.mainTab === 'book';
  const palette = isGame ? GAME_COLORS : isBook ? BOOK_COLORS : MEDIA_COLORS;
  const baseColor = palette[item.cat] || (isBook ? '#8a6fbf' : '#ffffff');
  const isPlanned = isPlannedItem(item);
  const isOngoing = isOngoingItem(item);

  // Custom Badges (prestij ve denge: maks 4 rozet)
  const assignedBadges: CustomBadge[] = React.useMemo(() => {
    if (!item.badges || item.badges.length === 0) return [];
    let badgesList = customBadges;
    if (!badgesList || badgesList.length === 0) {
      try {
        const stored = localStorage.getItem('lore_custom_badges');
        if (stored) badgesList = JSON.parse(stored);
      } catch {}
    }
    if (!badgesList || badgesList.length === 0) return [];
    const map = new Map(badgesList.map((b) => [b.id, b]));
    return item.badges
      .map((id) => map.get(id))
      .filter((b): b is CustomBadge => Boolean(b))
      .slice(0, 4);
  }, [item.badges, customBadges]);

  const [activeMobileBadgeId, setActiveMobileBadgeId] = useState<string | null>(null);
  const mobileBadgeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (mobileBadgeTimerRef.current) {
        clearTimeout(mobileBadgeTimerRef.current);
      }
    };
  }, []);

  const handleBadgeClick = (e: React.MouseEvent, badge: CustomBadge) => {
    e.stopPropagation();
    if (onBadgeClick) {
      onBadgeClick(badge, item);
      return;
    }
    if (mobileBadgeTimerRef.current) {
      clearTimeout(mobileBadgeTimerRef.current);
    }
    if (activeMobileBadgeId === badge.id) {
      setActiveMobileBadgeId(null);
    } else {
      setActiveMobileBadgeId(badge.id);
      mobileBadgeTimerRef.current = setTimeout(() => {
        setActiveMobileBadgeId(null);
      }, 2500);
    }
  };

  // Format date as only YYYY (or null if unknown/empty)
  const formattedYear = (() => {
    if (!item.date || item.date === '??.??' || item.date === '??' || item.date === 'unknown' || item.date.startsWith('0000')) {
      return null;
    }
    const parts = item.date.split('-');
    if (parts.length >= 1 && parts[0] && parts[0].length === 4 && !isNaN(Number(parts[0]))) {
      return parts[0];
    }
    return null;
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

  const showAllBadges = viewSettings.showAllBadges !== false;
  const showYear = showAllBadges && viewSettings.showYear !== false;
  const showRating = showAllBadges && viewSettings.showRating !== false;
  const showTitle = viewSettings.showTitle !== false;
  const showAnki = showAllBadges && Boolean(viewSettings.showAnki) && Boolean(item.anki);
  const showCustomBadges = showAllBadges && viewSettings.showCustomBadges !== false;
  const showWatching = showAllBadges && viewSettings.showWatching !== false && !isGame && !isBook && item.watching;
  const showFollowing = showAllBadges && viewSettings.showFollowing !== false && !isGame && !isBook && item.following;
  const showDropped = showAllBadges && !isGame && !isBook && Boolean(item.dropped);
  const showGameStatus = showAllBadges && viewSettings.showGameStatus !== false && isGame;
  const showGamePlaying = showAllBadges && isGame && showGameStatus && item.status === 'Oynanıyor';
  const showBookReading = showAllBadges && viewSettings.showWatching !== false && isBook && Boolean(item.reading);
  const showBookDropped = showAllBadges && isBook && Boolean(item.dropped);
  const showBookPages = showAllBadges && isBook && Boolean(item.pageCount && item.pageCount > 0);

  const cardVignette = uiExperiments?.cardVignette || 'none';
  const cardRadius = uiExperiments?.cardRadius || 'normal';
  const cardHoverMotion = uiExperiments?.cardHoverMotion || 'none';
  const badgeStyle = uiExperiments?.badgeStyle || 'default';
  const badgeDensity = uiExperiments?.badgeDensity || 'full';

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.stopPropagation();
      onToggleSelect?.();
      return;
    }

    // Karta tıklandığında (single click) her zaman gecikmesiz kart detay penceresi açılır
    if (onPreview) {
      onPreview();
    } else {
      onClick?.();
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
    if (isBook) return 'rounded-none';
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
      className={`group cursor-pointer flex flex-col transition-all duration-300 ${getHoverMotionClasses()} select-none relative hover:z-30`}
    >
      {/* Poster Container */}
      <div
        className={`relative w-full aspect-[2/3] ${getRadiusClasses()} border bg-[#181818] shadow-md transition-all duration-300 ${getPosterBorderClasses()}`}
        style={{
          background: item.thumbnail
            ? '#141414'
            : `radial-gradient(circle at 50% 30%, ${baseColor}25 0%, #141414 100%)`,
        }}
      >
        {/* Clipped Media Layer (Image, Vignettes & Soft Tulle Background) */}
        <div className={`absolute inset-0 ${getRadiusClasses()} overflow-hidden pointer-events-none`}>
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

          {/* Rozet Arka Planı: Yumuşak Tül Gölge Yastığı (Yalnızca rozet varsa ve görünür durumdaysa rozet adedine göre dinamik uzar) */}
          {showCustomBadges && !isSelectionMode && assignedBadges.length > 0 && (
            <div
              className={`absolute top-0 right-0 pointer-events-none z-[15] transition-all duration-300 ${
                assignedBadges.length === 1
                  ? (showRating && !isPlanned && item.rating > 0 ? 'h-[68px] sm:h-[90px]' : 'h-[44px] sm:h-[58px]')
                  : assignedBadges.length === 2
                  ? (showRating && !isPlanned && item.rating > 0 ? 'h-[98px] sm:h-[132px]' : 'h-[74px] sm:h-[100px]')
                  : assignedBadges.length === 3
                  ? (showRating && !isPlanned && item.rating > 0 ? 'h-[128px] sm:h-[174px]' : 'h-[104px] sm:h-[142px]')
                  : (showRating && !isPlanned && item.rating > 0 ? 'h-[158px] sm:h-[216px]' : 'h-[134px] sm:h-[184px]')
              } w-[42px] sm:w-[50px]`}
              style={{
                background:
                  'radial-gradient(ellipse at 100% 0%, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.20) 35%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0) 80%, transparent 100%)',
              }}
            />
          )}
        </div>

        {/* Date Badge: Top Left for Both Media and Game (Hidden for -ecek and -yor) */}
        {showYear && !isSelectionMode && !isPlanned && !isOngoing && Boolean(formattedYear) && (
          <div
            id={`badge-date-${item.id}`}
            title={isBook ? `Okunma Yılı: ${formattedYear}` : `Yıl: ${formattedYear}`}
            className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-neutral-300 shadow-md z-20 tracking-tight ${getBadgeBaseClasses()} ${isBadgeVisible('year')}`}
          >
            {formattedYear}
          </div>
        )}

        {/* Top-Right Badges Column: Rating Badge and Custom Badges Stacked Vertically */}
        <div className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 z-20 flex flex-col items-center gap-1 sm:gap-2 pointer-events-none">
          {/* Rating Badge (Hidden for -ecek, only visible if rating > 0) */}
          {showRating && !isPlanned && item.rating > 0 && (
            <div
              id={`badge-rating-${item.id}`}
              title="Düzenle"
              onClick={(e) => {
                if (isSelectionMode) return;
                e.stopPropagation();

                const isTouchOrMobile =
                  typeof window !== 'undefined' &&
                  (window.innerWidth < 768 ||
                    'ontouchstart' in window ||
                    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));

                if (isTouchOrMobile) {
                  if (onPreview) onPreview();
                  else onClick?.();
                  return;
                }

                if (onEdit) {
                  onEdit();
                } else {
                  onClick?.();
                }
              }}
              className={`px-1.5 py-0.5 rounded-md cursor-pointer pointer-events-auto ${
                badgeStyle === 'neon'
                  ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] text-amber-300'
                  : badgeStyle === 'minimal'
                  ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent text-amber-400'
                  : 'bg-black/60 sm:bg-black/85 border-transparent sm:border sm:border-amber-500/30 text-amber-400 sm:backdrop-blur-md'
              } text-[10px] sm:text-[11px] font-bold flex items-center gap-0.5 shadow-md ${isBadgeVisible('rating')}`}
            >
              <RatingBadgeIcon
                type={viewSettings.ratingIcon || uiExperiments?.ratingIcon}
                className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0"
              />
              <span>{item.rating}</span>
            </div>
          )}

          {/* Custom Badges (Maksimum 4 rozet, Puan ile dikey eksende ortalı) */}
          {showCustomBadges && !isSelectionMode && assignedBadges.length > 0 && (
            <div className="flex flex-col items-center gap-1.5 sm:gap-2.5 pointer-events-auto">
              {assignedBadges.map((badge) => {
                const colorOpt = getBadgeColorOption(badge.color);
                const isGlowActive = viewSettings.badgeGlowEnabled !== false;
                const isMobileActive = activeMobileBadgeId === badge.id;

                return (
                  <div
                    key={badge.id}
                    id={`badge-custom-${item.id}-${badge.id}`}
                    onClick={(e) => handleBadgeClick(e, badge)}
                    className="group/badge relative pointer-events-auto cursor-pointer"
                  >
                    {/* Rozet Saf Şeffaf Madalya (Mobilde 26px tam ölçü, PC'de 37px - Ortalanmış ve çakışmasız) */}
                    <div
                      className={`w-[26px] h-[26px] sm:w-[37px] sm:h-[37px] flex items-center justify-center transition-all duration-200 ease-out select-none hover:scale-115 active:scale-95 ${
                        isMobileActive ? 'scale-115' : ''
                      }`}
                    >
                      {badge.iconData && !badge.iconData.startsWith('images/') && !badge.iconData.startsWith('badges/') ? (
                        <img
                          src={badge.iconData}
                          alt={badge.name}
                          className="w-full h-full object-contain select-none transition-all duration-200"
                          style={{
                            transform: badge.scale && badge.scale !== 1 ? `scale(${badge.scale})` : undefined,
                            filter: isGlowActive
                              ? (isMobileActive
                                  ? `drop-shadow(0 0 1.5px rgba(0,0,0,0.98)) drop-shadow(0 0 3px rgba(0,0,0,0.85)) drop-shadow(0 0 9px ${colorOpt.hex}) drop-shadow(0 0 20px ${colorOpt.hex}95) drop-shadow(0 3px 6px rgba(0,0,0,0.9))`
                                  : `drop-shadow(0 0 1.5px rgba(0,0,0,0.98)) drop-shadow(0 0 3px rgba(0,0,0,0.85)) drop-shadow(0 0 6px ${colorOpt.hex}) drop-shadow(0 2px 5px rgba(0,0,0,0.85))`)
                              : 'drop-shadow(0 0 1.5px rgba(0,0,0,0.98)) drop-shadow(0 0 3px rgba(0,0,0,0.85)) drop-shadow(0 2px 5px rgba(0,0,0,0.85))',
                          }}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-base sm:text-xl select-none leading-none">🏆</span>
                      )}
                    </div>

                    {/* Sola Doğru Açılan Unvan Balonu (Tooltip) */}
                    <div
                      className={`absolute right-full top-1/2 -translate-y-1/2 mr-2 pointer-events-none transition-all duration-200 z-50 whitespace-nowrap ${
                        isMobileActive
                          ? 'opacity-100 scale-100 translate-x-0'
                          : 'opacity-0 scale-95 translate-x-1 group-hover/badge:opacity-100 group-hover/badge:scale-100 group-hover/badge:translate-x-0'
                      }`}
                    >
                      <div
                        className="relative px-2.5 py-1 rounded-lg bg-[#0d111a]/95 border text-left shadow-2xl backdrop-blur-xl flex items-center gap-1.5"
                        style={{
                          borderColor: isGlowActive ? `${colorOpt.hex}88` : 'rgba(255, 255, 255, 0.25)',
                          boxShadow: isGlowActive
                            ? `0 10px 25px -3px rgba(0, 0, 0, 0.85), 0 0 12px ${colorOpt.hex}45`
                            : '0 10px 25px -3px rgba(0, 0, 0, 0.85)',
                        }}
                      >
                        {/* Küçük ok işareti (sağa dönük, rozeti işaret eden) */}
                        <div
                          className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#0d111a]/95 border-t border-r"
                          style={{
                            borderColor: isGlowActive ? `${colorOpt.hex}88` : 'rgba(255, 255, 255, 0.25)',
                          }}
                        />

                        {/* Rozet Unvan Metni */}
                        <span
                          className="text-[11px] font-bold tracking-tight max-w-[240px] sm:max-w-[300px] truncate"
                          style={{
                            color: isGlowActive ? colorOpt.hex : '#f1f5f9',
                            textShadow: isGlowActive ? `0 0 8px ${colorOpt.hex}60` : undefined,
                          }}
                        >
                          {badge.name}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Media Badges (Bottom Left: Watching Tv / Following Bookmark / Dropped PauseCircle) */}
        {!isGame && !isBook && (showWatching || showFollowing || showDropped) && (
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
            {showDropped && (
              <span
                id={`badge-dropped-${item.id}`}
                title="Yarım Bırakıldı"
                className={`p-1 rounded-md text-rose-400 shadow-md flex items-center justify-center ${
                  badgeStyle === 'neon'
                    ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                    : badgeStyle === 'minimal'
                    ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent'
                    : 'bg-black/60 sm:bg-black/90 border-transparent sm:border sm:border-rose-500/50 sm:backdrop-blur-md'
                }`}
              >
                <PauseCircle className="w-3 h-3" />
              </span>
            )}
          </div>
        )}

        {/* Book Badges (Bottom Left: Reading BookOpen in Blue / Dropped PauseCircle) */}
        {isBook && (showBookReading || showBookDropped) && (
          <div className={`absolute bottom-1.5 left-1.5 flex items-center gap-1 z-20 ${isBadgeVisible('status')}`}>
            {showBookReading && (
              <span
                id={`badge-reading-${item.id}`}
                title="Şu an okunuyor..."
                className={`p-1 rounded-md text-blue-400 shadow-md flex items-center justify-center ${
                  badgeStyle === 'neon'
                    ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]'
                    : badgeStyle === 'minimal'
                    ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent'
                    : 'bg-black/60 sm:bg-black/90 border-transparent sm:border sm:border-blue-500/50 sm:backdrop-blur-md'
                }`}
              >
                <BookOpen className="w-3 h-3" />
              </span>
            )}
            {showBookDropped && (
              <span
                id={`badge-dropped-${item.id}`}
                title="Yarım Bırakıldı"
                className={`p-1 rounded-md text-rose-400 shadow-md flex items-center justify-center ${
                  badgeStyle === 'neon'
                    ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                    : badgeStyle === 'minimal'
                    ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent'
                    : 'bg-black/60 sm:bg-black/90 border-transparent sm:border sm:border-rose-500/50 sm:backdrop-blur-md'
                }`}
              >
                <PauseCircle className="w-3 h-3" />
              </span>
            )}
          </div>
        )}

        {/* Bottom-Right Badges: Anki (Left) and Achievement % (Right) for Game, or Page Count for Book */}
        {(showAnki || (isGame && showGameStatus && item.achPercent !== null && item.achPercent !== undefined && item.achPercent > 0) || (isBook && showBookPages)) && (
          <div className={`absolute bottom-1.5 right-1.5 flex items-center gap-1 z-20 ${isBadgeVisible('status')}`}>
            {showAnki && (
              <span
                id={`badge-anki-${item.id}`}
                title="Anki destesine eklendi"
                className={`p-1 rounded-md text-emerald-400 shadow-md flex items-center justify-center ${
                  badgeStyle === 'neon'
                    ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                    : badgeStyle === 'minimal'
                    ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent'
                    : 'bg-black/60 sm:bg-black/90 border-transparent sm:border sm:border-emerald-500/50 sm:backdrop-blur-md'
                }`}
              >
                <Layers className="w-3 h-3" />
              </span>
            )}

            {/* Book Page Count Badge (Bottom-Right, e.g. 384s) */}
            {isBook && showBookPages && (
              <span
                id={`badge-pages-${item.id}`}
                title={`Sayfa Sayısı: ${item.pageCount}`}
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-neutral-300 shadow-md ${getBadgeBaseClasses()}`}
              >
                {item.pageCount}s
              </span>
            )}

            {isGame && showGameStatus && item.achPercent !== null && item.achPercent !== undefined && item.achPercent > 0 && (
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
            )}
          </div>
        )}

        {/* Game Badges (Bottom Left: Playing Gamepad2 / Hours) */}
        {isGame && (showGamePlaying || (showGameStatus && item.hours !== undefined && item.hours > 0)) && (
          <div className={`absolute bottom-1.5 left-1.5 flex items-center gap-1 z-20 ${isBadgeVisible('status')}`}>
            {showGamePlaying && (
              <span
                id={`badge-game-playing-${item.id}`}
                title="Şu an oynanıyor"
                className={`p-1 rounded-md text-cyan-400 shadow-md flex items-center justify-center ${
                  badgeStyle === 'neon'
                    ? 'bg-black/95 sm:bg-black/90 sm:backdrop-blur-md border border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                    : badgeStyle === 'minimal'
                    ? 'bg-black/60 sm:bg-black/40 sm:backdrop-blur-sm border-transparent'
                    : 'bg-black/60 sm:bg-black/90 border-transparent sm:border sm:border-cyan-500/50 sm:backdrop-blur-md'
                }`}
              >
                <Gamepad2 className="w-3 h-3" />
              </span>
            )}
            {showGameStatus && item.hours !== undefined && item.hours > 0 && (
              <span
                id={`badge-hours-${item.id}`}
                title="Oynanma süresi"
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-neutral-300 shadow-md ${getBadgeBaseClasses()}`}
              >
                {item.hours}s
              </span>
            )}
          </div>
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


