import { AppData, TierRow } from '../types';
import { MEDIA_50_ITEMS } from './mediaItems';
import { GAME_50_ITEMS } from './gameItems';

export const DEFAULT_TIER_COLORS = [
  '#e05252', // S - Red
  '#e0a052', // A - Orange
  '#dede52', // B - Yellow
  '#7fbf5f', // C - Green
  '#5f9fbf', // D - Blue
  '#8a6fbf', // F - Purple
];

export function createDefaultTierRows(): TierRow[] {
  const names = ['S', 'A', 'B', 'C', 'D', 'F'];
  return names.map((name, i) => ({
    id: `row_${name.toLowerCase()}_${Date.now()}_${i}`,
    name,
    color: DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length],
  }));
}

export const MEDIA_COLORS: Record<string, string> = {
  dizi: '#404040',
  anime: '#525252',
  film: '#737373',
  belgesel: '#262626',
};

export const GAME_COLORS: Record<string, string> = {
  fps: '#404040',
  rpg: '#525252',
  metroidvania: '#737373',
  aksiyon: '#262626',
  strateji: '#383838',
};

export const INITIAL_DATA: AppData = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  categories: {
    media: [],
    game: [],
  },
  items: [],
};
