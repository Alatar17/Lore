import { ArchiveItem, MainTabType, TagFieldKey, MEDIA_TAG_FIELDS, GAME_TAG_FIELDS } from '../types';

/**
 * Returns all unique tags for a specific field across items belonging to a mainTab.
 * Field scope is strictly isolated.
 */
export function getFieldScopedTags(
  items: ArchiveItem[],
  mainTab: MainTabType,
  field: TagFieldKey
): string[] {
  const tagSet = new Set<string>();
  for (const item of items) {
    if (item.mainTab !== mainTab) continue;
    const values = item[field as keyof ArchiveItem] as string[] | undefined;
    if (Array.isArray(values)) {
      for (const val of values) {
        if (typeof val === 'string' && val.trim().length > 0) {
          tagSet.add(val.trim());
        }
      }
    }
  }
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' }));
}

/**
 * Returns a map of tag to item count for a specific field.
 */
export function getFieldScopedTagCounts(
  items: ArchiveItem[],
  mainTab: MainTabType,
  field: TagFieldKey
): Map<string, number> {
  const countMap = new Map<string, number>();
  for (const item of items) {
    if (item.mainTab !== mainTab) continue;
    const values = item[field as keyof ArchiveItem] as string[] | undefined;
    if (Array.isArray(values)) {
      for (const val of values) {
        if (typeof val === 'string' && val.trim().length > 0) {
          const trimmed = val.trim();
          countMap.set(trimmed, (countMap.get(trimmed) || 0) + 1);
        }
      }
    }
  }
  return countMap;
}

/**
 * Renames a tag in all matching items for a specific mainTab and field.
 */
export function renameTagInItems(
  items: ArchiveItem[],
  mainTab: MainTabType,
  field: TagFieldKey,
  oldTag: string,
  newTag: string
): ArchiveItem[] {
  const trimmedOld = oldTag.trim();
  const trimmedNew = newTag.trim();
  if (!trimmedNew || trimmedOld === trimmedNew) return items;

  return items.map((item) => {
    if (item.mainTab !== mainTab) return item;
    const values = item[field as keyof ArchiveItem] as string[] | undefined;
    if (!Array.isArray(values) || !values.includes(trimmedOld)) return item;

    // Replace oldTag with newTag (deduplicating if newTag already present)
    const newValuesSet = new Set<string>();
    for (const v of values) {
      if (v === trimmedOld) {
        newValuesSet.add(trimmedNew);
      } else {
        newValuesSet.add(v);
      }
    }

    return {
      ...item,
      [field]: Array.from(newValuesSet),
      updatedAt: Date.now(),
    };
  });
}

/**
 * Removes a tag from all matching items for a specific mainTab and field.
 */
export function removeTagFromItems(
  items: ArchiveItem[],
  mainTab: MainTabType,
  field: TagFieldKey,
  tagToRemove: string
): ArchiveItem[] {
  const trimmed = tagToRemove.trim();
  return items.map((item) => {
    if (item.mainTab !== mainTab) return item;
    const values = item[field as keyof ArchiveItem] as string[] | undefined;
    if (!Array.isArray(values) || !values.includes(trimmed)) return item;

    const newValues = values.filter((v) => v !== trimmed);
    return {
      ...item,
      [field]: newValues,
      updatedAt: Date.now(),
    };
  });
}
