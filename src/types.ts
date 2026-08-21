export type MainTabType = 'media' | 'game';

export type GameStatus = 'Oynanıyor' | 'Tamamlandı' | 'Yarım Bırakıldı';

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

  // Game specific
  status?: GameStatus;
  achPercent?: number | null;
  achMax?: number;
  hours?: number;

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
}

export type AppTheme = 'pure-dark' | 'charcoal-gray' | 'dark-slate';

export interface ViewSettings {
  showTitleOnPoster: boolean;
  showRating: boolean;
  cardSize: number; // 1 to 5
  theme?: AppTheme;
}
