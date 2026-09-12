export type MainTabType = 'media' | 'game';

export type GameStatus =
  | 'Oynanıyor'
  | 'Tamamlandı'
  | '%100 Başarım'
  | 'Yarım Bırakıldı'
  | 'Oynanacak';

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

export interface ItemCharacter {
  name: string;
  actor?: string;
  image?: string;
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
  expectedDate?: string; // Beklenen Çıkış / Dönem (örn: '2027', '2026 Güz', '2025 Sonu')
  followNotes?: string; // Takip notları ve gelişmeler (örn: '3. sezon duyuruldu, stüdyo değişti')

  // Game specific
  status?: GameStatus;
  achPercent?: number | null;
  achMax?: number;
  hours?: number;

  // Field-Scoped Tags
  // Media fields: firm (Firma/Stüdyo), director (Yönetmen), actors (Oyuncular), genre (Tür)
  // Game fields: developer (Geliştirici), genre (Tür)
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

  // Common
  anki: boolean;
  tier?: string | null; // tier row id or null
  isHidden?: boolean; // Kart gizleme durumu
  createdAt?: number;
  updatedAt?: number;
}

export interface AppData {
  version: number;
  lastUpdated: string;
  categories: {
    media: Category[];
    game: Category[];
  };
  items: ArchiveItem[];
}

export interface FilterState {
  search: string;
  minRating: number;
  watchingOnly: boolean;
  followingOnly: boolean;
  ankiFilter: 'all' | 'yes' | 'no';
  gameStatus?: GameStatus | 'all';
  uncategorizedOnly?: boolean;
  hiddenOnly?: boolean;
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
  | 'rating-desc'
  | 'rating-asc'
  | 'title-asc'
  | 'title-desc';

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
  addItem: { bottom: 8, side: 4 },
};

export const DEFAULT_FAB_PROFILES: FabPositionProfile[] = [
  {
    id: 'default',
    name: 'Default',
    positions: {
      statistics: { ...DEFAULT_FAB_POSITIONS.statistics },
      recentActivity: { ...DEFAULT_FAB_POSITIONS.recentActivity },
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
    normA.addItem.bottom === normB.addItem.bottom &&
    normA.addItem.side === normB.addItem.side
  );
};

export const normalizeFabPositions = (val: any): FabPositions => {
  if (!val || typeof val !== 'object') {
    return {
      statistics: { ...DEFAULT_FAB_POSITIONS.statistics },
      recentActivity: { ...DEFAULT_FAB_POSITIONS.recentActivity },
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

  return {
    statistics: toCoord(val.statistics, DEFAULT_FAB_POSITIONS.statistics.bottom, DEFAULT_FAB_POSITIONS.statistics.side),
    recentActivity: toCoord(val.recentActivity, DEFAULT_FAB_POSITIONS.recentActivity.bottom, DEFAULT_FAB_POSITIONS.recentActivity.side),
    addItem: toCoord(val.addItem, DEFAULT_FAB_POSITIONS.addItem.bottom, DEFAULT_FAB_POSITIONS.addItem.side),
  };
};

export interface ViewSettings {
  showTitle: boolean;
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
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  showTitle: false,
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
export type TagFieldKey = MediaTagField | GameTagField;

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

export interface TierListCategoryExportData {
  type: 'LORE_TIER_LIST_BACKUP';
  version: number;
  exportedAt: string;
  category: Category;
  mainTab: MainTabType;
  items: ArchiveItem[];
}
