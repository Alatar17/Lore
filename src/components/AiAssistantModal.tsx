import React, { useState, useEffect, useRef } from 'react';
import { ArchiveItem, Category, AiChatMessage, AiRecommendationCard } from '../types';
import {
  X,
  ArrowUp,
  Mic,
  Trash2,
  Loader2,
  AlertCircle,
  CornerDownLeft,
  Copy,
  Check,
  RotateCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  HelpCircle,
  Maximize2,
  Image as ImageIcon,
  Building2,
  Clapperboard,
  Gamepad2,
  BookmarkCheck,
  ThumbsUp,
  ThumbsDown,
  Target,
  Ban,
  Archive,
} from 'lucide-react';
import { generateTasteProfile, formatTasteProfileForPrompt } from '../utils/aiTasteProfile';
import { askAiAssistant, getGeminiApiKey, formatAssistantModelLabel } from '../utils/geminiAi';
import {
  RecommendationMemoryItem,
  RecommendationPoolType,
  loadRecommendationMemory,
  saveRecommendationMemory,
  addCardsToMemory,
  moveMemoryItemPool,
  batchMoveItemsToPool,
  removeMemoryItem,
  clearArchivePool,
  formatExclusionListForPrompt,
  findMemoryItem,
} from '../utils/recommendationMemory';
import { RecommendationMemoryPanel } from './RecommendationMemoryPanel';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ArchiveItem[];
  categories: { media: Category[]; game: Category[]; book?: Category[] };
  activeTab?: 'media' | 'game' | 'book';
  onOpenAddItem?: (initialTitle?: string, targetTab?: 'media' | 'game' | 'book') => void;
  onOpenItemDetail?: (item: ArchiveItem) => void;
}

const STORAGE_KEY = 'lore_ai_chat_history';

// Helper to parse inline [[item:id|title]], ([id:id|title]), [id:id|title], **bold**, and *italic*
const renderInlineFormatted = (
  raw: string,
  items: ArchiveItem[],
  onOpenItemDetail?: (item: ArchiveItem) => void
) => {
  // Matches [[item:...]], ([id:...]), [id:...], **...**, or *...*
  const parts = raw.split(/(\[\[item:[^\]]+\]\]|\(?\[id:\s*[^|\]]+\|[^\]]+\]\)?|\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, index) => {
    // 1. Tagged library item: [[item:id|title]] or ([id:id|title]) or [id:id|title] -> Clean sky blue button
    if (
      (part.startsWith('[[item:') && part.endsWith(']]')) ||
      (part.includes('[id:') && part.endsWith(']') && part.includes('|')) ||
      (part.startsWith('(') && part.endsWith(')') && part.includes('[id:') && part.includes('|'))
    ) {
      let inner = part;
      // Strip outer parens if wrapped like ([id: ...])
      if (inner.startsWith('(') && inner.endsWith(')')) {
        inner = inner.slice(1, -1);
      }
      if (inner.startsWith('[[item:') && inner.endsWith(']]')) {
        inner = inner.slice(7, -2);
      } else if (inner.startsWith('[id:') && inner.endsWith(']')) {
        inner = inner.slice(4, -1);
      }

      let itemId = inner;
      let itemTitle = inner;

      if (inner.includes('|')) {
        const splitIdx = inner.indexOf('|');
        itemId = inner.slice(0, splitIdx).trim();
        itemTitle = inner.slice(splitIdx + 1).trim();
      }

      // Try to match the actual item from library by ID first, then fallback to title
      const foundItem =
        items.find((it) => it.id === itemId) ||
        items.find(
          (it) =>
            it.title.trim().toLowerCase() === itemTitle.trim().toLowerCase() ||
            (it.sub && `${it.title} ${it.sub}`.trim().toLowerCase() === itemTitle.trim().toLowerCase())
        );

      return (
        <button
          key={`item-${index}`}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (foundItem && onOpenItemDetail) {
              onOpenItemDetail(foundItem);
            }
          }}
          title={
            foundItem
              ? `Kütüphanede İncele: ${foundItem.title}${foundItem.rating ? ` (${foundItem.rating}/10 Puan)` : ''}`
              : `Kütüphanede Ara: ${itemTitle}`
          }
          className="font-semibold text-sky-300 hover:text-sky-100 transition-colors cursor-pointer select-text inline p-0 m-0 bg-transparent border-none text-left tracking-normal active:opacity-75"
        >
          {itemTitle}
        </button>
      );
    }

    // 2. Regular bold (**text**) -> Crisp white bold
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={`bold-${index}`} className="font-semibold text-white tracking-wide">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // 3. Regular italic (*text*) -> Elegant italic text
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={`italic-${index}`} className="italic text-slate-200">
          {part.slice(1, -1)}
        </em>
      );
    }

    // 4. Regular text chunk -> plain text (No blind auto-matching of ordinary words like 'gibi' or 'yok oluş')
    return part;
  });
};

/**
 * Parses:
 * 1. AI-tagged library items: [[item:id|Title]] or [[item:Title]]
 * 2. Regular bold (**text**) -> Plain crisp white bold (ratings, notes, external picks)
 * 3. Regular italic (*text*) -> Elegant italic text
 * 4. Markdown bullets (*, -, •) -> Typographic bullet items
 */
const FormattedAiContent: React.FC<{
  text: string;
  items: ArchiveItem[];
  onOpenItemDetail?: (item: ArchiveItem) => void;
}> = ({ text, items, onOpenItemDetail }) => {
  const lines = text.split('\n');

  return (
    <div className="space-y-2 text-slate-200 leading-relaxed select-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty line -> vertical space
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Bullet list item (* item, - item, • item)
        const bulletMatch = trimmed.match(/^([*\-•])\s+(.*)$/);
        if (bulletMatch) {
          const content = bulletMatch[2];
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1 my-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-200 mt-2 shrink-0 shadow-xs" />
              <div className="flex-1 leading-relaxed">
                {renderInlineFormatted(content, items, onOpenItemDetail)}
              </div>
            </div>
          );
        }

        // Standard paragraph or heading-like bold lines
        return (
          <p key={idx} className="leading-relaxed">
            {renderInlineFormatted(line, items, onOpenItemDetail)}
          </p>
        );
      })}
    </div>
  );
};

/**
 * 2 Kademeli İnteraktif Öneri Kartı:
 * 1. Kademe: Kompakt Görünüm (Afiş, Başlık, Yıl, 1 Cümlelik Kısa Konu)
 * 2. Kademe: Tıklandığında Büyüyen Detaylı Görünüm (Detaylı Konu, 3-4 Sahne Galerisi, "Neden Önerdin?" Gerekçesi, "Kütüphaneye Ekle" Butonu)
 */
const AiRecommendationCardView: React.FC<{
  card: AiRecommendationCard;
  items: ArchiveItem[];
  onOpenAddItem?: (initialTitle?: string, targetTab?: 'media' | 'game' | 'book') => void;
  onOpenItemDetail?: (item: ArchiveItem) => void;
  onPreviewGallery: (images: string[], initialIndex: number, title?: string) => void;
}> = ({ card, items, onOpenAddItem, onOpenItemDetail, onPreviewGallery }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [askedWhy, setAskedWhy] = useState(false);
  const [isAnsweringWhy, setIsAnsweringWhy] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [failedGalleryIndexes, setFailedGalleryIndexes] = useState<Set<number>>(new Set());

  const handleAskWhy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAskedWhy(true);
  };

  const handleGalleryError = (idx: number) => {
    setFailedGalleryIndexes((prev) => new Set(prev).add(idx));
  };

  const validGalleryImages = (card.galleryImages || []).filter((_, idx) => !failedGalleryIndexes.has(idx));

  const allImagesList = [
    ...(card.thumbnailUrl && !imgError ? [card.thumbnailUrl] : []),
    ...validGalleryImages,
  ];

  return (
    <div className="w-full mt-3 rounded-2xl bg-gradient-to-b from-[#1b2133] to-[#141826] border border-indigo-500/30 hover:border-indigo-400/50 shadow-xl overflow-hidden transition-all duration-300">
      {/* 1. KADEME: Kompakt Başlık & Tıklama Tetikleyicisi */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 sm:p-4 flex items-start gap-3 sm:gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors select-none group"
      >
        {/* Dikey 2:3 Afiş Görseli */}
        <div
          onClick={(e) => {
            if (card.thumbnailUrl && !imgError && allImagesList.length > 0) {
              e.stopPropagation();
              onPreviewGallery(allImagesList, 0, card.title);
            }
          }}
          className="w-16 sm:w-20 aspect-[2/3] rounded-xl overflow-hidden bg-black/50 border border-white/10 shrink-0 relative shadow-md group/poster cursor-pointer"
        >
          {card.thumbnailUrl && !imgError ? (
            <>
              <img
                src={card.thumbnailUrl}
                alt={card.title}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover group-hover/poster:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="w-3.5 h-3.5 text-white" />
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-1 bg-gradient-to-br from-indigo-900/40 to-slate-900/60 text-center">
              <Sparkles className="w-5 h-5 text-indigo-400 mb-1" />
              <span className="text-[9px] font-bold text-slate-300 line-clamp-2 px-1 leading-tight">
                {card.title}
              </span>
            </div>
          )}
        </div>

        {/* Sağ Bilgi Alanı */}
        <div className="flex-1 min-w-0">
          {/* Başlık Satırı & Sağda Rozet + Ok */}
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-200 transition-colors truncate min-w-0">
              {card.title}
              {card.releaseYear && (
                <span className="font-normal text-slate-400 text-xs sm:text-sm ml-1.5 tracking-normal">
                  ({card.releaseYear})
                </span>
              )}
            </h4>

            {/* Sağ: Rozet + Genişlet/Daralt Oku */}
            <div className="flex items-center gap-1.5 shrink-0">
              {card.badge && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border shadow-xs whitespace-nowrap ${
                    card.badge.includes('İMZASI')
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : card.badge.includes('FARKLI')
                      ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                      : 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                  }`}
                >
                  {card.badge}
                  {card.matchScore ? <span className="opacity-75">• %{card.matchScore}</span> : null}
                </span>
              )}

              <div className="p-1 rounded-lg text-slate-400 group-hover:text-white transition-colors">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-indigo-300" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>
          </div>

          {/* 1 Cümlelik Kompakt Kısa Özet */}
          <p className="text-xs text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">
            {card.shortDesc}
          </p>

          {/* Medya / Oyun Etiketleri (Firma, Yönetmen / Geliştirici) & Kütüphaneye Ekle Buton Satırı */}
          <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              {/* Kitap İse: Yazar, Yayınevi ve Çevirmen */}
              {card.mainTab === 'book' ? (
                <div className="flex flex-col gap-1">
                  {card.authors && card.authors.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                      <span className="text-slate-400 text-[10px] font-medium shrink-0">Yazar:</span>
                      <span className="text-amber-300 font-semibold text-[11px] truncate">
                        {card.authors.join(', ')}
                      </span>
                    </div>
                  )}
                  {card.publishers && card.publishers.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                      <span className="text-slate-400 text-[10px] font-medium shrink-0">Yayınevi:</span>
                      <span className="text-purple-300 font-semibold text-[11px] truncate">
                        {card.publishers.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              ) : card.mainTab === 'game' ? (
                /* Oyun İse: Geliştirici Etiketi (Tek Satır, Mavi / Sky, Kutusuz) */
                <>
                  {card.developers && card.developers.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                      <span className="text-slate-400 text-[10px] font-medium shrink-0">Geliştirici:</span>
                      <span className="text-sky-300 font-semibold text-[11px] truncate">
                        {card.developers.join(', ')}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                /* Medya İse: Firma ve Yönetmen Alt Alta (Kutusuz, Temiz Metin) */
                <div className="flex flex-col gap-1">
                  {card.firms && card.firms.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                      <span className="text-slate-400 text-[10px] font-medium shrink-0">Firma:</span>
                      <span className="text-sky-300 font-semibold text-[11px] truncate">
                        {card.firms.join(', ')}
                      </span>
                    </div>
                  )}

                  {card.directors && card.directors.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                      <span className="text-slate-400 text-[10px] font-medium shrink-0">Yönetmen:</span>
                      <span className="text-amber-300 font-semibold text-[11px] truncate">
                        {card.directors.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Ek Tür Etiketleri (Eğer firma, yönetmen, yazar ve geliştirici yoksa) */}
              {(!card.firms?.length && !card.directors?.length && !card.developers?.length && !card.authors?.length && card.genres && card.genres.length > 0) && (
                <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                  <span className="text-slate-400 text-[10px] font-medium shrink-0">Tür:</span>
                  <span className="text-slate-300 font-medium text-[11px] truncate">
                    {card.genres.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Kütüphaneye Ekle Butonu */}
            {onOpenAddItem && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAddItem(card.title, card.mainTab);
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-200 hover:text-white text-xs font-semibold tracking-wide transition-all cursor-pointer active:scale-95 shadow-xs shrink-0 ml-auto self-center"
              >
                <span>Kütüphaneye Ekle</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. KADEME: Genişleyen Alan */}
      {isExpanded && (
        <div className="px-3 sm:px-5 pb-5 pt-2 border-t border-white/10 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* 1. Detaylı Konu Metni */}
          <div className="pt-2">
            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Konu & Atmosfer
            </h5>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {card.detailedDesc}
            </p>

            {/* Tür Rozetleri */}
            {card.genres && card.genres.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Türler:
                </span>
                {card.genres.map((g, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 text-[11px] font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 2. Mini Sahne & Görsel Galerisi (Geçici olarak gizlendi - kodlar korundu) */}
          {false && validGalleryImages.length > 0 && (
            <div className="pt-1">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Sahne & Atmosfer Kareleri
              </h5>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {validGalleryImages.map((imgUrl, idx) => {
                  const initialIdx = (card.thumbnailUrl && !imgError) ? idx + 1 : idx;
                  return (
                    <div
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewGallery(allImagesList, initialIdx, card.title);
                      }}
                      className="aspect-video rounded-xl overflow-hidden bg-black/40 border border-white/10 hover:border-indigo-400/60 cursor-pointer group/img relative shadow-sm hover:scale-[1.03] transition-all"
                    >
                      <img
                        src={imgUrl}
                        alt={`${card.title} sahne ${idx + 1}`}
                        onError={() => handleGalleryError(idx)}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. "Neden bunu önerdin?" İnteraktif Asistan Butonu & Gerekçe Alanı */}
          {card.matchReason && (
            <div className="pt-2 border-t border-white/5">
              {!askedWhy && !isAnsweringWhy && (
                <button
                  type="button"
                  onClick={handleAskWhy}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 hover:border-amber-500/40 text-xs font-semibold text-amber-200 hover:text-amber-100 transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
                  <span>Neden bunu önerdin?</span>
                </button>
              )}

              {isAnsweringWhy && (
                <div className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                  <span className="font-medium">Kütüphane zevkinle eşleştiriliyor...</span>
                </div>
              )}

              {askedWhy && (
                <div className="rounded-xl bg-amber-950/20 border border-amber-500/30 p-3.5 sm:p-4 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tavsiye Gerekçesi</span>
                  </div>
                  <div className="text-xs sm:text-[13px] text-slate-200 leading-relaxed pt-0.5 select-text">
                    {renderInlineFormatted(card.matchReason, items, onOpenItemDetail)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper to strip internal library item tags [[item:id|Title]] or ([id:id|Title]) -> Title
const stripLibraryItemTags = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\[\[item:[^|\]]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[item:([^\]]+)\]\]/g, '$1')
    .replace(/\(?\[id:\s*[^|\]]+\|([^\]]+)\]\)?/g, '$1');
};

// Formats an AI chat message (plain text or text + cards) cleanly for clipboard
const formatMessageForClipboard = (msg: AiChatMessage): string => {
  const cleanBodyText = stripLibraryItemTags(msg.text || '').trim();

  const cards: AiRecommendationCard[] =
    msg.recommendations && msg.recommendations.length > 0
      ? msg.recommendations
      : msg.recommendation
      ? [msg.recommendation]
      : [];

  if (cards.length === 0) {
    return cleanBodyText;
  }

  const formattedCards = cards.map((card) => {
    const isGame = card.mainTab === 'game';
    const isBook = card.mainTab === 'book';
    const icon = isBook ? '📚' : isGame ? '🎮' : '🎬';
    const yearStr = card.releaseYear ? ` (${card.releaseYear})` : '';
    const header = `${icon} ${card.title}${yearStr}`;

    const metadataLines: string[] = [];
    if (card.genres && card.genres.length > 0) {
      metadataLines.push(`• Tür: ${card.genres.join(', ')}`);
    }

    if (isBook) {
      if (card.authors && card.authors.length > 0) {
        metadataLines.push(`• Yazar: ${card.authors.join(', ')}`);
      }
      if (card.publishers && card.publishers.length > 0) {
        metadataLines.push(`• Yayınevi: ${card.publishers.join(', ')}`);
      }
      if (card.translators && card.translators.length > 0) {
        metadataLines.push(`• Çevirmen: ${card.translators.join(', ')}`);
      }
    } else if (isGame) {
      if (card.developers && card.developers.length > 0) {
        metadataLines.push(`• Geliştirici: ${card.developers.join(', ')}`);
      }
    } else {
      if (card.directors && card.directors.length > 0) {
        metadataLines.push(`• Yönetmen: ${card.directors.join(', ')}`);
      }
      if (card.firms && card.firms.length > 0) {
        metadataLines.push(`• Yapımcı: ${card.firms.join(', ')}`);
      }
    }

    const sections: string[] = [header];

    if (metadataLines.length > 0) {
      sections.push(metadataLines.join('\n'));
    }

    // Story / Topic description (detailed preferred, fallback to short)
    const storyDesc = (card.detailedDesc || card.shortDesc || '').trim();
    if (storyDesc) {
      sections.push(`Konu:\n${stripLibraryItemTags(storyDesc)}`);
    }

    // Match Reason (Tavsiye Gerekçesi)
    if (card.matchReason && card.matchReason.trim()) {
      sections.push(`Tavsiye Gerekçesi:\n${stripLibraryItemTags(card.matchReason.trim())}`);
    }

    return sections.join('\n\n');
  });

  const divider = '──────────────────────────────';
  const cardsBlock = formattedCards.join(`\n\n${divider}\n\n`);

  if (cleanBodyText) {
    return `${cleanBodyText}\n\n${divider}\n\n${cardsBlock}`;
  }

  return cardsBlock;
};

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  items,
  categories,
  activeTab,
  onOpenAddItem,
  onOpenItemDetail,
}) => {
  const [messages, setMessages] = useState<AiChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return [];
  });

  const [recommendationMemory, setRecommendationMemory] = useState<RecommendationMemoryItem[]>(() =>
    loadRecommendationMemory()
  );

  useEffect(() => {
    const handleMemoryUpdated = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setRecommendationMemory(e.detail);
      } else {
        setRecommendationMemory(loadRecommendationMemory());
      }
    };
    window.addEventListener('lore-recommendation-memory-updated', handleMemoryUpdated);
    return () => window.removeEventListener('lore-recommendation-memory-updated', handleMemoryUpdated);
  }, []);
  const [viewMode, setViewMode] = useState<'chat' | 'memory'>('chat');
  const [activePopover, setActivePopover] = useState<{
    messageId: string;
    targetPool: RecommendationPoolType;
    cards: AiRecommendationCard[];
    selectedTitles: Set<string>;
  } | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const showToast = (text: string) => {
    setFeedbackToast(text);
    setTimeout(() => {
      setFeedbackToast(null);
    }, 2400);
  };

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetConfirmMsg, setResetConfirmMsg] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [lightboxGallery, setLightboxGallery] = useState<{
    images: string[];
    currentIndex: number;
    title: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  // Safe items count for live indicator
  const safeItemsCount = items.filter((it) => !it.isHidden).length;

  // Save chat history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Could not save AI chat history to localStorage:', e);
    }
  }, [messages]);

  // Reset to chat view whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setViewMode('chat');
    }
  }, [isOpen]);

  // Auto-scroll to bottom on new message or modal open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        // Only autofocus on PC/desktop devices with a physical keyboard
        const isMobileOrTouch = window.innerWidth < 768 || 'ontouchstart' in window;
        if (!isMobileOrTouch) {
          textareaRef.current?.focus();
        }
      }, 150);
    }
  }, [isOpen, messages, isLoading]);

  // Auto-grow textarea between 1 and 5 lines smoothly based on content scrollHeight
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // 1 line ~ 24px, 5 lines ~ 125px
      const scrollH = textareaRef.current.scrollHeight;
      const targetHeight = Math.min(Math.max(scrollH, 24), 125);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [inputText]);

  // Clean up speech recognition on unmount or close
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Keyboard navigation for Lightbox and modal ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxGallery) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setLightboxGallery(null);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          setLightboxGallery((prev) =>
            prev && prev.images.length > 1
              ? { ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length }
              : prev
          );
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          setLightboxGallery((prev) =>
            prev && prev.images.length > 1
              ? {
                  ...prev,
                  currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length,
                }
              : prev
          );
          return;
        }
      } else if (e.key === 'Escape') {
        if (!isOpen) return;
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, lightboxGallery]);

  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert('Tarayıcınız sesle yazmayı (Speech Recognition) desteklemiyor. Lütfen Chrome veya Edge kullanın.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'tr-TR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputText(transcript);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('Speech recognition failed to start:', e);
      setIsListening(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isLoading) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }

    const userMsg: AiChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputText('');
    setIsLoading(true);

    // Kütüphane tamamen boş ise (0 yapım hafızada) API'ye gitmeden doğrudan yerel mesaj ver
    if (safeItemsCount === 0) {
      setTimeout(() => {
        const botMsg: AiChatMessage = {
          id: 'msg_ai_' + Date.now(),
          sender: 'assistant',
          text: 'Kütüphanenizde henüz kayıtlı bir yapım bulunmuyor. Size özel öneriler sunabilmem ve kütüphanenizi analiz edebilmem için lütfen kütüphanenize birkaç film, dizi veya oyun ekleyin.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsLoading(false);
      }, 350);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 1. Extract taste profile and privacy-safe library index
      const tasteProfile = generateTasteProfile(items, categories);
      const tasteContext = formatTasteProfileForPrompt(tasteProfile);

      // 2. Format exclusion list from recommendation memory (Sıfır Tekrar Kuralı)
      const exclusionContext = formatExclusionListForPrompt(recommendationMemory, activeTab);

      // 3. Prepare chat history for context
      const chatHistory = nextMessages.map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      // 4. Query Gemini Assistant with multi-model fallback and zero-repeat memory
      const result = await askAiAssistant({
        userPrompt: text,
        tasteProfileContext: tasteContext,
        chatHistory,
        apiKey: getGeminiApiKey(),
        recommendationExclusionContext: exclusionContext,
      });

      if (controller.signal.aborted) {
        return;
      }

      if (result.success && result.reply) {
        const botMsg: AiChatMessage = {
          id: 'msg_ai_' + Date.now(),
          sender: 'assistant',
          text: result.reply,
          timestamp: Date.now(),
          model: result.usedModel,
          recommendation: result.recommendation,
          recommendations: result.recommendations,
        };
        setMessages((prev) => [...prev, botMsg]);

        // Auto-register any newly recommended cards into Recommendation Memory (pool: 'archive')
        const newCards: AiRecommendationCard[] =
          result.recommendations && result.recommendations.length > 0
            ? result.recommendations
            : result.recommendation
            ? [result.recommendation]
            : [];

        if (newCards.length > 0) {
          setRecommendationMemory((prev) => addCardsToMemory(newCards, prev));
        }
      } else {
        const errorMsg: AiChatMessage = {
          id: 'msg_ai_err_' + Date.now(),
          sender: 'assistant',
          text:
            result.error ||
            'Üzgünüm, sorunuza yanıt verirken bir bağlantı sorunu oluştu. Lütfen Ayarlar menüsünden Gemini API anahtarınızı kontrol edin.',
          timestamp: Date.now(),
          error: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      const errorMsg: AiChatMessage = {
        id: 'msg_ai_err_' + Date.now(),
        sender: 'assistant',
        text: `İşlem sırasında bir hata oluştu: ${errMsg.slice(0, 150)}`,
        timestamp: Date.now(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (msg: AiChatMessage) => {
    try {
      const fullText = formatMessageForClipboard(msg);
      navigator.clipboard.writeText(fullText);
      setCopiedMessageId(msg.id);
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 1600);
    } catch (e) {
      console.warn('Could not copy message text:', e);
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    setResetConfirmMsg(true);
    setTimeout(() => setResetConfirmMsg(false), 2000);
  };

  const handleRegenerate = (assistantMsgId: string) => {
    if (isLoading) return;
    const msgIdx = messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIdx === -1) return;
    let userText = '';
    for (let i = msgIdx - 1; i >= 0; i--) {
      if (messages[i].sender === 'user' && messages[i].text?.trim()) {
        userText = messages[i].text.trim();
        break;
      }
    }
    if (!userText) {
      const lastUser = [...messages].reverse().find((m) => m.sender === 'user' && m.text?.trim());
      if (lastUser) userText = lastUser.text.trim();
    }
    if (userText) {
      handleSendMessage(userText);
    }
  };

  // Keyboard behavior: Ctrl+Enter (or Cmd+Enter on Mac) sends, regular Enter creates a new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSendMessage();
      }
      // regular Enter naturally creates a new newline in textarea
    }
  };

  return (
    <div
      id="ai-assistant-modal-overlay"
      className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 md:p-6 overflow-y-auto transition-opacity duration-150 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none hidden'
      }`}
      onClick={onClose}
    >
      <div
        id="ai-assistant-modal-box"
        className="relative w-full sm:max-w-2xl md:max-w-3xl bg-[#141824] border-t sm:border border-white/15 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[94vh] sm:h-[93vh] max-h-[96vh] text-slate-100 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast Bildirim Bannerı */}
        {feedbackToast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900/95 border border-indigo-400/50 text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
            {feedbackToast}
          </div>
        )}

        {viewMode === 'memory' ? (
          <RecommendationMemoryPanel
            memoryItems={recommendationMemory}
            onClose={onClose}
            onBackToChat={() => setViewMode('chat')}
            onMoveItem={(itemId, targetPool) => {
              setRecommendationMemory((prev) => moveMemoryItemPool(prev, itemId, targetPool));
              showToast(
                targetPool === 'radar'
                  ? 'Radara taşındı! 🎯'
                  : targetPool === 'blacklist'
                  ? 'Kara listeye alındı! 🚫'
                  : 'Arşive taşındı! 📦'
              );
            }}
            onRemoveItem={(itemId) => {
              setRecommendationMemory((prev) => removeMemoryItem(prev, itemId));
              showToast('Hafızadan tamamen silindi.');
            }}
            onClearArchive={() => {
              setRecommendationMemory((prev) => clearArchivePool(prev));
              showToast('Öneri arşivi temizlendi. Radar ve Kara Liste korundu.');
            }}
            onOpenAddItem={onOpenAddItem}
          />
        ) : (
          <>
            {/* Header Bar */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-white/10 bg-black/40 shrink-0">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide whitespace-nowrap">
                      Lore AI Asistan
                    </h2>
                    {/* Desktop: yan yana kutu içinde sadece '108 yapım' */}
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-medium text-emerald-300 shrink-0">
                      {safeItemsCount} yapım
                    </span>
                  </div>
                  {/* Mobil: başlığın hemen altında noktasız, sade alt bilgi */}
                  <div className="sm:hidden text-[10px] text-emerald-400 font-medium tracking-tight">
                    {safeItemsCount} yapım
                  </div>
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    Zevk profili ve kütüphane hafızası aktif
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Öneri Hafızası Butonu */}
                <button
                  id="ai-assistant-memory-btn"
                  type="button"
                  onClick={() => setViewMode('memory')}
                  title="Öneri Hafızası (Radar, Kara Liste ve Arşiv)"
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-400/40 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                >
                  <BookmarkCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden xs:inline">Öneri Hafızası</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                    {recommendationMemory.length}
                  </span>
                </button>

                {/* New Chat Reset Button */}
                <button
                  id="ai-assistant-reset-btn"
                  type="button"
                  onClick={handleResetChat}
                  title="Sohbeti Sıfırla (Geçmişi temizler)"
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-400" />
                  <span className="hidden xs:inline">
                    {resetConfirmMsg ? 'Temizlendi' : 'Yeni Sohbet'}
                  </span>
                </button>

                {/* Close Button */}
                <button
                  id="ai-assistant-close-btn"
                  type="button"
                  onClick={onClose}
                  title="Kapat (ESC veya Kısayol: A)"
                  className="p-1.5 sm:p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

        {/* Messages Scroll Area */}
        <div
          id="ai-assistant-messages-container"
          className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 text-xs sm:text-sm"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-8 select-none">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-wide">
                Size nasıl yardımcı olabilirim?
              </h3>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="w-full">
                {msg.sender === 'user' ? (
                  /* User Prompt Card (Soft dark box, no icons, no time, 100% horizontal presence) */
                  <div className="w-full rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 sm:p-4 text-slate-100 shadow-xs">
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  </div>
                ) : (
                  /* AI Response (Boxless, directly on canvas, full width) */
                  <div className="w-full py-1">
                    {msg.error ? (
                      <div className="w-full rounded-xl bg-rose-950/30 border border-rose-500/30 p-4 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div className="flex-1 whitespace-pre-wrap">{msg.text}</div>
                      </div>
                    ) : (
                      <div className="w-full text-slate-200">
                        <FormattedAiContent
                          text={msg.text}
                          items={items}
                          onOpenItemDetail={onOpenItemDetail}
                        />

                        {/* Çoklu / Tekil Öneri Kartları (Maksimum 10 Kart) */}
                        {(() => {
                          const cards =
                            msg.recommendations && msg.recommendations.length > 0
                              ? msg.recommendations
                              : msg.recommendation
                              ? [msg.recommendation]
                              : [];

                          if (cards.length === 0) return null;

                          return (
                            <div className="space-y-3 mt-3">
                              {cards.map((cardItem, cardIdx) => (
                                <AiRecommendationCardView
                                  key={`${cardItem.title}-${cardIdx}`}
                                  card={cardItem}
                                  items={items}
                                  onOpenAddItem={onOpenAddItem}
                                  onOpenItemDetail={onOpenItemDetail}
                                  onPreviewGallery={(images, initialIndex, title) =>
                                    setLightboxGallery({
                                      images,
                                      currentIndex: initialIndex,
                                      title: title || '',
                                    })
                                  }
                                />
                              ))}
                            </div>
                          );
                        })()}

                        {/* Grok-style Bottom Action Bar (Icons on left, Model & Time on right) */}
                        {(() => {
                          const cards =
                            msg.recommendations && msg.recommendations.length > 0
                              ? msg.recommendations
                              : msg.recommendation
                              ? [msg.recommendation]
                              : [];

                          return (
                            <div>
                              <div className="flex items-center justify-between gap-3 pt-3 mt-3 border-b border-white/5 pb-3">
                                {/* Left: Action Icons & Time */}
                                <div className="flex items-center gap-1.5 relative">
                                  {/* Copy button */}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyMessage(msg)}
                                    title={copiedMessageId === msg.id ? 'Kopyalandı' : 'Yanıtı Kopyala'}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors cursor-pointer"
                                  >
                                    {copiedMessageId === msg.id ? (
                                      <Check className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>

                                  {/* Like & Dislike Buttons (İkon-yalnız, sade beyaz/gri, renksiz) */}
                                  {cards.length > 0 && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActivePopover((prev) =>
                                            prev?.messageId === msg.id && prev.targetPool === 'radar'
                                              ? null
                                              : {
                                                  messageId: msg.id,
                                                  targetPool: 'radar',
                                                  cards,
                                                  selectedTitles: new Set(),
                                                }
                                          );
                                        }}
                                        title="Radara Ekle"
                                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                          activePopover?.messageId === msg.id && activePopover.targetPool === 'radar'
                                            ? 'bg-white/15 text-white'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                      >
                                        <ThumbsUp className="w-4 h-4" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActivePopover((prev) =>
                                            prev?.messageId === msg.id && prev.targetPool === 'blacklist'
                                              ? null
                                              : {
                                                  messageId: msg.id,
                                                  targetPool: 'blacklist',
                                                  cards,
                                                  selectedTitles: new Set(),
                                                }
                                          );
                                        }}
                                        title="Kara Listeye Al"
                                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                          activePopover?.messageId === msg.id && activePopover.targetPool === 'blacklist'
                                            ? 'bg-white/15 text-white'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                      >
                                        <ThumbsDown className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}

                                  {/* Refresh / Regenerate button */}
                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleRegenerate(msg.id)}
                                    title="Farklı Önerilerle Yeniden Yanıtla"
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                      isLoading
                                        ? 'opacity-40 cursor-not-allowed text-slate-500'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 active:scale-95'
                                    }`}
                                  >
                                    <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                  </button>

                                  {/* Time placed right next to icons */}
                                  <span className="text-[11px] font-mono text-slate-200 font-medium ml-1 select-none">
                                    {new Date(msg.timestamp).toLocaleTimeString('tr-TR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>

                                  {/* Minimal Pop-up directly anchored ABOVE like/dislike buttons */}
                                  {activePopover?.messageId === msg.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute bottom-full mb-2 left-0 z-40 w-64 sm:w-72 bg-[#181e2e]/98 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150"
                                    >
                                      {/* Header */}
                                      <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                                          {activePopover.targetPool === 'radar' ? (
                                            <>
                                              <Target className="w-3.5 h-3.5 text-emerald-400" />
                                              <span>Radara Ekle</span>
                                            </>
                                          ) : (
                                            <>
                                              <Ban className="w-3.5 h-3.5 text-rose-400" />
                                              <span>Kara Listeye Al</span>
                                            </>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setActivePopover(null)}
                                          className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {/* Minimal Checklist */}
                                      <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-0.5">
                                        {activePopover.cards.map((c, cIdx) => {
                                          const isChecked = activePopover.selectedTitles.has(c.title);
                                          const memItem = findMemoryItem(
                                            recommendationMemory,
                                            c.title,
                                            c.mainTab
                                          );

                                          return (
                                            <div
                                              key={`${c.title}-${cIdx}`}
                                              onClick={() => {
                                                const nextSet = new Set(activePopover.selectedTitles);
                                                if (isChecked) {
                                                  nextSet.delete(c.title);
                                                } else {
                                                  nextSet.add(c.title);
                                                }
                                                setActivePopover({
                                                  ...activePopover,
                                                  selectedTitles: nextSet,
                                                });
                                              }}
                                              className={`flex items-center justify-between p-1.5 rounded-lg border transition-colors cursor-pointer select-none text-xs ${
                                                isChecked
                                                  ? 'bg-white/10 border-white/20 text-white'
                                                  : 'bg-black/30 border-transparent text-slate-300 hover:bg-white/5'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div
                                                  className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 transition-colors ${
                                                    isChecked
                                                      ? 'bg-indigo-600 border-indigo-500 text-white'
                                                      : 'border-white/30 bg-black/40'
                                                  }`}
                                                >
                                                  {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                                </div>
                                                <span className="truncate font-medium">
                                                  {c.title}
                                                  {c.releaseYear && (
                                                    <span className="text-slate-400 text-[11px] ml-1">
                                                      ({c.releaseYear})
                                                    </span>
                                                  )}
                                                </span>
                                              </div>

                                              {memItem && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 shrink-0 ml-1">
                                                  {memItem.pool === 'radar'
                                                    ? '🎯 Radar'
                                                    : memItem.pool === 'blacklist'
                                                    ? '🚫 Kara Liste'
                                                    : '📦 Arşiv'}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Minimal Action Footer */}
                                      <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px]">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const allSelected =
                                              activePopover.selectedTitles.size ===
                                              activePopover.cards.length;
                                            setActivePopover({
                                              ...activePopover,
                                              selectedTitles: allSelected
                                                ? new Set()
                                                : new Set(activePopover.cards.map((c) => c.title)),
                                            });
                                          }}
                                          className="text-slate-400 hover:text-white underline cursor-pointer"
                                        >
                                          {activePopover.selectedTitles.size === activePopover.cards.length
                                            ? 'Kaldır'
                                            : 'Tümü'}
                                        </button>

                                        <button
                                          type="button"
                                          disabled={activePopover.selectedTitles.size === 0}
                                          onClick={() => {
                                            const selected = Array.from(activePopover.selectedTitles);
                                            setRecommendationMemory((prev) =>
                                              batchMoveItemsToPool(
                                                prev,
                                                selected,
                                                activePopover.targetPool,
                                                activePopover.cards
                                              )
                                            );
                                            showToast(
                                              activePopover.targetPool === 'radar'
                                                ? `${selected.length} yapım Radara eklendi! 🎯`
                                                : `${selected.length} yapım Kara Listeye alındı! 🚫`
                                            );
                                            setActivePopover(null);
                                          }}
                                          className={`px-2.5 py-1 font-semibold text-white rounded-lg transition-all cursor-pointer ${
                                            activePopover.targetPool === 'radar'
                                              ? 'bg-emerald-600 hover:bg-emerald-500'
                                              : 'bg-rose-600 hover:bg-rose-500'
                                          } ${
                                            activePopover.selectedTitles.size === 0
                                              ? 'opacity-40 cursor-not-allowed'
                                              : 'active:scale-95'
                                          }`}
                                        >
                                          Tamam ({activePopover.selectedTitles.size})
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Right: Model Label (Subtle & Alone) */}
                                <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 shrink-0 select-none">
                                  {msg.model && (
                                    <span>{formatAssistantModelLabel(msg.model)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Assistant Loading / Typing Indicator (Clean & Boxless) */}
          {isLoading && (
            <div className="w-full py-2 flex items-center gap-2.5 text-slate-300 text-xs sm:text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
              <span className="text-slate-300 font-medium">Kütüphaneniz inceleniyor...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Bottom Bar Area */}
        <div className="p-3 sm:p-4 pt-1 bg-gradient-to-t from-[#141824] via-[#141824]/95 to-transparent shrink-0">
          {/* Floating Pill Input Box (Textarea with Enter for newline, Ctrl+Enter or ArrowUp button to submit) */}
          <div className="bg-[#1c2234]/95 border border-white/15 hover:border-white/25 focus-within:border-blue-400/60 focus-within:ring-2 focus-within:ring-blue-500/20 backdrop-blur-xl rounded-2xl px-3 py-1.5 sm:py-2 flex items-center gap-2 shadow-2xl shadow-black/70 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              id="ai-assistant-prompt-input"
              value={inputText}
              disabled={isLoading}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isLoading
                  ? 'Asistan yanıt hazırlıyor...'
                  : isListening
                  ? 'Mikrofon dinleniyor, konuşabilirsiniz...'
                  : 'İstediğin bir şeyi sor'
              }
              className="flex-1 bg-transparent px-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none min-w-0 resize-none max-h-[125px] overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden disabled:opacity-60 leading-normal py-1 self-center"
            />

            {/* Right Controls: Voice Mic + Send (ArrowUp) Button */}
            <div className="flex items-center gap-1.5 shrink-0 self-center">
              {/* Mic button */}
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                disabled={isLoading}
                title={isListening ? 'Ses dinlemeyi durdur' : 'Sesle Yazdır (Mikrofon)'}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse ring-2 ring-rose-400/50 shadow-lg shadow-rose-500/40'
                    : 'bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Send or Stop button */}
              {isLoading ? (
                <button
                  type="button"
                  id="ai-assistant-stop-btn"
                  onClick={handleAbort}
                  title="Yanıtı Durdur"
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 bg-white/15 hover:bg-white/25 text-white shadow-lg relative group"
                >
                  <Loader2 className="w-5 h-5 animate-spin text-white/70 group-hover:text-white" />
                  <div className="absolute w-2 h-2 rounded-[2px] bg-white" />
                </button>
              ) : (
                <button
                  type="button"
                  id="ai-assistant-send-btn"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim()}
                  title="Gönder (Ctrl + Enter)"
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    inputText.trim()
                      ? 'bg-white/20 hover:bg-white/30 text-white cursor-pointer active:scale-95 shadow'
                      : 'bg-white/5 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        </>
      )}
      </div>

      {/* Tam Ekran Galeri & Sahne Lightbox Önizleme Modalı */}
      {lightboxGallery && (
        <div
          id="ai-assistant-lightbox"
          className="fixed inset-0 z-[70] bg-black/92 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200 select-none"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLightboxGallery(null);
          }}
        >
          {/* Kapat Butonu (Sağ Üst Köşede) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxGallery(null);
            }}
            title="Kapat (ESC veya Dışarı Tıkla)"
            className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer z-40 active:scale-95 shadow-xl"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Görsel + Yanlarına Yapışık Oklar Konteyneri */}
          <div
            className="relative flex items-center justify-center max-w-full max-h-[82vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sol Ok Butonu (Resme Tam Yapışık) */}
            {lightboxGallery.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxGallery((prev) =>
                    prev
                      ? {
                          ...prev,
                          currentIndex:
                            (prev.currentIndex - 1 + prev.images.length) % prev.images.length,
                        }
                      : null
                  );
                }}
                title="Önceki Görsel (Sol Ok Tuşu)"
                className="absolute -left-4 sm:-left-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/75 hover:bg-black/95 backdrop-blur-md border border-white/25 hover:border-white/50 text-white flex items-center justify-center transition-all cursor-pointer z-30 shadow-2xl active:scale-90"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Ana Görsel */}
            <img
              src={lightboxGallery.images[lightboxGallery.currentIndex]}
              alt={`Sahne ${lightboxGallery.currentIndex + 1}`}
              className="max-w-[86vw] sm:max-w-4xl max-h-[78vh] object-contain rounded-2xl shadow-2xl border border-white/15 animate-in zoom-in-95 duration-150"
            />

            {/* Sağ Ok Butonu (Resme Tam Yapışık) */}
            {lightboxGallery.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxGallery((prev) =>
                    prev
                      ? {
                          ...prev,
                          currentIndex: (prev.currentIndex + 1) % prev.images.length,
                        }
                      : null
                  );
                }}
                title="Sonraki Görsel (Sağ Ok Tuşu)"
                className="absolute -right-4 sm:-right-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/75 hover:bg-black/95 backdrop-blur-md border border-white/25 hover:border-white/50 text-white flex items-center justify-center transition-all cursor-pointer z-30 shadow-2xl active:scale-90"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Resmin Hemen Altındaki Sayaç (4 / 4) */}
          {lightboxGallery.images.length > 1 && (
            <div
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-xs font-mono text-indigo-300 font-semibold shadow-xl select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <span>
                {lightboxGallery.currentIndex + 1} / {lightboxGallery.images.length}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
