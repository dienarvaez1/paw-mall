import { expandAlias, plainText, searchTokens } from '@pet-helper/shared';

/**
 * What the search box's suggestions match against: a pet business or pet-friendly place (from
 * the API's search around the user), or a place name (a colonia, city or landmark).
 */
export interface SearchableItem {
  /** Unique among the suggestions ("business:123", "area:Zócalo|Ciudad de México"). */
  readonly id: string;
  readonly kind: 'business' | 'area';
  readonly name: string;
  /** The business's categories ("Veterinaria · Estética"), or the area's kind ("Ciudad"). */
  readonly category: string | null;
  /** Where it is: the business's city or alcaldía, the area's municipality. */
  readonly neighborhood: string | null;
  readonly state: string | null;
}

/** The words an item can be found by: its name, category, neighborhood and state. */
function itemWords(item: SearchableItem): string[] {
  return searchTokens(
    [item.name, item.category, item.neighborhood, item.state].filter(Boolean).join(' '),
  );
}

/**
 * Whether every typed token starts one of the item's words, in any order (so "CDMX veterinaria"
 * and "veterinaria CDMX" find the same places). An alias must match all its words: "cdmx" is
 * "ciudad de mexico".
 */
export function matchesAllTokens(item: SearchableItem, tokens: readonly string[]): boolean {
  const words = itemWords(item);
  return tokens.every((token) =>
    expandAlias(token).every((part) => words.some((word) => word.startsWith(part))),
  );
}

/**
 * The items matching the typed text in any word order, best first: names that start with the
 * text as typed, then names holding more of the typed words themselves (not just in the category
 * or the neighborhood), then the rest as given (the API's order: nearest first, or the busiest
 * place names). Nothing for text without words.
 */
export function filterSearchItems<T extends SearchableItem>(
  items: readonly T[],
  query: string,
  limit: number,
): T[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  const typed = plainText(query).trim();
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id) || !matchesAllTokens(item, tokens)) return false;
      seen.add(item.id);
      return true;
    })
    .map((item, index) => {
      const nameWords = searchTokens(item.name);
      const inName = tokens.filter((token) =>
        expandAlias(token).every((part) => nameWords.some((word) => word.startsWith(part))),
      ).length;
      return { item, index, startsWith: plainText(item.name).startsWith(typed), inName };
    })
    .sort(
      (a, b) =>
        Number(b.startsWith) - Number(a.startsWith) || b.inName - a.inName || a.index - b.index,
    )
    .slice(0, limit)
    .map(({ item }) => item);
}
