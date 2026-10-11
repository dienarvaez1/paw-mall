/**
 * List pages are fetched at different times; when places gain or lose a policy in between, offsets
 * shift and a place can come back on the next page. Keeps each place's first appearance.
 */
export function uniqueById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => !seen.has(item.id) && seen.add(item.id));
}
