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
  const baseColor = palette[item.cat] || '#334155';

  return (
    <div
      id={`card-${item.id}`}
      onClick={onClick}
      className="group cursor-pointer flex flex-col transition-all duration-200 hover:-translate-y-1 select-none"
    >
      {/* Poster */}
      <div
        className="relative w-full aspect-[2/3] rounded-lg overflow-hidden border transition-all duration-200 group-hover:shadow-lg group-hover:border-[#525b70]"
        style={{
          backgroundColor: item.thumbnail ? '#171920' : `${baseColor}24`,
          borderColor: item.thumbnail ? '#2a2f3d' : `${baseColor}55`,
        }}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 text-center">
            {(!viewSettings.showTitleOnPoster || item.thumbnail) && (
              <span
                className="text-xs font-semibold tracking-wide text-gray-200 line-clamp-3 leading-tight opacity-90 drop-shadow"
                style={{ color: `${baseColor}ee` }}
              >
                {item.title}
              </span>
            )}
          </div>
        )}

        {/* Title on poster overlay when enabled */}
        {viewSettings.showTitleOnPoster && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-end p-2.5">
            <span className="text-xs font-semibold text-white line-clamp-2 leading-tight drop-shadow-md">
              {item.title}
            </span>
          </div>
        )}

        {/* Rating Badge (Top Right) */}
        {viewSettings.showRating && item.rating > 0 && (
          <div
            id={`badge-rating-${item.id}`}
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs border border-white/10 text-[11px] font-bold text-amber-400 flex items-center gap-0.5 shadow"
          >
            <span>★</span>
            <span>{item.rating}</span>
          </div>
        )}

        {/* Media Badges (Bottom Left: Watching ▶ / Following ★) */}
        {!isGame && (item.watching || item.following) && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 z-10">
            {item.watching && (
              <span
                id={`badge-watching-${item.id}`}
                title="Şu an izleniyor"
                className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs border border-cyan-500/40 text-[10px] font-bold text-cyan-400 shadow"
              >
                ▶
              </span>
            )}
            {item.following && (
              <span
                id={`badge-following-${item.id}`}
                title="Takip listesinde"
                className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs border border-amber-500/40 text-[10px] font-bold text-amber-400 shadow"
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
                className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs border border-sky-500/30 text-[10px] font-semibold text-sky-400 shadow"
              >
                {item.hours}s
              </span>
            )}

            {/* Achievement % (Bottom Right) */}
            {item.achPercent !== null && item.achPercent !== undefined && (
              <span
                id={`badge-ach-${item.id}`}
                title="Başarım tamamlanma"
                className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs border border-emerald-500/30 text-[10px] font-semibold text-emerald-400 shadow"
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
          className="mt-1.5 text-xs text-gray-300 group-hover:text-white font-medium line-clamp-1 leading-snug px-0.5"
          title={item.title}
        >
          {item.title}
        </p>
      )}
    </div>
  );
};
