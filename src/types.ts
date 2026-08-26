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
}

export interface ArchiveItem {
  id: string;
  mainTab: MainTabType;
  title: string;
  cat: string; // category id
  sub: string | null;
  rating: number; // 1-10
  date: string; // YYYY-MM-DD
  desc: string;
  thumbnail?: string; // base64 or object URL or image path
  thumbnailFileName?: string;

  // Media specific
  watching?: boolean;
  following?: boolean;
  dropped?: boolean;

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

  // Common
  anki: boolean;
  tier?: string | null; // tier row id or null
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
}

export type AppTheme =
  | 'pure-dark'
  | 'charcoal-gray'
  | 'dark-slate'
  | 'crimson-night'
  | 'nordic-frost';

export type SortOption =
  | 'date-desc'
  | 'date-asc'
  | 'rating-desc'
  | 'rating-asc'
  | 'title-asc'
  | 'title-desc';

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
}

export type ToolbarExperimentStyle = 'default' | 'box' | 'glass' | 'floating';
export type CardVignetteStyle = 'none' | 'bottom' | 'top' | 'both';
export type CardCornerRadius = 'normal' | 'sharp' | 'soft';
export type CardHoverMotion = 'lift' | 'zoom' | 'none';
export type BgAtmosphereExperiment = 'default' | 'dots';
export type BadgeExperimentStyle = 'default' | 'neon' | 'minimal';
export type BadgeDensity = 'full' | 'compact' | 'hover-only';

export interface UiExperimentsState {
  toolbarStyle: ToolbarExperimentStyle;
  cardGlow: boolean; // Independent toggle for hover blue border glow
  cardVignette: CardVignetteStyle; // Independent vignette orientation
  cardRadius: CardCornerRadius; // 6.1: Keskin / Standart / Kavisli
  cardHoverMotion: CardHoverMotion; // 6.2: Yükselme / Büyüme / Sabit
  bgAtmosphere: BgAtmosphereExperiment;
  badgeStyle: BadgeExperimentStyle;
  badgeDensity: BadgeDensity; // 6.4: Dolu / Sade / Hover
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
