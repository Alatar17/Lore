import React from 'react';
import { ArchiveItem, ViewSettings } from '../types';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';

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
  const baseColor = palette[item.cat] || '#3b82f6';

  // Format date as MM.YYYY (or ??.?? if unknown/empty)
  const formattedDate = (() => {
    if (!item.date || item.date === '??.??' || item.date === 'unknown' || item.date.startsWith('0000')) {
      return '??.??';
    }
    const parts = item.date.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const month = parts[1];
      if (year && month) {
        return `${month}.${year}`;
      }
    }
    return '??.??';
  })();

  return (
    <div
      id={`card-${item.id}`}
      onClick={onClick}
      className="group cursor-pointer flex flex-col transition-all duration-300 hover:-translate-y-1.5 select-none"
    >
      {/* Poster Container */}
      <div
        className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-md transition-all duration-300 group-hover:shadow-2xl group-hover:border-[var(--accent-color)]"
        style={{
          background: item.thumbnail
            ? 'var(--bg-surface)'
            : `radial-gradient(circle at 50% 30%, ${baseColor}22 0%, var(--bg-surface) 100%)`,
        }}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-106"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
            {(!viewSettings.showTitleOnPoster || item.thumbnail) && (
              <span
                className="text-xs md:text-sm font-semibold tracking-wide text-slate-200 line-clamp-3 leading-snug drop-shadow-md px-1"
                style={{ color: `${baseColor}ee` }}
              >
                {item.title}
              </span>
            )}
          </div>
        )}

        {/* Title on poster overlay when enabled */}
        {viewSettings.showTitleOnPoster && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex items-end p-2.5 z-10">
            <span className="text-xs md:text-sm font-semibold text-white line-clamp-2 leading-tight drop-shadow-md group-hover:text-blue-200 transition-colors">
              {item.title}
            </span>
          </div>
        )}

        {/* Rating Badge (Top Right) */}
        {viewSettings.showRating && item.rating > 0 && (
          <div
            id={`badge-rating-${item.id}`}
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[#0a0e17]/85 backdrop-blur-md border border-amber-500/30 text-[11px] font-bold text-amber-400 flex items-center gap-0.5 shadow-md z-20"
          >
            <span className="text-[10px]">★</span>
            <span>{item.rating}</span>
          </div>
        )}

        {/* Game Date Badge: Top Left */}
        {isGame && (
          <div
            id={`badge-date-${item.id}`}
            title={`Oynanma Tarihi: ${formattedDate}`}
            className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-white/20 text-[10px] font-semibold text-slate-200 shadow-md z-20 tracking-tight"
          >
            {formattedDate}
          </div>
        )}

        {/* Media Date Badge: Bottom Center */}
        {!isGame && (
          <div
            id={`badge-date-${item.id}`}
            title={`İzlenme/Bitirme Tarihi: ${formattedDate}`}
            className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-white/20 text-[10px] font-semibold text-slate-200 shadow-md z-20 whitespace-nowrap tracking-tight pointer-events-none"
          >
            {formattedDate}
          </div>
        )}

        {/* Media Badges (Bottom Left: Watching ▶ / Following ★) */}
        {!isGame && (item.watching || item.following) && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 z-20">
            {item.watching && (
              <span
                id={`badge-watching-${item.id}`}
                title="Şu an izleniyor"
                className="px-1.5 py-0.5 rounded-md bg-[#0a0e17]/90 backdrop-blur-md border border-cyan-500/50 text-[10px] font-bold text-cyan-400 shadow-md"
              >
                ▶
              </span>
            )}
            {item.following && (
              <span
                id={`badge-following-${item.id}`}
                title="Takip listesinde"
                className="px-1.5 py-0.5 rounded-md bg-[#0a0e17]/90 backdrop-blur-md border border-amber-500/50 text-[10px] font-bold text-amber-400 shadow-md"
              >
                ★
              </span>
            )}
          </div>
        )}

        {/* Game Badges */}
        {isGame && (
          <>
            {/* Hours (Bottom Left) */}
            {item.hours !== undefined && item.hours > 0 && (
              <span
                id={`badge-hours-${item.id}`}
                title="Oynanma süresi"
                className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#0a0e17]/90 backdrop-blur-md border border-sky-500/40 text-[10px] font-semibold text-sky-400 shadow-md z-20"
              >
                {item.hours}s
              </span>
            )}

            {/* Achievement % (Bottom Right) */}
            {item.achPercent !== null && item.achPercent !== undefined && (
              <span
                id={`badge-ach-${item.id}`}
                title="Başarım tamamlanma"
                className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[#0a0e17]/90 backdrop-blur-md border border-emerald-500/40 text-[10px] font-semibold text-emerald-400 shadow-md z-20"
              >
                %{item.achPercent}
              </span>
            )}
          </>
        )}
      </div>

      {/* Caption below poster (only if NOT showTitleOnPoster) */}
      {!viewSettings.showTitleOnPoster && (
        <p
          id={`caption-${item.id}`}
          className="mt-2 text-xs md:text-sm text-slate-300 group-hover:text-white font-medium line-clamp-1 leading-snug px-0.5 transition-colors"
          title={item.title}
        >
          {item.title}
        </p>
      )}
    </div>
  );
};

