/** A saved place: its id and when it was saved (ms since epoch). */
export type Favorite = { id: number; savedAt: number };

/**
 * Keeps only well-formed entries, one per place, newest first, so an old or corrupted stored
 * value falls back to what can be read (or nothing).
 */
export function parseFavorites(raw: string | null): Favorite[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    const seen = new Set<number>();
    return value
      .filter(
        (item): item is Favorite =>
          typeof item === 'object' &&
          item !== null &&
          Number.isInteger((item as Favorite).id) &&
          typeof (item as Favorite).savedAt === 'number',
      )
      .sort((a, b) => b.savedAt - a.savedAt)
      .filter((item) => !seen.has(item.id) && seen.add(item.id));
  } catch {
    return [];
  }
}

/** Saves the place on top, or removes it if it was saved. */
export function toggleFavorite(list: Favorite[], id: number, now: number): Favorite[] {
  return list.some((item) => item.id === id)
    ? list.filter((item) => item.id !== id)
    : [{ id, savedAt: now }, ...list];
}
