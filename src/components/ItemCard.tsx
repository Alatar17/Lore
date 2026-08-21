import React from 'react';
import { ArchiveItem, ViewSettings } from '../types';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import { Tv, Bookmark, Star, Brain } from 'lucide-react';

interface ItemCardProps {
  item: ArchiveItem;
  viewSettings: ViewSettings;
  onClick: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  viewSettings,
  onClick,
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

  return (
    <div
      id={`card-${item.id}`}
      onClick={onClick}
      className="group cursor-pointer flex flex-col transition-all duration-300 hover:-translate-y-1.5 select-none"
    >
      {/* Poster Container */}
      <div
        className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-white/10 bg-[#181818] shadow-md transition-all duration-300 group-hover:shadow-2xl group-hover:border-white/30"
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
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
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

        {/* Date Badge: Top Left for Both Media and Game (Format: YYYY or ??) */}
        {showYear && (
          <div
            id={`badge-date-${item.id}`}
            title={`Yıl: ${formattedYear}`}
            className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-neutral-300 shadow-md z-20 tracking-tight"
          >
            {formattedYear}
          </div>
        )}

        {/* Rating Badge (Top Right) */}
        {showRating && item.rating > 0 && (
          <div
            id={`badge-rating-${item.id}`}
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-amber-500/30 text-[11px] font-bold text-amber-400 flex items-center gap-0.5 shadow-md z-20"
          >
            <Star className="w-2.5 h-2.5 fill-amber-400" />
            <span>{item.rating}</span>
          </div>
        )}

        {/* Media Badges (Bottom Left: Watching Tv / Following Bookmark) */}
        {!isGame && (showWatching || showFollowing) && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 z-20">
            {showWatching && (
              <span
                id={`badge-watching-${item.id}`}
                title="Şu an izleniyor"
                className="p-1 rounded-md bg-black/90 backdrop-blur-md border border-blue-500/50 text-blue-400 shadow-md flex items-center justify-center"
              >
                <Tv className="w-3 h-3" />
              </span>
            )}
            {showFollowing && (
              <span
                id={`badge-following-${item.id}`}
                title="Takip listesinde"
                className="p-1 rounded-md bg-black/90 backdrop-blur-md border border-amber-500/50 text-amber-400 shadow-md flex items-center justify-center"
              >
                <Bookmark className="w-3 h-3 fill-amber-400" />
              </span>
            )}
          </div>
        )}

        {/* Anki Badge (Bottom Right if media, or beside game status) */}
        {showAnki && (
          <span
            id={`badge-anki-${item.id}`}
            title="Anki destesine eklendi"
            className="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-black/90 backdrop-blur-md border border-emerald-500/50 text-emerald-400 shadow-md z-20 flex items-center justify-center"
          >
            <Brain className="w-3 h-3" />
          </span>
        )}

        {/* Game Badges */}
        {isGame && showGameStatus && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 z-20">
            {/* Hours */}
            {item.hours !== undefined && item.hours > 0 && (
              <span
                id={`badge-hours-${item.id}`}
                title="Oynanma süresi"
                className="px-1.5 py-0.5 rounded-md bg-black/90 backdrop-blur-md border border-white/20 text-[10px] font-semibold text-neutral-300 shadow-md"
              >
                {item.hours}s
              </span>
            )}

            {/* Achievement % */}
            {item.achPercent !== null && item.achPercent !== undefined && (
              <span
                id={`badge-ach-${item.id}`}
                title="Başarım tamamlanma"
                className="px-1.5 py-0.5 rounded-md bg-black/90 backdrop-blur-md border border-emerald-500/40 text-[10px] font-semibold text-emerald-400 shadow-md"
              >
                %{item.achPercent}
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
    </div>
  );
};


