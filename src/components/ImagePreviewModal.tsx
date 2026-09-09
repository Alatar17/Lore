import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArchiveItem, Category, GameStatus, ItemCharacter, ViewSettings } from '../types';
import {
  X,
  Pencil,
  Star,
  Calendar,
  Clock,
  Trophy,
  Tv,
  Bookmark,
  BookmarkCheck,
  PauseCircle,
  Building2,
  Clapperboard,
  Users,
  Gamepad2,
  Tags,
  CheckCircle2,
  Play,
  Brain,
  Layers,
} from 'lucide-react';
import { MEDIA_COLORS, GAME_COLORS } from '../data/initialData';
import { FollowBadge, getFollowColor, getFollowModel, RatingBadgeIcon } from './FollowIndicatorIcon';

interface ImagePreviewModalProps {
  item: ArchiveItem;
  categories?: Category[];
  allItems?: ArchiveItem[];
  allCategories?: Category[];
  viewSettings?: ViewSettings;
  onEdit?: (item: ArchiveItem) => void;
  onSelectItem?: (item: ArchiveItem) => void;
  onClose: () => void;
}

function formatReleaseYear(yr?: number | string): string {
  if (!yr) return '';
  const str = String(yr).trim();
  if (str.endsWith('-') || str.endsWith('–') || str.endsWith('—')) {
    const num = str.replace(/[-—–\s]+$/, '');
    return `${num}–`;
  }
  if (str.includes('-') || str.includes('–') || str.includes('—')) {
    const parts = str.split(/[-—–]/).map((p) => p.trim());
    if (parts[0] && parts[1]) return `${parts[0]}–${parts[1]}`;
    if (parts[0]) return `${parts[0]}–`;
  }
  return str;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  item,
  categories = [],
  allItems = [],
  allCategories,
  viewSettings,
  onEdit,
  onSelectItem,
  onClose,
}) => {
  const isGame = item.mainTab === 'game';
  const palette = isGame ? GAME_COLORS : MEDIA_COLORS;
  const baseColor = palette[item.cat] || '#3b82f6';
  const catObj = categories.find((c) => c.id === item.cat);

  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<ItemCharacter | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [isFollowHovered, setIsFollowHovered] = useState(false);
  const [showSeriesPopover, setShowSeriesPopover] = useState(false);
  const [mobilePopoverTop, setMobilePopoverTop] = useState<number>(74);

  const desktopSeriesRef = useRef<HTMLDivElement>(null);
  const mobileSeriesRef = useRef<HTMLDivElement>(null);

  const followModel = getFollowModel(viewSettings?.followIndicatorModel);
  const followColor = getFollowColor(viewSettings?.followIndicatorColor);
  const hasFollowInfo = Boolean(item.expectedDate?.trim() || item.followNotes?.trim());

  // Dynamically position mobile series popover below the trigger icon so it never covers it
  useEffect(() => {
    if (showSeriesPopover && mobileSeriesRef.current) {
      const updateMobilePosition = () => {
        if (mobileSeriesRef.current) {
          const rect = mobileSeriesRef.current.getBoundingClientRect();
          const calculatedTop = Math.max(56, Math.round(rect.bottom + 4));
          setMobilePopoverTop(calculatedTop);
        }
      };

      updateMobilePosition();
      window.addEventListener('resize', updateMobilePosition);
      window.addEventListener('scroll', updateMobilePosition, true);
      return () => {
        window.removeEventListener('resize', updateMobilePosition);
        window.removeEventListener('scroll', updateMobilePosition, true);
      };
    }
  }, [showSeriesPopover]);

  // Close series popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideDesktop = desktopSeriesRef.current?.contains(target);
      const insideMobile = mobileSeriesRef.current?.contains(target);
      if (!insideDesktop && !insideMobile) {
        setShowSeriesPopover(false);
      }
    };
    if (showSeriesPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSeriesPopover]);

  // Reset states when item changes
  useEffect(() => {
    setIsFlipped(false);
    setSelectedCharacter(null);
    setShowAnnouncementModal(false);
    setShowSeriesPopover(false);
  }, [item.id]);

  // Connected series items in the library
  const seriesItems = useMemo(() => {
    const currentSeries = item.seriesName?.trim().toLowerCase();
    if (!currentSeries) return [];

    const matches = (allItems || []).filter(
      (it) => it.seriesName && it.seriesName.trim().toLowerCase() === currentSeries
    );

    return matches.sort((a, b) => {
      if (a.seriesOrder !== undefined && b.seriesOrder !== undefined) {
        return a.seriesOrder - b.seriesOrder;
      }
      if (a.seriesOrder !== undefined) return -1;
      if (b.seriesOrder !== undefined) return 1;

      const yearA = typeof a.releaseYear === 'number' ? a.releaseYear : parseInt(String(a.releaseYear || '0'), 10) || 0;
      const yearB = typeof b.releaseYear === 'number' ? b.releaseYear : parseInt(String(b.releaseYear || '0'), 10) || 0;
      if (yearA !== yearB) return yearA - yearB;
      return a.title.localeCompare(b.title, 'tr');
    });
  }, [item.seriesName, allItems]);

  const hasOtherSeriesItems = seriesItems.length > 1;

  // Close on 'Escape', Open edit on 'Space'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (showAnnouncementModal) {
          setShowAnnouncementModal(false);
        } else if (selectedCharacter) {
          setSelectedCharacter(null);
        } else {
          onClose();
        }
        return;
      }

      // Space key -> Open Edit Modal for this item if not editing an input
      if (e.code === 'Space' || e.key === ' ') {
        const activeElem = document.activeElement;
        const isTyping =
          activeElem &&
          (activeElem.tagName === 'INPUT' ||
            activeElem.tagName === 'TEXTAREA' ||
            (activeElem as HTMLElement).isContentEditable);
        if (!isTyping && onEdit) {
          e.preventDefault();
          e.stopPropagation();
          onEdit(item);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, onEdit, item, selectedCharacter, showAnnouncementModal]);

  // Format watch/completion date as DD.MM.YYYY
  const displayDate = (() => {
    if (!item.date || item.date === '??' || item.date === '??.??' || item.date === 'unknown' || item.date.startsWith('0000')) {
      return '??';
    }
    // Convert YYYY-MM-DD to DD.MM.YYYY
    if (item.date.includes('-')) {
      const parts = item.date.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${day}.${month}.${year}`;
      } else if (parts.length === 2) {
        return `${parts[1].padStart(2, '0')}.${parts[0]}`;
      }
    }
    // If already dot-separated
    if (item.date.includes('.')) {
      const parts = item.date.split('.');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${day}.${month}.${year}`;
      }
    }
    return item.date;
  })();

  const hasCharacters = Boolean(item.characters && item.characters.length > 0);

  // Oyun Durum İkonu (Yazısız Sadece Rozet)
  const renderGameStatusIcon = (status: GameStatus) => {
    switch (status) {
      case 'Tamamlandı':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case '%100 Başarım':
        return <Trophy className="w-3.5 h-3.5 text-amber-400" />;
      case 'Yarım Bırakıldı':
        return <PauseCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'Oynanıyor':
        return <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />;
      case 'Oynanacak':
        return <Bookmark className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />;
      default:
        return <Gamepad2 className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  // Series Connected Popover
  const renderSeriesPopover = (isMobile: boolean) => (
    <div
      id={`series-connected-popover-${isMobile ? 'mobile' : 'desktop'}`}
      style={
        isMobile
          ? {
              top: `${mobilePopoverTop}px`,
              maxHeight: `calc(100vh - ${mobilePopoverTop + 16}px)`,
            }
          : undefined
      }
      className={`z-60 bg-[#141824]/98 border border-indigo-500/50 rounded-2xl shadow-2xl backdrop-blur-xl p-3.5 animate-in fade-in zoom-in-95 duration-150 ${
        isMobile
          ? 'fixed left-3 right-3 max-w-[calc(100vw-24px)] sm:max-w-[360px] mx-auto shadow-indigo-950/50'
          : 'absolute left-0 top-full mt-2.5 w-88 sm:w-[420px]'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white truncate">
              {item.seriesName}
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              {seriesItems.length} Yapım
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSeriesPopover(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          title="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-2 max-h-76 overflow-y-auto custom-scrollbar pr-1">
        {seriesItems.map((sItem) => {
          const isCurrent = sItem.id === item.id;
          const catList = allCategories && allCategories.length > 0 ? allCategories : categories;
          const sCatObj = catList.find((c) => c.id === sItem.cat);
          const sCatName = sCatObj?.name || (sItem.mainTab === 'game' ? 'Oyun' : 'Medya');

          return (
            <div
              key={sItem.id}
              onClick={(e) => {
                e.stopPropagation();
                if (!isCurrent) {
                  setShowSeriesPopover(false);
                  onSelectItem?.(sItem);
                }
              }}
              className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border transition-all ${
                isCurrent
                  ? 'bg-indigo-600/25 border-indigo-400/70 ring-1 ring-indigo-400/50 shadow-md shadow-indigo-950/40 select-none'
                  : 'bg-white/[0.03] hover:bg-white/[0.09] border-white/10 hover:border-indigo-400/50 cursor-pointer group/sitem'
              }`}
            >
              {/* Order Number (Pure Number, no # sign) - Çok az küçültülmüş, dengeli */}
              <div className="flex flex-col items-center justify-center shrink-0 w-5">
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md min-w-[20px] text-center ${
                    isCurrent
                      ? 'bg-indigo-500 text-white shadow'
                      : 'bg-white/10 text-slate-300 group-hover/sitem:bg-indigo-500/80 group-hover/sitem:text-white'
                  }`}
                >
                  {sItem.seriesOrder !== undefined ? sItem.seriesOrder : '—'}
                </span>
              </div>

              {/* Thumbnail Poster (Bigger, comfortable) */}
              <div className="w-12 h-16 rounded-lg overflow-hidden border border-white/15 bg-black/40 shrink-0 flex items-center justify-center shadow">
                {sItem.thumbnail ? (
                  <img
                    src={sItem.thumbnail}
                    alt={sItem.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-slate-500 text-center px-1">
                    {sItem.title.slice(0, 4)}
                  </span>
                )}
              </div>

              {/* Title & Category / Year - Bir tık büyütülmüş başlık ve kategori, ayraç tire (-) */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[13px] sm:text-[15px] font-bold text-slate-100 truncate group-hover/sitem:text-indigo-200 transition-colors">
                    {sItem.title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-200 text-[11px] sm:text-xs font-semibold">
                    {sItem.mainTab === 'game' ? '🎮 ' : '🎬 '}
                    {sCatName}
                    {sItem.sub ? ` - ${sItem.sub}` : ''}
                  </span>
                  {sItem.releaseYear && (
                    <span className="text-slate-400 text-[11px]">
                      {formatReleaseYear(sItem.releaseYear)}
                    </span>
                  )}
                </div>
              </div>

              {/* Star Rating Docked to Far Right - Kibar, orantılı ve tatlı boyut */}
              <div className="shrink-0 pl-1 flex items-center justify-end">
                {sItem.rating > 0 ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 font-bold text-xs shadow-xs">
                    <RatingBadgeIcon type={viewSettings?.ratingIcon || 'star-2'} className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    <span>{sItem.rating}</span>
                  </div>
                ) : (
                  <span className="text-slate-600 text-[11px] px-1.5">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      id="item-detail-preview-overlay"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in duration-200 select-none overflow-y-auto"
    >
      {/* ===================== DESKTOP VIEW (MD and Above: 2-Sütunlu Geniş Panel) ===================== */}
      <div
        id="item-detail-desktop-card"
        onClick={(e) => e.stopPropagation()}
        className="hidden md:flex relative w-full max-w-6xl h-[88vh] max-h-[820px] rounded-2xl overflow-hidden bg-[#10141f] border border-white/15 shadow-2xl shadow-black/90 animate-in zoom-in-95 duration-200"
      >
        {/* Action Buttons Top Right: Edit & Close */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-xl">
          {onEdit && (
            <button
              id="edit-preview-desktop-btn"
              type="button"
              onClick={() => onEdit(item)}
              title="Kartı Düzenle"
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            id="close-preview-desktop-btn"
            onClick={onClose}
            title="Kapat (ESC)"
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sol Sütun: Büyütülmüş Afiş, Rozetler & Afiş Altında Tür ve Yapım Yılı */}
        <div className="w-[380px] lg:w-[430px] xl:w-[450px] shrink-0 h-full bg-black/60 border-r border-white/10 p-5 lg:p-6 flex flex-col justify-start relative overflow-y-auto custom-scrollbar">
          {/* 1. Afişin Konumu ve Boşlukların Giderilmesi: Afiş en tepeye yaslanır, aspect-[2/3], rozetler doğrudan afiş sınırlarına oturur */}
          <div className="w-full aspect-[2/3] max-h-[560px] rounded-xl overflow-hidden border border-white/15 bg-[#12141c] shadow-2xl relative shrink-0">
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
                <span
                  className="text-xl font-bold leading-snug drop-shadow"
                  style={{ color: baseColor }}
                >
                  {item.title}
                </span>
                <span className="text-xs text-slate-400">Görsel bulunmuyor</span>
              </div>
            )}

            {/* ROZET 1 - SOL ÜST: İzlenme / Tamamlama Tarihi (Takvim ikonu kaldırıldı, GG.AA.YYYY formatı) */}
            <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
              <div className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-white/15 text-xs font-semibold text-slate-200 flex items-center shadow-lg">
                <span>{displayDate}</span>
              </div>
            </div>

            {/* ROZET 2 - SAĞ ÜST: Puan (Yıldız + Sayı) */}
            {item.rating > 0 && (
              <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
                <div className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-amber-500/40 text-xs font-black text-amber-300 flex items-center gap-1 shadow-lg">
                  <RatingBadgeIcon
                    type={viewSettings?.ratingIcon}
                    className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0"
                  />
                  <span>{item.rating}</span>
                </div>
              </div>
            )}

            {/* Medya İçin: SOL ALT: Sadece Durum Rozeti (Yazısız Sadece Rozet) */}
            {!isGame && (item.watching || item.following || item.dropped) && (
              <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1.5">
                {item.watching && (
                  <div
                    title="İzleniyor"
                    className="p-1.5 rounded-lg bg-cyan-950/85 backdrop-blur-md border border-cyan-400/40 text-cyan-300 shadow-lg flex items-center justify-center"
                  >
                    <Tv className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                )}
                {item.following && (
                  <div
                    className="relative"
                    onMouseEnter={() => setIsFollowHovered(true)}
                    onMouseLeave={() => setIsFollowHovered(false)}
                  >
                    <FollowBadge
                      id={`preview-badge-following-${item.id}`}
                      hasFollowInfo={hasFollowInfo}
                      model={followModel.id}
                      color={followColor.id}
                      badgeStyle="default"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasFollowInfo) {
                          setShowAnnouncementModal(true);
                        }
                      }}
                    />

                    {/* Hover Tooltip Popup if has follow info */}
                    {hasFollowInfo && isFollowHovered && !showAnnouncementModal && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAnnouncementModal(true);
                        }}
                        className="absolute bottom-full left-0 mb-2 w-64 p-3 rounded-xl bg-[#0f131d] border border-sky-400/40 shadow-2xl text-left z-30 cursor-pointer animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
                        style={{
                          boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(56,189,248,0.2)',
                        }}
                      >
                        <div className="flex items-center gap-1.5 text-sky-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          <span>Takip Gelişmesi</span>
                        </div>
                        {item.expectedDate?.trim() && (
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {item.expectedDate}
                          </div>
                        )}
                        {item.followNotes?.trim() && (
                          <div className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed mt-1">
                            {item.followNotes}
                          </div>
                        )}
                        <span className="block text-[9px] text-sky-400/90 font-medium mt-1.5">
                          Tümünü görmek için tıkla
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {item.dropped && (
                  <div
                    title="Bırakıldı"
                    className="p-1.5 rounded-lg bg-rose-950/85 backdrop-blur-md border border-rose-400/40 text-rose-300 shadow-lg flex items-center justify-center"
                  >
                    <PauseCircle className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                )}
              </div>
            )}

            {/* Oyun İçin: SOL ALT: Oynama Süresi + Yanında Durum Rozeti (Yazısız Sadece Rozet) */}
            {isGame && ((item.hours !== undefined && item.hours > 0) || item.status) && (
              <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1.5 pointer-events-none">
                {item.hours !== undefined && item.hours > 0 && (
                  <div className="px-2 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-slate-200 flex items-center gap-1 shadow-lg">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{item.hours}s</span>
                  </div>
                )}
                {item.status && (
                  <div
                    title={item.status}
                    className="p-1.5 rounded-lg bg-black/85 backdrop-blur-md border border-white/15 shadow-lg flex items-center justify-center"
                  >
                    {renderGameStatusIcon(item.status)}
                  </div>
                )}
              </div>
            )}

            {/* PC: SAĞ ALT: Anki İkonu (Solda) ve Oyun Başarım Yüzdesi (Sağda) - Eşit Yükseklik ve Dikey Uyum */}
            <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1.5 pointer-events-none">
              {Boolean(item.anki) && (
                <div
                  title="Anki Destesine Eklendi"
                  className="h-6 w-6 rounded-lg bg-emerald-950/85 backdrop-blur-md border border-emerald-400/40 text-emerald-300 shadow-lg flex items-center justify-center"
                >
                  <Brain className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              )}
              {isGame && item.achPercent !== null && item.achPercent !== undefined && item.achPercent > 0 && (
                <div className="h-6 px-2 rounded-lg bg-emerald-950/85 backdrop-blur-md border border-emerald-400/40 text-[11px] font-bold text-emerald-300 flex items-center justify-center shadow-lg">
                  <span>%{item.achPercent}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Afişin Altındaki Alana Bilgilerin Taşınması */}
          {/* Ana Kategori (Dizi, Film, Anime, Oyun vb.) ve Yapım Yılı: Afişin hemen altında şık bir satırda yer alacak */}
          <div className="w-full mt-3 pt-1 flex items-center justify-between gap-2 px-0.5 shrink-0">
            {/* İçerik Türü (Sadece Main Kategori: Dizi, Film, Anime, Oyun vs.) */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <span
                className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0"
                style={{ backgroundColor: baseColor }}
              />
              <span className="tracking-wide">
                {catObj?.name || (isGame ? 'Oyun' : 'Medya')}
              </span>
            </div>

            {/* Yapım Yılı (Verilmemişse kesinlikle gösterilmez) */}
            {item.releaseYear ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10 text-xs font-medium text-slate-200 shrink-0">
                <Calendar className="w-3 h-3 text-neutral-400" />
                <span className="text-slate-400 text-[11px]">Yapım:</span>
                <span className="font-bold text-slate-100">{formatReleaseYear(item.releaseYear)}</span>
              </div>
            ) : null}
          </div>

          {/* Anime / Kategori ve Yapım Yılı ile Türler arasına ayırıcı çizgi */}
          <div className="w-full border-t border-white/10 my-3 shrink-0" />

          {/* Tür Etiketleri (Aksiyon, Macera vb.): Sağ taraftaki kalabalıktan alınıp sol sütunda, afişin hemen altındaki bu ferah alana taşındı */}
          {item.genre && item.genre.length > 0 && (
            <div className="w-full space-y-1.5 px-0.5 shrink-0">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                <Tags className="w-3 h-3 text-emerald-400" /> Türler
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                {item.genre.map((g) => (
                  <span
                    key={g}
                    className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-slate-300 text-xs font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Sağ Tarafın Sadeleştirilmesi ve Temizlenmesi */}
        {/* Alt Kategori kutusu tamamen kaldırıldı. Sağ taraf yalnızca: Başlık, Stüdyo/Yönetmen, KONUSU ve Karakterler */}
        <div className="flex-1 h-full p-6 lg:p-7 flex flex-col overflow-y-auto custom-scrollbar space-y-4">
          {/* Başlık (En tepede dev ve net) */}
          <div className="pr-12 flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-tight">
              {item.title}
            </h2>

            {/* Bağlantılı Yapımlar İkonu (PC - Başlığın Sağında) */}
            {hasOtherSeriesItems && (
              <div className="relative inline-flex items-center" ref={desktopSeriesRef}>
                <button
                  type="button"
                  id="series-connected-icon-desktop-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSeriesPopover(!showSeriesPopover);
                  }}
                  className="relative p-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-500/50 hover:border-indigo-400 text-indigo-300 hover:text-white transition-all cursor-pointer group animate-series-icon-pop flex items-center justify-center shrink-0 shadow-lg"
                  title={`${item.seriesName} Serisi (${seriesItems.length} Yapım) - İlişkili yapımları görüntüle`}
                  aria-label="Bağlantılı Yapımlar"
                >
                  <Layers className="w-5 h-5 text-indigo-400 group-hover:text-indigo-200" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white shadow ring-1 ring-black/50">
                    {seriesItems.length}
                  </span>
                </button>

                {showSeriesPopover && renderSeriesPopover(false)}
              </div>
            )}
          </div>

          {/* Stüdyo / Firma / Geliştirici & Yönetmen Rozetleri (İki satır halinde, etiketli) */}
          {((!isGame && ((item.firm && item.firm.length > 0) || (item.director && item.director.length > 0))) ||
            (isGame && item.developer && item.developer.length > 0)) && (
            <div className="flex flex-col gap-1.5 pt-0.5">
              {/* 1. Satır: Firma (Medya) */}
              {!isGame && item.firm && item.firm.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 font-semibold shrink-0">Firma:</span>
                  <div className="px-2.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center gap-1.5 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>{item.firm.join(', ')}</span>
                  </div>
                </div>
              )}

              {/* 2. Satır: Yönetmen (Medya) */}
              {!isGame && item.director && item.director.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 font-semibold shrink-0">Yönetmen:</span>
                  <div className="px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-1.5 font-medium">
                    <Clapperboard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{item.director.join(', ')}</span>
                  </div>
                </div>
              )}

              {/* Tek Satır: Geliştirici (Oyun) */}
              {isGame && item.developer && item.developer.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 font-semibold shrink-0">Geliştirici:</span>
                  <div className="px-2.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center gap-1.5 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>{item.developer.join(', ')}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Yönetmen ve Konusu Arasına İnce ve Temiz Ayırıcı Çizgi */}
          <div className="w-full border-t border-white/10 my-0.5 shrink-0" />

          {/* KONUSU */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="block text-[11px] uppercase font-bold tracking-wider text-slate-400">
                KONUSU
              </span>
            </div>
            {item.desc?.trim() ? (
              <div
                id="preview-desc-box"
                className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap bg-white/[0.03] p-3.5 rounded-xl border border-white/10 min-h-[90px] max-h-[480px] overflow-y-auto resize-y custom-scrollbar"
                style={{ resize: 'vertical' }}
              >
                {item.desc}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic bg-white/[0.02] p-3 rounded-xl border border-white/5">
                Herhangi bir konu veya açıklama girilmemiş.
              </p>
            )}
          </div>

          {/* Ayraç */}
          <div className="border-t border-white/10 my-1" />

          {/* 4. Karakterler & Kadro: Karakter Kartlarına Tıklayınca Lightbox Açılır */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <span className="text-xs uppercase font-bold tracking-wider text-slate-200">
                Karakterler & Kadro
              </span>
              {hasCharacters && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold">
                  {item.characters?.length}
                </span>
              )}
            </div>

            {hasCharacters ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {item.characters?.map((c, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedCharacter(c)}
                    className="p-2 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-2.5 hover:bg-white/[0.07] hover:border-white/20 transition-all cursor-pointer group"
                    title="Karakter detayını görüntüle"
                  >
                    {/* Karakter Görseli */}
                    {c.image ? (
                      <div className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden">
                        <img
                          src={c.image}
                          alt={c.name}
                          className="w-10 h-10 rounded-lg object-cover border border-white/15 bg-black/40 transition-transform duration-200 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center text-slate-500 shrink-0">
                        <Users className="w-4 h-4 text-slate-500" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <span className="text-xs font-bold text-slate-100 group-hover:text-white truncate">
                        {c.name}
                      </span>
                      {c.actor && (
                        <span className="text-[11px] text-sky-300 truncate flex items-center gap-1 mt-0.5">
                          <span className="text-[10px]">🎙️</span>
                          <span>{c.actor}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-1">
                Henüz bir karakter veya seslendirmen bilgisi eklenmemiş.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ===================== MOBILE VIEW (3D Flip Kart Deneyimi) ===================== */}
      <div
        id="item-detail-mobile-container"
        onClick={(e) => e.stopPropagation()}
        className="block md:hidden relative w-full max-w-[340px] h-[540px] mx-auto select-none"
      >
        {/* Floating Action Buttons at top-right (Series button to the left of X) */}
        <div className="absolute -top-11 right-0 z-40 flex items-center gap-2">
          {hasOtherSeriesItems && (
            <div className="relative flex items-center" ref={mobileSeriesRef}>
              <button
                type="button"
                id="series-connected-icon-mobile-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showSeriesPopover && mobileSeriesRef.current) {
                    const rect = mobileSeriesRef.current.getBoundingClientRect();
                    setMobilePopoverTop(Math.max(56, Math.round(rect.bottom + 4)));
                  }
                  setShowSeriesPopover(!showSeriesPopover);
                }}
                className="relative p-2 rounded-full bg-black/70 hover:bg-indigo-600/30 border border-indigo-500/50 hover:border-indigo-400 text-indigo-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shadow-lg animate-series-icon-pop"
                title={`${item.seriesName} Serisi (${seriesItems.length} Yapım)`}
                aria-label="Bağlantılı Yapımlar"
              >
                <Layers className="w-4 h-4 text-indigo-400" />
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white shadow ring-1 ring-black/50">
                  {seriesItems.length}
                </span>
              </button>

              {showSeriesPopover && renderSeriesPopover(true)}
            </div>
          )}

          <div className="flex items-center bg-black/60 backdrop-blur-md border border-white/15 rounded-full p-1 shadow-lg">
            <button
              id="close-preview-mobile-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Kapat"
              className="relative p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center before:absolute before:-inset-3 before:content-['']"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3D Flippable Card Core */}
        <div
          id="item-mobile-flip-card"
          onClick={() => setIsFlipped(!isFlipped)}
          style={{
            transformStyle: 'preserve-3d',
            WebkitTransformStyle: 'preserve-3d',
            transform: isFlipped ? 'perspective(1200px) rotateY(180deg)' : 'perspective(1200px) rotateY(0deg)',
            transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
            willChange: 'transform',
          }}
          className="relative w-full h-full cursor-pointer select-none"
        >
          {/* FRONT FACE */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg) translateZ(1px)',
              WebkitTransform: 'rotateY(0deg) translateZ(1px)',
              pointerEvents: isFlipped ? 'none' : 'auto',
            }}
            className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden bg-[#10141f] border border-white/20 shadow-2xl shadow-black flex flex-col justify-between"
          >
            {/* Poster Background */}
            <div className="absolute inset-0 z-0">
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                  <span
                    className="text-xl font-bold leading-snug drop-shadow"
                    style={{ color: baseColor }}
                  >
                    {item.title}
                  </span>
                  <span className="text-xs text-slate-400 mt-2">Görsel Yok</span>
                </div>
              )}
              {/* Çok hafif, posteri karartmayan doğal dokunuş (Vinyet yumuşatıldı) */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/25 pointer-events-none" />
            </div>

            {/* Front Top Badges */}
            <div className="relative z-10 p-3.5 flex items-start justify-between gap-2">
              {/* Sol Üst: Dikey Hizada Tarih, Durum İkonu ve Varsa Anki Rozeti (Durum ikonuyla birebir aynı boyutta) */}
              <div className="flex flex-col items-start gap-1.5">
                {/* 1. İzlenme Tarihi */}
                <span className="px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 text-[11px] font-semibold text-slate-200 shadow">
                  {displayDate}
                </span>

                {/* 2. Durum İkonu (Medya İçin) */}
                {!isGame && (item.watching || item.following || item.dropped) && (
                  <div className="flex items-center gap-1">
                    {item.watching && (
                      <div
                        title="İzleniyor"
                        className="w-6 h-6 rounded-lg bg-cyan-950/85 backdrop-blur-md border border-cyan-400/40 text-cyan-300 shadow flex items-center justify-center"
                      >
                        <Tv className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                    )}
                    {item.following && (
                      <div
                        className="w-6 h-6 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 shadow flex items-center justify-center cursor-pointer"
                        onClick={(e) => {
                          if (hasFollowInfo) {
                            e.stopPropagation();
                            setShowAnnouncementModal(true);
                          }
                        }}
                      >
                        <FollowBadge
                          id={`mobile-preview-badge-following-${item.id}`}
                          hasFollowInfo={hasFollowInfo}
                          model={followModel.id}
                          color={followColor.id}
                          badgeStyle="default"
                        />
                      </div>
                    )}
                    {item.dropped && (
                      <div
                        title="Bırakıldı"
                        className="w-6 h-6 rounded-lg bg-rose-950/85 backdrop-blur-md border border-rose-400/40 text-rose-300 shadow flex items-center justify-center"
                      >
                        <PauseCircle className="w-3.5 h-3.5 text-rose-400" />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Durum İkonu (Oyun İçin) */}
                {isGame && item.status && (
                  <div
                    title={item.status}
                    className="w-6 h-6 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 shadow flex items-center justify-center"
                  >
                    {renderGameStatusIcon(item.status)}
                  </div>
                )}

                {/* 3. Anki İkonu (Varsa, Durum İkonuyla Birebir Aynı Boyutta: w-6 h-6) */}
                {Boolean(item.anki) && (
                  <div
                    title="Anki Destesine Eklendi"
                    className="w-6 h-6 rounded-lg bg-emerald-950/85 backdrop-blur-md border border-emerald-400/40 text-emerald-300 shadow flex items-center justify-center"
                  >
                    <Brain className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                )}
              </div>

              {/* Sağ Üst: Sadece Rating */}
              <div className="flex flex-col items-end gap-1.5">
                {item.rating > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-amber-500/50 text-xs font-black text-amber-300 flex items-center gap-1 shadow">
                    <RatingBadgeIcon
                      type={viewSettings?.ratingIcon}
                      className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0"
                    />
                    {item.rating}
                  </span>
                )}
              </div>
            </div>

            {/* Alt Kısım: Kartın Adı (Ortalanmış ve Daha Büyük) ve Oyun İçin Sol-Alt Saat / Sağ-Alt Başarım */}
            <div className="relative z-20 mt-auto w-full pt-12 pb-3.5 px-3.5 bg-gradient-to-t from-black/95 via-black/65 to-transparent rounded-b-2xl pointer-events-none flex flex-col items-center">
              {/* Kart Başlığı: Ortalanmış ve Daha Büyük */}
              <h3
                className={`text-lg sm:text-xl font-extrabold text-white leading-snug drop-shadow-lg line-clamp-2 text-center w-full px-2 ${
                  isGame && ((item.hours !== undefined && item.hours > 0) || (item.achPercent !== null && item.achPercent !== undefined && item.achPercent > 0))
                    ? 'mb-3'
                    : ''
                }`}
              >
                {item.title}
              </h3>

              {/* Oyun Kartları İçin: Sol Altta Oynama Saati, Sağ Altta Başarım Yüzdesi */}
              {isGame && ((item.hours !== undefined && item.hours > 0) || (item.achPercent !== null && item.achPercent !== undefined && item.achPercent > 0)) && (
                <div className="w-full flex items-center justify-between pointer-events-auto">
                  {/* Sol Alt: Oynama Süresi */}
                  {item.hours !== undefined && item.hours > 0 ? (
                    <div className="px-2 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 text-[11px] font-semibold text-slate-200 flex items-center gap-1 shadow">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{item.hours}s</span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Sağ Alt: Başarım Yüzdesi (Kupasız, yeşil sade rozet) */}
                  {item.achPercent !== null && item.achPercent !== undefined && item.achPercent > 0 ? (
                    <div className="px-2 py-1 rounded-lg bg-emerald-950/85 backdrop-blur-md border border-emerald-400/40 text-[11px] font-bold text-emerald-300 shadow">
                      <span>%{item.achPercent}</span>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* BACK FACE */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg) translateZ(1px)',
              WebkitTransform: 'rotateY(180deg) translateZ(1px)',
              pointerEvents: isFlipped ? 'auto' : 'none',
            }}
            className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden bg-[#10141f] border border-white/20 shadow-2xl shadow-black flex flex-col p-4 justify-between"
          >
            {/* Header info */}
            <div className="border-b border-white/10 pb-2.5 shrink-0">
              {/* Üst Satır: Kart Adı (Sola Yaslı) & Minimal Yapım Yılı Rozeti (Sağa Yaslı) */}
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-base font-bold text-white leading-snug line-clamp-2 text-left flex-1 min-w-0">
                  {item.title}
                </h4>

                {/* Zarif, minimal ve ince Yapım Yılı Rozeti */}
                {item.releaseYear ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[11px] font-medium text-slate-200 shrink-0 shadow-xs">
                    <Calendar className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                    <span className="text-slate-400 text-[10px]">Yapım:</span>
                    <span className="font-semibold text-slate-100 text-[11px]">{formatReleaseYear(item.releaseYear)}</span>
                  </div>
                ) : null}
              </div>

              {/* Başlık altında Medya için Firma ve Yönetmen (2 Ayrı Satır), Oyun için Geliştirici (Tek Satır) */}
              {((!isGame && ((item.firm && item.firm.length > 0) || (item.director && item.director.length > 0))) ||
                (isGame && item.developer && item.developer.length > 0)) && (
                <div className="flex flex-col gap-1.5 mt-2">
                  {/* Satır 1: Firma (Medya) */}
                  {!isGame && item.firm && item.firm.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400 font-semibold shrink-0 text-[10px]">Firma:</span>
                      <div className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center gap-1 font-medium text-[10px]">
                        <Building2 className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{item.firm.join(', ')}</span>
                      </div>
                    </div>
                  )}

                  {/* Satır 2: Yönetmen (Medya) */}
                  {!isGame && item.director && item.director.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400 font-semibold shrink-0 text-[10px]">Yönetmen:</span>
                      <div className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-1 font-medium text-[10px]">
                        <Clapperboard className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{item.director.join(', ')}</span>
                      </div>
                    </div>
                  )}

                  {/* Tek Satır: Geliştirici (Oyun) */}
                  {isGame && item.developer && item.developer.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400 font-semibold shrink-0 text-[10px]">Geliştirici:</span>
                      <div className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center gap-1 font-medium text-[10px]">
                        <Building2 className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{item.developer.join(', ')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Scrollable Center: Desc + Characters (Boşluğa veya metne dokunulunca kart ön yüze döner) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar my-2.5 space-y-3 pr-1 text-left">
              {/* Konu */}
              <div>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                  KONUSU
                </span>
                <p className="text-xs text-slate-200 leading-relaxed bg-white/[0.03] p-2.5 rounded-xl border border-white/5 whitespace-pre-wrap">
                  {item.desc?.trim() || 'Açıklama bulunmuyor.'}
                </p>
              </div>

              {/* Karakterler */}
              <div>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3 text-sky-400" /> Karakterler & Kadro
                </span>
                {hasCharacters ? (
                  <div className="space-y-1.5">
                    {item.characters?.map((c, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-white/[0.04] border border-white/10 flex items-center gap-2 text-xs transition-colors cursor-pointer"
                      >
                        {/* YALNIZCA RESME TIKLANIRSA: Lightbox açılır ve kart KESİNLİKLE DÖNMEZ (e.stopPropagation) */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCharacter(c);
                          }}
                          className="shrink-0 cursor-pointer active:scale-95 transition-transform"
                          title="Büyük resmi aç"
                        >
                          {c.image ? (
                            <img
                              src={c.image}
                              alt={c.name}
                              className="w-8 h-8 rounded-md object-cover border border-white/20 bg-black/40 hover:border-sky-400/50"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-md border border-white/10 bg-white/[0.04] flex items-center justify-center">
                              <Users className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                        </div>

                        {/* İSİM VE SESLENDİRMEN METNİNE TIKLANIRSA: Kart ön yüze döner (flip) */}
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
                          <span className="font-bold text-slate-200 truncate">
                            {c.name}
                          </span>
                          {c.actor && (
                            <span className="text-[10px] text-sky-300 font-medium bg-sky-500/20 px-1.5 py-0.5 rounded shrink-0">
                              🎙️ {c.actor}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    Karakter eklenmemiş.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== KARAKTER DETAY LIGHTBOX (Sinematik Açılır Pencere) ===================== */}
      {selectedCharacter && (
        <div
          id="character-lightbox-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCharacter(null);
          }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            id="character-lightbox-card"
            onClick={(e) => e.stopPropagation()}
            className="relative w-auto max-w-lg max-h-[90vh] rounded-2xl bg-[#111420] border border-white/20 shadow-2xl p-5 sm:p-6 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-200 overflow-hidden"
          >
            <button
              id="close-character-lightbox-btn"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCharacter(null);
              }}
              className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/70 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer border border-white/10"
              title="Kapat (ESC)"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Karakter Görseli (Orijinal En/Boy Oranında Gösterilir, Kırpma Yok) */}
            <div className="max-w-full max-h-[64vh] rounded-xl overflow-hidden border border-white/15 bg-black/60 shadow-2xl flex items-center justify-center relative p-0.5">
              {selectedCharacter.image ? (
                <img
                  src={selectedCharacter.image}
                  alt={selectedCharacter.name}
                  className="max-w-full max-h-[62vh] w-auto h-auto object-contain rounded-lg"
                />
              ) : (
                <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-500 gap-2 p-4">
                  <Users className="w-12 h-12 text-slate-500 stroke-[1.5]" />
                  <span className="text-xs text-slate-400">Görsel bulunmuyor</span>
                </div>
              )}
            </div>

            {/* Karakter Bilgileri */}
            <div className="space-y-1.5 w-full">
              <h3 className="text-xl font-black text-white tracking-wide leading-tight">
                {selectedCharacter.name}
              </h3>
              {selectedCharacter.actor && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-semibold shadow-sm">
                  <span>🎙️</span>
                  <span>{selectedCharacter.actor}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== ANNOUNCEMENT / FOLLOW DETAILS DIALOG ===================== */}
      {showAnnouncementModal && typeof document !== 'undefined' && createPortal(
        <div
          id={`preview-announcement-backdrop-${item.id}`}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setShowAnnouncementModal(false);
          }}
        >
          <div
            id={`preview-announcement-modal-${item.id}`}
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
                      backgroundColor: `${followColor.hex}18`,
                      borderColor: `${followColor.hex}35`,
                      color: followColor.hex,
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
                id={`btn-close-preview-announcement-${item.id}`}
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
