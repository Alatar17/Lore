import type { Card } from 'ts-fsrs';

export type MainTabType = 'media' | 'game' | 'book';

export type MediaStatus =
  | 'Tamamlandı'
  | 'İzlenecek'
  | 'İzleniyor'
  | 'Yarım Bırakıldı';

export type GameStatus =
  | 'Tamamlandı'
  | 'Oynanacak'
  | 'Oynanıyor'
  | 'Yarım Bırakıldı'
  | '%100 Başarım';

export type BookStatus =
  | 'Tamamlandı'
  | 'Okunacak'
  | 'Okunuyor'
  | 'Yarım Bırakıldı';

export type BookFormat = 'Ciltsiz' | 'Ciltli' | 'E-Kitap' | 'Sesli Kitap';

export interface BookQuote {
  id: string;
  text: string;
  page?: number | string;
}

export interface TierRow {
  id: string;
  name: string;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  subgroups: string[];
  tierEnabled: boolean;
  tierRows: TierRow[];
  tierSubgroups?: string[];
}

export function isTierListAvailable(
  category: Category | null | undefined,
  activeSub: string | null | undefined
): boolean {
  if (!category || !category.tierEnabled) return false;

  // If category has no subgroups, tier list is available for the whole category
  if (!category.subgroups || category.subgroups.length === 0) {
    return true;
  }

  const enabledSubs = category.tierSubgroups ?? category.subgroups;

  // If activeSub is selected (e.g. Anime > Film)
  if (activeSub) {
    return enabledSubs.includes(activeSub);
  }

  // If activeSub is null (general category view, e.g. Anime)
  // Available as long as at least one subgroup has tier list enabled
  return enabledSubs.length > 0;
}

export function getMediaStatus(item: Partial<ArchiveItem>): MediaStatus {
  if (item.mediaStatus) return item.mediaStatus;
  if (item.toWatch) return 'İzlenecek';
  if (item.watching) return 'İzleniyor';
  if (item.dropped) return 'Yarım Bırakıldı';
  return 'Tamamlandı';
}

export function getBookStatus(item: Partial<ArchiveItem>): BookStatus {
  if (item.bookStatus) return item.bookStatus;
  if (item.toRead) return 'Okunacak';
  if (item.reading) return 'Okunuyor';
  if (item.dropped) return 'Yarım Bırakıldı';
  return 'Tamamlandı';
}

export function getGameStatus(item: Partial<ArchiveItem>): GameStatus {
  if (item.status) return item.status;
  return 'Tamamlandı';
}

export function isPlannedItem(item: Partial<ArchiveItem> | null | undefined): boolean {
  if (!item) return false;
  if (item.mainTab === 'game') return getGameStatus(item) === 'Oynanacak';
  if (item.mainTab === 'book') return getBookStatus(item) === 'Okunacak';
  if (item.mainTab === 'media') return getMediaStatus(item) === 'İzlenecek';
  return (
    getMediaStatus(item) === 'İzlenecek' ||
    getGameStatus(item) === 'Oynanacak' ||
    getBookStatus(item) === 'Okunacak'
  );
}

export function isOngoingItem(item: Partial<ArchiveItem> | null | undefined): boolean {
  if (!item) return false;
  if (item.mainTab === 'game') return getGameStatus(item) === 'Oynanıyor';
  if (item.mainTab === 'book') return getBookStatus(item) === 'Okunuyor';
  if (item.mainTab === 'media') return getMediaStatus(item) === 'İzleniyor';
  return (
    getMediaStatus(item) === 'İzleniyor' ||
    getGameStatus(item) === 'Oynanıyor' ||
    getBookStatus(item) === 'Okunuyor'
  );
}

export interface ItemCharacter {
  name: string;
  actor?: string;
  image?: string;
}

export interface AnkiBlurBox {
  id: string;
  x: number;      // % cinsinden (0-100)
  y: number;      // % cinsinden (0-100)
  width: number;  // % cinsinden
  height: number; // % cinsinden
}

export interface AnkiExtraImage {
  id: string;
  url: string;             // sadece 2. ve 3. sahne görselleri için base64 / path
  blurs: AnkiBlurBox[];    // bu ek görsele özel bağımsız blur kutuları
  fileName?: string;       // images/ klasöründeki dosya referansı (örn: images/item_extra_1.jpg)
}

export interface ArchiveItem {
  id: string;
  mainTab: MainTabType;
  title: string;
  cat: string; // category id
  sub: string | null;
  rating: number; // 1-10
  date: string; // YYYY-MM-DD (İzlenme/Tamamlama tarihi)
  lastCompletedDate?: string; // Hatırlanan son tamamlanma/izlenme tarihi
  releaseYear?: number | string; // Yapım Yılı (örn: 2024 veya '2021 - 2026')
  desc: string;
  thumbnail?: string; // base64 or object URL or image path
  thumbnailFileName?: string;

  // Media specific
  watching?: boolean;
  following?: boolean;
  dropped?: boolean;
  toWatch?: boolean;
  mediaStatus?: MediaStatus;
  expectedDate?: string; // Beklenen Çıkış / Dönem (örn: '2027', '2026 Güz', '2025 Sonu')
  followNotes?: string; // Takip notları ve gelişmeler (örn: '3. sezon duyuruldu, stüdyo değişti')

  // Game specific
  status?: GameStatus;
  achPercent?: number | null;
  achMax?: number;
  hours?: number;

  // Book specific
  reading?: boolean; // Okunuyor...
  toRead?: boolean; // Okunacak...
  bookStatus?: BookStatus;
  pageCount?: number; // Sayfa Sayısı
  format?: BookFormat; // Baskı / Format Türü (Ciltsiz, Ciltli, E-Kitap, Sesli Kitap)
  author?: string[]; // Yazar(lar)
  publisher?: string[]; // Yayınevi
  translator?: string[]; // Çevirmen(ler)
  quotes?: BookQuote[]; // Beğenilen Sözler / Alıntılar

  // Field-Scoped Tags
  // Media fields: firm (Firma/Stüdyo), director (Yönetmen), actors (Oyuncular), genre (Tür)
  // Game fields: developer (Geliştirici), genre (Tür)
  // Book fields: author (Yazar), publisher (Yayınevi), translator (Çevirmen), genre (Tür)
  firm?: string[];
  director?: string[];
  actors?: string[];
  developer?: string[];
  genre?: string[];

  // Characters & Cast
  characters?: ItemCharacter[];

  // Series / Franchise (Bağlantılı Yapımlar)
  seriesName?: string; // Seri / Evren Adı (örn: 'Jujutsu Kaisen', 'Harry Potter')
  seriesOrder?: number; // İzleme / Seri Sırası (örn: 1, 2, 3)

  // Kişisel Yorum / İnceleme Alanı
  review?: string; // Kullanıcının yazdığı kişisel eleştiri/yorum metni
  reviewDate?: string; // Yorumun yazıldığı/güncellendiği tarih (Opsiyonel: YYYY-MM-DD)

  // Common
  anki: boolean;
  ankiCard?: Card;
  ankiMainBlurs?: AnkiBlurBox[];
  ankiExtraImages?: AnkiExtraImage[];
  ankiFrontTags?: string[]; // Anki kartı ön yüzünde başlık altında gösterilecek künye etiketleri (max 2)
  tier?: string | null; // tier row id or null
  isHidden?: boolean; // Kart gizleme durumu
  badges?: string[]; // Karta atanmış CustomBadge ID listesi (maksimum 4 adet)
  createdAt?: number;
  updatedAt?: number;
}

export interface CustomBadge {
  id: string; // Benzersiz kimlik (örn: 'badge_1789301234')
  name: string; // Rozet Adı (örn: 'En İyi Metroidvania')
  iconData: string; // Görselin base64 / dataUrl verisi (optimize edilmiş 64x64 / 80x80 şeffaf)
  color: string; // Rozet glow / vurgu rengi (örn: '#f59e0b', 'gold', vb.)
  targetTab: 'media' | 'game' | 'book'; // Medya, Oyun veya Kitap
  createdAt?: number;
  updatedAt?: number;
}

export interface BadgeColorOption {
  id: string;
  name: string;
  label: string;
  emoji: string;
  hex: string;
  glowClass: string;
  borderClass: string;
  bgLightClass: string;
  ringClass: string;
}

export const BADGE_GLOW_COLORS: BadgeColorOption[] = [
  {
    id: 'gold',
    name: 'Altın',
    label: '🟡 Altın',
    emoji: '🟡',
    hex: '#f59e0b',
    glowClass: 'shadow-[0_0_12px_rgba(245,158,11,0.65)]',
    borderClass: 'border-amber-400',
    bgLightClass: 'bg-amber-500/20 text-amber-300',
    ringClass: 'ring-amber-400',
  },
  {
    id: 'ruby',
    name: 'Yakut',
    label: '🔴 Yakut',
    emoji: '🔴',
    hex: '#ef4444',
    glowClass: 'shadow-[0_0_12px_rgba(239,68,68,0.65)]',
    borderClass: 'border-red-400',
    bgLightClass: 'bg-red-500/20 text-red-300',
    ringClass: 'ring-red-400',
  },
  {
    id: 'emerald',
    name: 'Zümrüt',
    label: '🟢 Zümrüt',
    emoji: '🟢',
    hex: '#10b981',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.65)]',
    borderClass: 'border-emerald-400',
    bgLightClass: 'bg-emerald-500/20 text-emerald-300',
    ringClass: 'ring-emerald-400',
  },
  {
    id: 'sapphire',
    name: 'Safir',
    label: '🔵 Safir',
    emoji: '🔵',
    hex: '#3b82f6',
    glowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.65)]',
    borderClass: 'border-blue-400',
    bgLightClass: 'bg-blue-500/20 text-blue-300',
    ringClass: 'ring-blue-400',
  },
  {
    id: 'cyan',
    name: 'Buzul',
    label: '🧊 Buzul',
    emoji: '🧊',
    hex: '#06b6d4',
    glowClass: 'shadow-[0_0_12px_rgba(6,182,212,0.65)]',
    borderClass: 'border-cyan-400',
    bgLightClass: 'bg-cyan-500/20 text-cyan-300',
    ringClass: 'ring-cyan-400',
  },
  {
    id: 'amethyst',
    name: 'Ametist',
    label: '🟣 Ametist',
    emoji: '🟣',
    hex: '#a855f7',
    glowClass: 'shadow-[0_0_12px_rgba(168,85,247,0.65)]',
    borderClass: 'border-purple-400',
    bgLightClass: 'bg-purple-500/20 text-purple-300',
    ringClass: 'ring-purple-400',
  },
  {
    id: 'rose',
    name: 'Gül',
    label: '🌸 Gül',
    emoji: '🌸',
    hex: '#ec4899',
    glowClass: 'shadow-[0_0_12px_rgba(236,72,153,0.65)]',
    borderClass: 'border-pink-400',
    bgLightClass: 'bg-pink-500/20 text-pink-300',
    ringClass: 'ring-pink-400',
  },
  {
    id: 'orange',
    name: 'Turuncu',
    label: '🟠 Turuncu',
    emoji: '🟠',
    hex: '#f97316',
    glowClass: 'shadow-[0_0_12px_rgba(249,115,22,0.65)]',
    borderClass: 'border-orange-400',
    bgLightClass: 'bg-orange-500/20 text-orange-300',
    ringClass: 'ring-orange-400',
  },
];

export function getBadgeColorOption(colorKeyOrHex?: string): BadgeColorOption {
  if (!colorKeyOrHex) return BADGE_GLOW_COLORS[0];
  const found = BADGE_GLOW_COLORS.find(
    (c) =>
      c.id === colorKeyOrHex ||
      c.hex.toLowerCase() === colorKeyOrHex.toLowerCase() ||
      c.name.toLowerCase() === colorKeyOrHex.toLowerCase()
  );
  return found || BADGE_GLOW_COLORS[0];
}

export interface BookItem extends ArchiveItem {
  mainTab: 'book';
  reading?: boolean;
  pageCount?: number;
  format?: BookFormat;
  author?: string[];
  publisher?: string[];
  translator?: string[];
  quotes?: BookQuote[];
}

export type RecommendationPoolType = 'radar' | 'blacklist' | 'archive';
export type RecommendationCategory = 'movie' | 'series' | 'anime' | 'animation' | 'game' | 'book';

export interface RecommendationMemoryItem {
  id: string; // Benzersiz kayıt id'si (uuid / timestamp)
  title: string; // Yapım adı (Örn: 'Arrival', 'The Witcher 3')
  releaseYear?: number | string; // Yapım yılı (Örn: 2016)
  mainTab: 'media' | 'game' | 'book'; // 'media', 'game' veya 'book'
  subType?: RecommendationCategory; // 'movie' | 'series' | 'anime' | 'animation' | 'game' | 'book'
  genres?: string[]; // Türler (Örn: ['Bilim Kurgu', 'Gizem'])
  thumbnailUrl?: string; // Küçük afiş linki (Sadece web URL'i, hafif)
  pool: RecommendationPoolType; // 'radar' | 'blacklist' | 'archive'
  recommendedAt: number; // İlk önerilme zaman damgası (Date.now())
  updatedAt?: number; // Havuz değiştirilme tarihi
}

export interface AppData {
  version: number;
  lastUpdated: string;
  categories: {
    media: Category[];
    game: Category[];
    book: Category[];
  };
  items: ArchiveItem[];
  customBadges?: CustomBadge[];
  badgeGlowEnabled?: boolean;
  recommendationMemory?: RecommendationMemoryItem[];
  aiChatHistory?: AiChatMessage[];
}

export type RatingFilterType = 'all' | '9-plus' | '8-plus' | '7-plus' | '6-below' | 'unrated';

export interface FilterState {
  search: string;
  minRating: number;
  ratingFilter?: RatingFilterType;
  watchingOnly: boolean;
  followingOnly: boolean;
  droppedOnly?: boolean;
  readingOnly?: boolean;
  ankiFilter: 'all' | 'yes' | 'no';
  gameStatus?: GameStatus | 'all';
  fullAchOnly?: boolean;
  bookFormat?: BookFormat | 'all';
  uncategorizedOnly?: boolean;
  hiddenOnly?: boolean;
  seriesOnly?: boolean;
  hasBadgesOnly?: boolean;
}

export type AppTheme =
  | 'pure-dark'
  | 'charcoal-gray'
  | 'nordic-frost'
  | 'crimson-night'
  | 'emerald-abyss'
  | 'amethyst-twilight';

export type SortOption =
  | 'date-desc'
  | 'date-asc'
  | 'release-desc'
  | 'release-asc'
  | 'rating-desc'
  | 'rating-asc'
  | 'title-asc'
  | 'title-desc'
  | 'page-desc'
  | 'page-asc';

export type FollowIndicatorModel =
  | 'status-dot'
  | 'color-shift'
  | 'underline-accent';

export type FollowIndicatorColor =
  | 'sky'
  | 'amber'
  | 'emerald'
  | 'purple'
  | 'rose'
  | 'white';

export type FollowIndicatorIconType =
  | 'megaphone'
  | 'bell'
  | 'sparkles'
  | 'info'
  | 'newspaper'
  | 'pin'
  | 'message-square'
  | 'file-text'
  | 'flame'
  | 'zap'
  | 'radio'
  | 'compass'
  | 'calendar'
  | 'clock'
  | 'eye'
  | 'bookmark-check'
  | 'activity'
  | 'alert-circle'
  | 'flag'
  | 'star';

export type RatingIconType =
  | 'star'
  | 'flame'
  | 'heart'
  | 'star-1'
  | 'star-2'
  | 'star-3'
  | 'star-4'
  | 'star-5'
  | 'star-6'
  | 'star-7';

export interface FabPositionCoord {
  bottom: number; // Dikey (Y) mesafe - px
  side: number;   // Yatay (X) mesafe - px (Sol ikonlar için soldan, sağ ikon için sağdan)
}

export interface FabPositions {
  statistics: FabPositionCoord;
  recentActivity: FabPositionCoord;
  ankiHub: FabPositionCoord;
  aiAssistant: FabPositionCoord;
  addItem: FabPositionCoord;
}

export interface FabPositionProfile {
  id: string;
  name: string;
  positions: FabPositions;
  createdAt: number;
}

export const DEFAULT_FAB_POSITIONS: FabPositions = {
  statistics: { bottom: 8, side: 4 },
  recentActivity: { bottom: 8, side: 44 },
  ankiHub: { bottom: 8, side: 84 },
  aiAssistant: { bottom: 8, side: 124 },
  addItem: { bottom: 8, side: 4 },
};

export const DEFAULT_FAB_PROFILES: FabPositionProfile[] = [
  {
    id: 'default',
    name: 'Default',
    positions: {
      statistics: { ...DEFAULT_FAB_POSITIONS.statistics },
      recentActivity: { ...DEFAULT_FAB_POSITIONS.recentActivity },
      ankiHub: { ...DEFAULT_FAB_POSITIONS.ankiHub },
      aiAssistant: { ...DEFAULT_FAB_POSITIONS.aiAssistant },
      addItem: { ...DEFAULT_FAB_POSITIONS.addItem },
    },
    createdAt: 0,
  },
];

export const areFabPositionsEqual = (a?: FabPositions, b?: FabPositions): boolean => {
  if (!a || !b) return false;
  const normA = normalizeFabPositions(a);
  const normB = normalizeFabPositions(b);
  return (
    normA.statistics.bottom === normB.statistics.bottom &&
    normA.statistics.side === normB.statistics.side &&
    normA.recentActivity.bottom === normB.recentActivity.bottom &&
    normA.recentActivity.side === normB.recentActivity.side &&
    normA.ankiHub.bottom === normB.ankiHub.bottom &&
    normA.ankiHub.side === normB.ankiHub.side &&
    normA.aiAssistant.bottom === normB.aiAssistant.bottom &&
    normA.aiAssistant.side === normB.aiAssistant.side &&
    normA.addItem.bottom === normB.addItem.bottom &&
    normA.addItem.side === normB.addItem.side
  );
};

export const normalizeFabPositions = (val: any): FabPositions => {
  if (!val || typeof val !== 'object') {
    return {
      statistics: { ...DEFAULT_FAB_POSITIONS.statistics },
      recentActivity: { ...DEFAULT_FAB_POSITIONS.recentActivity },
      ankiHub: { ...DEFAULT_FAB_POSITIONS.ankiHub },
      aiAssistant: { ...DEFAULT_FAB_POSITIONS.aiAssistant },
      addItem: { ...DEFAULT_FAB_POSITIONS.addItem },
    };
  }
  const toCoord = (c: any, defBottom: number, defSide: number): FabPositionCoord => {
    if (typeof c === 'number') {
      return { bottom: c, side: defSide };
    }
    if (c && typeof c === 'object') {
      return {
        bottom: typeof c.bottom === 'number' ? c.bottom : defBottom,
        side: typeof c.side === 'number' ? c.side : defSide,
      };
    }
    return { bottom: defBottom, side: defSide };
  };

  const statistics = toCoord(val.statistics, DEFAULT_FAB_POSITIONS.statistics.bottom, DEFAULT_FAB_POSITIONS.statistics.side);
  const recentActivity = toCoord(val.recentActivity, DEFAULT_FAB_POSITIONS.recentActivity.bottom, DEFAULT_FAB_POSITIONS.recentActivity.side);
  let ankiHub = toCoord(val.ankiHub, recentActivity.bottom, recentActivity.side + 40);
  let aiAssistant = toCoord(val.aiAssistant, DEFAULT_FAB_POSITIONS.aiAssistant.bottom, DEFAULT_FAB_POSITIONS.aiAssistant.side);

  // If this is legacy saved data without ankiHub or if both share the exact same coordinates
  if (!val.ankiHub || (aiAssistant.side === ankiHub.side && aiAssistant.bottom === ankiHub.bottom)) {
    ankiHub = { bottom: recentActivity.bottom, side: recentActivity.side + 40 };
    if (aiAssistant.side <= ankiHub.side) {
      aiAssistant = { bottom: ankiHub.bottom, side: ankiHub.side + 40 };
    }
  }

  const addItem = toCoord(val.addItem, DEFAULT_FAB_POSITIONS.addItem.bottom, DEFAULT_FAB_POSITIONS.addItem.side);

  return {
    statistics,
    recentActivity,
    ankiHub,
    aiAssistant,
    addItem,
  };
};

export interface AiRecommendationCard {
  title: string;
  releaseYear?: number | string;
  mainTab?: 'media' | 'game' | 'book';
  badge?: string; // 🎯 KÜTÜPHANE İMZASI | 🌀 FARKLI BİR TAT | 🔮 SIRADIŞI KEŞİF
  matchScore?: number; // % uyum skoru (60 - 99)
  shortDesc: string;
  detailedDesc: string;
  matchReason: string;
  thumbnailUrl?: string;
  galleryImages?: string[];
  firms?: string[];
  directors?: string[];
  developers?: string[];
  authors?: string[];
  publishers?: string[];
  translators?: string[];
  genres?: string[];
}

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  model?: string;
  error?: boolean;
  recommendation?: AiRecommendationCard;
  recommendations?: AiRecommendationCard[];
}

export interface ViewSettings {
  showTitle: boolean;
  showAllBadges?: boolean; // Controls master visibility of all card badges across media, game, and book
  showRating: boolean;
  showYear: boolean;
  showAnki: boolean;
  showWatching: boolean;
  showFollowing: boolean;
  showGameStatus: boolean;
  cardSize: number; // 1 to 5
  sortBy?: SortOption; // Default: 'date-desc'
  theme?: AppTheme;
  backdropBlur?: boolean; // Controls background blur for modals and overlays
  showQuickAppearanceBar?: boolean; // Show bottom floating appearance bar
  followIndicatorModel?: FollowIndicatorModel;
  followIndicatorColor?: FollowIndicatorColor;
  followIndicatorIcon?: FollowIndicatorIconType;
  ratingIcon?: RatingIconType;
  fabPositions?: FabPositions;
  fabProfiles?: FabPositionProfile[];
  showAnkiSimulator?: boolean; // Controls visibility of the virtual time simulator bar in Anki Hub
  badgeGlowEnabled?: boolean; // Rozet parıltısı (glow) efekti açık / kapalı
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  showTitle: false,
  showAllBadges: true,
  showRating: true,
  showYear: true,
  showAnki: false,
  showWatching: true,
  showFollowing: true,
  showGameStatus: true,
  cardSize: 3,
  theme: 'pure-dark',
  showQuickAppearanceBar: false,
  followIndicatorModel: 'underline-accent',
  followIndicatorColor: 'sky',
  followIndicatorIcon: 'megaphone',
  ratingIcon: 'star-2',
  fabPositions: DEFAULT_FAB_POSITIONS,
  fabProfiles: DEFAULT_FAB_PROFILES,
  showAnkiSimulator: false,
  badgeGlowEnabled: true,
};

export type ToolbarExperimentStyle = 'default' | 'box' | 'glass';
export type CardVignetteStyle = 'none' | 'bottom' | 'corners';
export type CardCornerRadius = 'normal' | 'sharp';
export type CardHoverMotion = 'lift' | 'zoom' | 'none';
export type BgAtmosphereExperiment = 'default' | 'dots';
export type BadgeExperimentStyle = 'default' | 'neon' | 'minimal';
export type BadgeDensity = 'full' | 'hover-only';
export type TierListCardStyle = 'modern' | 'classic';

export interface UiExperimentsState {
  toolbarStyle: ToolbarExperimentStyle;
  cardGlow?: boolean; // Independent toggle for hover blue border glow (deprecated)
  cardVignette: CardVignetteStyle; // Independent vignette orientation
  cardRadius: CardCornerRadius; // 6.1: Keskin / Standart
  cardHoverMotion: CardHoverMotion; // 6.2: Yükselme / Büyüme / Sabit
  bgAtmosphere: BgAtmosphereExperiment;
  badgeStyle: BadgeExperimentStyle;
  badgeDensity: BadgeDensity; // 6.4: Tam Detay / Hover
  tierListStyle?: TierListCardStyle;
  followIndicatorModel?: FollowIndicatorModel;
  followIndicatorColor?: FollowIndicatorColor;
  followIndicatorIcon?: FollowIndicatorIconType;
  ratingIcon?: RatingIconType;
}

export type MediaTagField = 'firm' | 'director' | 'actors' | 'genre';
export type GameTagField = 'developer' | 'genre';
export type BookTagField = 'author' | 'publisher' | 'translator' | 'genre';
export type TagFieldKey = MediaTagField | GameTagField | BookTagField;

export interface TagFieldDef {
  key: TagFieldKey;
  label: string;
  placeholder: string;
  iconName?: string;
}

export const MEDIA_TAG_FIELDS: TagFieldDef[] = [
  { key: 'firm', label: 'Firma / Stüdyo', placeholder: 'Örn: MAPPA, Warner Bros, Ufotable...' },
  { key: 'director', label: 'Yönetmen', placeholder: 'Örn: Christopher Nolan, Hayao Miyazaki...' },
  { key: 'actors', label: 'Oyuncular / Seslendirme', placeholder: 'Örn: Cillian Murphy, Kenjiro Tsuda...' },
  { key: 'genre', label: 'Tür', placeholder: 'Örn: Aksiyon, Psikolojik, Bilim Kurgu...' },
];

export const GAME_TAG_FIELDS: TagFieldDef[] = [
  { key: 'developer', label: 'Geliştirici / Stüdyo', placeholder: 'Örn: FromSoftware, CD Projekt Red, Valve...' },
  { key: 'genre', label: 'Tür', placeholder: 'Örn: Souls-like, RPG, Roguelike, Açık Dünya...' },
];

export const BOOK_TAG_FIELDS: TagFieldDef[] = [
  { key: 'author', label: 'Yazar', placeholder: 'Örn: George Orwell, Fyodor Dostoyevski, J.R.R. Tolkien...' },
  { key: 'publisher', label: 'Yayınevi', placeholder: 'Örn: Can Yayınları, İthaki, İletişim...' },
  { key: 'translator', label: 'Çevirmen', placeholder: 'Örn: Celal Üster, Roza Hakmen...' },
  { key: 'genre', label: 'Tür', placeholder: 'Örn: Bilimkurgu, Felsefe, Klasik, Distopya...' },
];

export interface TierListCategoryExportData {
  type: 'LORE_TIER_LIST_BACKUP';
  version: number;
  exportedAt: string;
  category: Category;
  mainTab: MainTabType;
  items: ArchiveItem[];
}

export type PcSyncStatus = 'idle' | 'unsynced' | 'syncing' | 'synced' | 'error';
export type MobileSyncStatus = 'idle' | 'has-update' | 'syncing' | 'synced' | 'error';

