import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Rating, State, type Card } from 'ts-fsrs';
import { ArchiveItem, Category, AnkiBlurBox } from '../types';
import {
  ensureAnkiCardDates,
  initAnkiCard,
  getRepeatOptions,
  AnkiRepeatOption,
  calculateAnkiCounts,
  getAnkiFrontBadges,
} from '../utils/ankiUtils';
import { MEDIA_COLORS, GAME_COLORS, BOOK_COLORS } from '../data/initialData';
import {
  X,
  RotateCcw,
  Sparkles,
  Trophy,
  Calendar,
  Users,
  Building2,
  Clapperboard,
  PenTool,
  Brain,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  HelpCircle,
  Clock,
  Layers,
  Quote,
  Globe,
} from 'lucide-react';

interface AnkiStudyModalProps {
  isOpen: boolean;
  deckTitle: string;
  initialQueue: ArchiveItem[];
  virtualTimeOffsetMs: number;
  categories?: {
    media: Category[];
    game: Category[];
    book: Category[];
  };
  onSaveSession?: (updatedItems: ArchiveItem[]) => void;
  onUpdateItem?: (updatedItem: ArchiveItem) => void;
  onClose: (pendingSessionItems?: ArchiveItem[]) => void;
}

export const AnkiStudyModal: React.FC<AnkiStudyModalProps> = ({
  isOpen,
  deckTitle,
  initialQueue,
  virtualTimeOffsetMs,
  categories,
  onSaveSession,
  onUpdateItem,
  onClose,
}) => {
  // In-session accumulator: all ratings are batched in pure memory (0ms latency, zero GC churn, zero I/O lock)
  const sessionUpdatesRef = useRef<Map<string, ArchiveItem>>(new Map());
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Exact current now helper: always returns the true current time + virtual offset
  const getExactNow = useCallback(() => {
    return new Date(Date.now() + virtualTimeOffsetMs);
  }, [virtualTimeOffsetMs]);

  // Dynamically ticking virtual now for countdown previews and counters (updates every 10s or on user interaction)
  const [currentVirtualNow, setCurrentVirtualNow] = useState<Date>(() => getExactNow());

  useEffect(() => {
    setCurrentVirtualNow(getExactNow());
    const ticker = setInterval(() => {
      setCurrentVirtualNow(getExactNow());
    }, 10000);
    return () => clearInterval(ticker);
  }, [getExactNow]);

  const flushSession = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (sessionUpdatesRef.current.size > 0) {
      const itemsToSave = Array.from(sessionUpdatesRef.current.values());
      if (onSaveSession) {
        onSaveSession(itemsToSave);
      } else if (onUpdateItem) {
        itemsToSave.forEach((it) => onUpdateItem(it));
      }
      sessionUpdatesRef.current.clear();
    }
  }, [onSaveSession, onUpdateItem]);

  const handleSafeClose = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pendingItems = Array.from(sessionUpdatesRef.current.values());
    sessionUpdatesRef.current.clear();
    onClose(pendingItems);
  }, [onClose]);

  // Flush on unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const pendingItems = Array.from(sessionUpdatesRef.current.values());
      if (pendingItems.length > 0 && onSaveSession) {
        onSaveSession(pendingItems);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushSession();
    };
  }, [flushSession, onSaveSession]);
  // Current active virtual now (dynamically ticking)
  const virtualNow = currentVirtualNow;

  // Session queue state
  const [queue, setQueue] = useState<ArchiveItem[]>([]);
  // Completed count in this session
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [againCount, setAgainCount] = useState<number>(0);
  // Total cards at session start
  const [initialTotalCount, setInitialTotalCount] = useState<number>(0);
  // Turn counter to guarantee clean card reset even when a single card repeats
  const [cardTurn, setCardTurn] = useState<number>(0);

  // Card view state:
  // isAnswerShown: false = Phase 1 (Question/Blur), true = Phase 2 (Answer revealed)
  const [isAnswerShown, setIsAnswerShown] = useState<boolean>(false);
  // isFlipped: 3D Flip state to view the rich metadata back face
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  // Active image index for multi-image gallery: 0 = Main thumbnail, 1..N = Extra scene images
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Initialize or re-initialize session queue
  useEffect(() => {
    if (isOpen) {
      setQueue([...initialQueue]);
      setInitialTotalCount(initialQueue.length);
      setCompletedCount(0);
      setAgainCount(0);
      setCardTurn(0);
      setIsAnswerShown(false);
      setIsFlipped(false);
      setActiveImageIndex(0);
    }
  }, [isOpen, initialQueue]);

  // Current active card item
  const currentItem = queue[0] || null;

  // Reset card state when moving to next card or repeating the same card
  useEffect(() => {
    setIsAnswerShown(false);
    setIsFlipped(false);
    setActiveImageIndex(0);
  }, [currentItem?.id, cardTurn]);

  // Compute repeat options dynamically with ts-fsrs for the current card
  const repeatOptions: AnkiRepeatOption[] = useMemo(() => {
    if (!currentItem) return [];
    const card = ensureAnkiCardDates(currentItem.ankiCard) || initAnkiCard(virtualNow);
    return getRepeatOptions(card, virtualNow);
  }, [currentItem, virtualNow]);

  // Overall counts for current queue in Anki format (New + Learning + Review)
  const deckCounts = useMemo(() => {
    return calculateAnkiCounts(queue, virtualNow);
  }, [queue, virtualNow]);

  // Breadcrumb segments derivation
  const breadcrumbSegments = useMemo(() => {
    const getMainTabLabel = (tab?: string) => {
      if (tab === 'game') return 'Oyun';
      if (tab === 'book') return 'Kitap';
      return 'Medya';
    };

    const getCategoryLabel = (item: ArchiveItem) => {
      if (!categories) return item.cat;
      const catList = categories[item.mainTab] || [];
      const found = catList.find((c) => c.id === item.cat);
      return found?.name || item.cat;
    };

    // If explicit hierarchical path was passed (e.g. "Medya > Anime" or "Medya > Anime > Shounen")
    if (deckTitle.includes('>')) {
      return deckTitle.split('>').map((s) => s.trim());
    }

    // If studying "Tümü": dynamically show [Tümü, Medya, Kategori, (Alt)]
    if (deckTitle === 'Tümü' || deckTitle.startsWith('Tümü')) {
      if (!currentItem) return ['Tümü'];
      const parts = ['Tümü', getMainTabLabel(currentItem.mainTab), getCategoryLabel(currentItem)];
      if (currentItem.sub && currentItem.sub.trim() !== '') {
        parts.push(currentItem.sub.trim());
      }
      return parts;
    }

    // If a single top-level deck was chosen like "Medya", "Oyun", "Kitap": dynamically show [Deste, Kategori, (Alt)]
    if (currentItem) {
      const parts = [deckTitle, getCategoryLabel(currentItem)];
      if (currentItem.sub && currentItem.sub.trim() !== '') {
        parts.push(currentItem.sub.trim());
      }
      return parts;
    }

    return [deckTitle];
  }, [deckTitle, currentItem, categories]);

  // Gallery images for current item:
  // Image 0: thumbnail + ankiMainBlurs
  // Image 1..N: ankiExtraImages[i].url + ankiExtraImages[i].blurs
  const galleryImages = useMemo(() => {
    if (!currentItem) return [];
    const list: { url?: string; blurs: AnkiBlurBox[]; label: string }[] = [];

    // Main thumbnail
    list.push({
      url: currentItem.thumbnail,
      blurs: currentItem.ankiMainBlurs || [],
      label: 'Ana Afiş',
    });

    // Extra images
    if (currentItem.ankiExtraImages && currentItem.ankiExtraImages.length > 0) {
      currentItem.ankiExtraImages.forEach((extra, idx) => {
        list.push({
          url: extra.url,
          blurs: extra.blurs || [],
          label: `${idx + 2}. Sahne / İpucu`,
        });
      });
    }

    return list;
  }, [currentItem]);

  // Keyboard navigation for multi-image cards (Left / Right arrow keys)
  useEffect(() => {
    if (!isOpen || galleryImages.length <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveImageIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveImageIndex((prev) => Math.min(galleryImages.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, galleryImages.length]);

  const activeImage = galleryImages[activeImageIndex] || galleryImages[0];

  // Helper colors
  const isGame = currentItem?.mainTab === 'game';
  const isBook = currentItem?.mainTab === 'book';
  const palette = isGame ? GAME_COLORS : isBook ? BOOK_COLORS : MEDIA_COLORS;
  const baseColor = currentItem ? palette[currentItem.cat] || '#3b82f6' : '#3b82f6';

  // Handle rating button click
  const handleRate = (option: AnkiRepeatOption) => {
    if (!currentItem) return;

    // 1. Calculate updated card with the exact current timestamp
    const exactNow = getExactNow();
    setCurrentVirtualNow(exactNow);

    const card = ensureAnkiCardDates(currentItem.ankiCard) || initAnkiCard(exactNow);
    const freshOptions = getRepeatOptions(card, exactNow);
    const selected = freshOptions.find((o) => o.rating === option.rating) || option;

    const updatedCard: Card = selected.nextCard;
    const updatedItem: ArchiveItem = {
      ...currentItem,
      ankiCard: updatedCard,
      updatedAt: Date.now(),
    };

    // Store in session memory (0ms lag, no storage congestion)
    sessionUpdatesRef.current.set(updatedItem.id, updatedItem);

    // Reset view states immediately to prevent stale frame or desync
    setIsAnswerShown(false);
    setIsFlipped(false);
    setActiveImageIndex(0);
    setCardTurn((t) => t + 1);

    // 2. Queue management (Pure Anki learning step logic)
    // Only cards that have officially graduated to Review (State.Review) leave the study session.
    // Cards still in learning or relearning (State.Learning / State.Relearning: Again, Hard, or 1st Good)
    // repeat at the end of the current session queue until mastered.
    if (updatedCard.state === State.Review) {
      // Card has graduated or completed review!
      setCompletedCount((prev) => prev + 1);
      setQueue((prev) => {
        const nextQueue = prev.slice(1);
        if (nextQueue.length === 0) {
          // Deck finished! Flush session immediately
          setTimeout(() => flushSession(), 50);
        }
        return nextQueue;
      });
    } else {
      // Card is still in State.Learning or State.Relearning (Again, Hard, or 1st Good)
      // Push to the end of the session queue to repeat until mastered
      if (option.rating === Rating.Again) {
        setAgainCount((prev) => prev + 1);
      }
      setQueue((prev) => {
        const remaining = prev.slice(1);
        return [...remaining, updatedItem];
      });
    }

    // Schedule background flush after 2.5s of idle time (does not interrupt active answering)
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      flushSession();
    }, 2500);
  };

  // Safe release year formatting
  const formattedYear = useMemo(() => {
    if (!currentItem?.releaseYear) return '';
    return String(currentItem.releaseYear);
  }, [currentItem?.releaseYear]);

  // Front face badges (item.ankiFrontTags or Otomatik Akıl)
  const frontBadges = useMemo(() => {
    if (!currentItem) return [];
    return getAnkiFrontBadges(currentItem);
  }, [currentItem]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        // Prevent accidental closing when clicking outside
        e.stopPropagation();
      }}
    >
      <div
        className="relative w-full max-w-md bg-neutral-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3 bg-neutral-950/80 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-1.5 text-xs select-none min-w-0 flex-1 overflow-hidden">
            {breadcrumbSegments.map((segment, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <span className="text-slate-600 font-semibold select-none px-0.5 shrink-0">›</span>
                )}
                <span
                  className={`truncate ${
                    idx === breadcrumbSegments.length - 1
                      ? 'font-bold text-white tracking-wide text-xs sm:text-[13px]'
                      : 'text-slate-400 font-medium text-xs shrink-0'
                  }`}
                >
                  {segment}
                </span>
              </React.Fragment>
            ))}
            {virtualTimeOffsetMs !== 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30 shrink-0">
                Sanal Zaman
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Multi-image Gallery Navigation (Left of X button, only numbers: < 1 / 2 >) */}
            {galleryImages.length > 1 && (
              <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-white/10 border border-white/15 text-slate-200 shadow-sm">
                <button
                  type="button"
                  disabled={activeImageIndex <= 0}
                  onClick={() => setActiveImageIndex((prev) => Math.max(0, prev - 1))}
                  className="p-1 rounded hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-slate-300 hover:text-white"
                  title="Önceki Görsel (Sol Ok tuşu)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="font-mono text-xs px-1 text-slate-200 font-semibold select-none">
                  {activeImageIndex + 1} / {galleryImages.length}
                </span>

                <button
                  type="button"
                  disabled={activeImageIndex >= galleryImages.length - 1}
                  onClick={() =>
                    setActiveImageIndex((prev) => Math.min(galleryImages.length - 1, prev + 1))
                  }
                  className="p-1 rounded hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-slate-300 hover:text-white"
                  title="Sonraki Görsel (Sağ Ok tuşu)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={handleSafeClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Oturumu Kapat (İlerlemeler kaydedildi)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {initialTotalCount > 0 && (
          <div className="w-full h-1 bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500 transition-all duration-300 ease-out"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((completedCount / Math.max(1, initialTotalCount)) * 100)
                )}%`,
              }}
            />
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden p-3 sm:p-4 flex flex-col items-center justify-center">
          {/* ================= CASE 1: Queue Finished / Celebration ================= */}
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 sm:p-8 max-w-md animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/10">
                <Trophy className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                Tebrikler! Oturum Tamamlandı
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
                Bu deste için bugünkü tüm tekrarları başarıyla tamamladınız. FSRS hafıza vadeleri güncellendi ve kaydedildi.
              </p>

              <div className="w-full grid grid-cols-2 gap-3 mb-6 p-3 rounded-xl bg-black/40 border border-white/10 text-xs">
                <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.02]">
                  <span className="text-slate-400 text-[11px] mb-1">Eritilen Kart</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {completedCount}
                  </span>
                </div>
                <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.02]">
                  <span className="text-slate-400 text-[11px] mb-1">Tekrar Pekiştirilen</span>
                  <span className="text-lg font-bold font-mono text-amber-400">
                    {againCount}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSafeClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                Deste Ekranına Dön
              </button>
            </div>
          ) : (
            /* ================= CASE 2: Active Flashcard ================= */
            <div className="w-full flex flex-col items-center select-none">
              {/* 3D Flippable Flashcard Container: 2:3 Aspect Ratio identically matching AnkiEditorModal */}
              <div
                className="relative w-auto h-[53vh] sm:h-[54vh] max-h-[520px] aspect-[2/3] mx-auto"
                style={{ perspective: 1000 }}
              >
                <div
                  id="anki-study-card"
                  onClick={() => {
                    // Only allow 3D flip after answer is shown
                    if (isAnswerShown) {
                      setIsFlipped(!isFlipped);
                    }
                  }}
                  style={{
                    transformStyle: 'preserve-3d',
                    WebkitTransformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    willChange: 'transform',
                  }}
                  className={`relative w-full h-full rounded-2xl ${
                    isAnswerShown ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  title={
                    isAnswerShown
                      ? isFlipped
                        ? undefined
                        : 'Detaylı künyeyi okumak için karta tıklayıp çevirin'
                      : undefined
                  }
                >
                  {/* ================= FRONT FACE ================= */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(0deg)',
                      WebkitTransform: 'rotateY(0deg)',
                    }}
                    className={`absolute inset-0 w-full h-full rounded-2xl overflow-hidden bg-[#10141f] border border-white/20 shadow-2xl shadow-black flex flex-col justify-between ${
                      isFlipped ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
                    }`}
                  >
                    {/* Visual Scene & Poster */}
                    <div className="absolute inset-0 z-0 bg-neutral-950 flex items-center justify-center overflow-hidden">
                      {activeImage?.url ? (
                        <div className="relative w-full h-full">
                          <img
                            src={activeImage.url}
                            alt="Kart Görseli"
                            className="w-full h-full object-cover select-none"
                            draggable={false}
                          />

                          {/* Blur Boxes: Rendered in Phase 1 (Soru Hali). Automatically removed in Phase 2 */}
                          {!isAnswerShown &&
                            activeImage.blurs.map((box, idx) => (
                              <div
                                key={box.id || idx}
                                style={{
                                  left: `${box.x}%`,
                                  top: `${box.y}%`,
                                  width: `${box.width}%`,
                                  height: `${box.height}%`,
                                }}
                                className="absolute rounded-lg backdrop-blur-xl bg-white/20 border border-white/35 shadow-md overflow-hidden pointer-events-none"
                              />
                            ))}
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-neutral-900 border border-white/10">
                          <Brain className="w-12 h-12 text-slate-600 mb-2" />
                          <span className="text-xs text-slate-400">
                            Afiş Görseli Eklenmemiş
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Front Top-Left: Release Year badge (Only shown in Phase 2 when answer is revealed) */}
                    {isAnswerShown && formattedYear && (
                      <div className="absolute top-3 left-3 z-10 animate-in fade-in slide-in-from-top-1 duration-200">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/25 text-xs font-mono font-bold text-slate-100 shadow-xl">
                          {formattedYear}
                        </span>
                      </div>
                    )}

                    {/* Front Bottom: Title & Details (Only shown in Phase 2 when answer is revealed) */}
                    {isAnswerShown && (
                      <div className="relative z-10 mt-auto p-3.5 flex flex-col items-center text-center bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-8 pb-3">
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 w-full flex flex-col items-center">
                          <h3 className="text-lg sm:text-xl font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
                            {currentItem.title}
                          </h3>

                          {/* Front Badges (Kullanıcı Seçimi veya Otomatik Akıl) */}
                          {frontBadges.length > 0 && (
                            <div className="flex items-center justify-center flex-wrap gap-1.5 mt-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
                              {frontBadges.map((badge, idx) => {
                                let iconNode = (
                                  <Building2 className="w-3 h-3 text-purple-400 shrink-0" />
                                );
                                let roleLabel = 'Firma / Stüdyo';

                                if (badge.role === 'author') {
                                  iconNode = (
                                    <PenTool className="w-3 h-3 text-amber-400 shrink-0" />
                                  );
                                  roleLabel = 'Yazar';
                                } else if (badge.role === 'translator') {
                                  iconNode = (
                                    <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                                  );
                                  roleLabel = 'Çevirmen';
                                } else if (badge.role === 'publisher') {
                                  roleLabel = 'Yayınevi';
                                } else if (badge.role === 'director') {
                                  iconNode = (
                                    <Clapperboard className="w-3 h-3 text-amber-400 shrink-0" />
                                  );
                                  roleLabel = 'Yönetmen';
                                } else if (badge.role === 'actors') {
                                  iconNode = (
                                    <Users className="w-3 h-3 text-sky-400 shrink-0" />
                                  );
                                  roleLabel = 'Oyuncular / Seslendirme';
                                } else if (badge.role === 'developer') {
                                  roleLabel = 'Geliştirici / Stüdyo';
                                }

                                return (
                                  <React.Fragment key={idx}>
                                    {idx > 0 && (
                                      <span className="text-white/40 text-xs font-bold select-none">
                                        •
                                      </span>
                                    )}
                                    <span
                                      title={roleLabel}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-xs font-medium text-slate-200 shadow-md"
                                    >
                                      {iconNode}
                                      <span>{badge.text}</span>
                                    </span>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ================= BACK FACE (Rich Lore Card Detail) ================= */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      WebkitTransform: 'rotateY(180deg)',
                    }}
                    className={`absolute inset-0 w-full h-full rounded-2xl overflow-hidden bg-[#121520] border border-white/20 shadow-2xl shadow-black flex flex-col p-4 justify-between antialiased ${
                      isFlipped ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                    }`}
                  >
                    {/* Header */}
                    <div className="border-b border-white/10 pb-2.5 shrink-0 text-left">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-base font-bold text-white leading-snug line-clamp-2 flex-1 min-w-0">
                          {currentItem.title}
                        </h4>
                        {formattedYear && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[11px] font-medium text-slate-200 shrink-0">
                            <Calendar className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                            <span>{formattedYear}</span>
                          </div>
                        )}
                      </div>

                      {/* Studio / Firm / Developer / Author Badges */}
                      {((currentItem.firm && currentItem.firm.length > 0) ||
                        (currentItem.director && currentItem.director.length > 0) ||
                        (currentItem.developer && currentItem.developer.length > 0) ||
                        (currentItem.author && currentItem.author.length > 0)) && (
                        <div className="flex flex-col gap-1 mt-2 text-[11px]">
                          {currentItem.firm && currentItem.firm.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-semibold text-[10px] shrink-0">
                                Firma:
                              </span>
                              <span className="text-purple-300 truncate font-medium">
                                {currentItem.firm.join(', ')}
                              </span>
                            </div>
                          )}
                          {currentItem.director && currentItem.director.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-semibold text-[10px] shrink-0">
                                Yönetmen:
                              </span>
                              <span className="text-amber-300 truncate font-medium">
                                {currentItem.director.join(', ')}
                              </span>
                            </div>
                          )}
                          {currentItem.developer && currentItem.developer.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-semibold text-[10px] shrink-0">
                                Geliştirici:
                              </span>
                              <span className="text-purple-300 truncate font-medium">
                                {currentItem.developer.join(', ')}
                              </span>
                            </div>
                          )}
                          {currentItem.author && currentItem.author.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-semibold text-[10px] shrink-0">
                                Yazar:
                              </span>
                              <span className="text-amber-300 truncate font-medium">
                                {currentItem.author.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scrollable Center: Summary & Characters */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar my-2 space-y-2.5 pr-1 text-left">
                      {/* Description / Summary */}
                      <div>
                        <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                          KONUSU
                        </span>
                        <p className="text-xs text-slate-200 leading-relaxed bg-white/[0.03] p-2.5 rounded-xl border border-white/5 whitespace-pre-wrap">
                          {currentItem.desc?.trim() || 'Açıklama bulunmuyor.'}
                        </p>
                      </div>

                      {/* Characters */}
                      {currentItem.characters && currentItem.characters.length > 0 && (
                        <div>
                          <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                            <Users className="w-3 h-3 text-sky-400" />
                            Kadro ({currentItem.characters.length})
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {currentItem.characters.map((c, i) => (
                              <div
                                key={i}
                                className="p-1.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center gap-1.5 text-xs min-w-0"
                              >
                                {c.image ? (
                                  <img
                                    src={c.image}
                                    alt={c.name}
                                    className="w-7 h-7 rounded object-cover border border-white/15 bg-black/40 shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded border border-white/10 bg-white/[0.04] flex items-center justify-center shrink-0">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="block font-bold text-slate-200 text-[10px] truncate leading-tight">
                                    {c.name}
                                  </span>
                                  {c.actor && (
                                    <span className="block text-[9px] text-sky-300 truncate">
                                      {c.actor}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control & Rating Bar (Anki Style - Rock-solid static height) */}
        {queue.length > 0 && (
          <div className="px-3 sm:px-4 py-2.5 bg-neutral-950/95 border-t border-white/10 flex flex-col items-center justify-center shrink-0 h-[88px] sm:h-[92px]">
            {!isAnswerShown ? (
              /* Phase 1: Anki-style "Cevabı Göster" (Show Answer) + Counters */
              <div className="flex flex-col items-center justify-center w-full animate-in fade-in duration-150">
                {/* 0 + 3 + 49 Anki Counts Indicator: Only visible in Phase 1 before answer is revealed */}
                <div className="flex items-center gap-1.5 text-xs font-mono font-semibold mb-2 select-none">
                  <span className="text-blue-400" title="Yeni">
                    {deckCounts.newCount}
                  </span>
                  <span className="text-slate-600">+</span>
                  <span
                    className="text-rose-400 underline underline-offset-2"
                    title="Öğreniliyor"
                  >
                    {deckCounts.learningCount}
                  </span>
                  <span className="text-slate-600">+</span>
                  <span className="text-emerald-400" title="Tekrar">
                    {deckCounts.reviewCount}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAnswerShown(true)}
                  className="w-full sm:w-auto px-8 py-2.5 sm:py-2 rounded-xl bg-neutral-800/95 hover:bg-neutral-700 text-white font-semibold text-xs border border-white/15 shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 hover:border-white/30"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-300" />
                  <span>Cevabı Göster</span>
                </button>
              </div>
            ) : (
              /* Phase 2: Anki-style 4 Rating Buttons - 2 satırlı (Üstte Süre, Altta İsim) & PC Renk Paleti */
              <div className="w-full grid grid-cols-4 gap-1.5 sm:gap-2 animate-in fade-in duration-150">
                {repeatOptions.map((opt) => {
                  let styleClasses = 'text-slate-200 bg-neutral-800 border-white/10 hover:bg-neutral-700';

                  if (opt.rating === Rating.Again) {
                    styleClasses = 'text-red-400 bg-red-500/15 border-red-500/35 hover:bg-red-500/25 active:bg-red-500/30';
                  } else if (opt.rating === Rating.Hard) {
                    styleClasses = 'text-amber-400 bg-amber-500/15 border-amber-500/35 hover:bg-amber-500/25 active:bg-amber-500/30';
                  } else if (opt.rating === Rating.Good) {
                    styleClasses = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/35 hover:bg-emerald-500/25 active:bg-emerald-500/30';
                  } else if (opt.rating === Rating.Easy) {
                    styleClasses = 'text-blue-400 bg-blue-500/15 border-blue-500/35 hover:bg-blue-500/25 active:bg-blue-500/30';
                  }

                  return (
                    <button
                      key={opt.rating}
                      type="button"
                      onClick={() => handleRate(opt)}
                      className={`w-full py-2 sm:py-2.5 px-1 rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm border flex flex-col items-center justify-center gap-1 select-none ${styleClasses}`}
                    >
                      {/* Süre (Üstte: <1dk, <6dk, vb.) */}
                      <span className="text-[10px] sm:text-[11px] font-mono font-medium opacity-90 leading-none">
                        {opt.intervalText}
                      </span>
                      {/* Buton Adı (Altta: Yeniden, Zor, İyi, Kolay) */}
                      <span className="font-bold text-xs sm:text-xs leading-none">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
