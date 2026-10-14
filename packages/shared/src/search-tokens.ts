/**
 * How the search box's text becomes words, shared by the app's suggestions and the API so both
 * read it the same way: lower case, accents off, punctuation as spaces, and the little words that
 * only join a search together ("vet en Coyoacán", "near me") left out.
 */

/** Words that only join a search ("in", "en", "cerca"…): never required to match. */
export const SEARCH_STOP_WORDS: ReadonlySet<string> = new Set([
  'in',
  'at',
  'near',
  'por',
  'en',
  'para',
]);

/**
 * Short names people type for a place, and the words of how the data writes it: "CDMX" and "DF"
 * are the state "Ciudad de México" (owner's example: "CDMX veterinaria").
 */
export const SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  cdmx: ['ciudad', 'de', 'mexico'],
  df: ['ciudad', 'de', 'mexico'],
};

/** Lower case, without accents ("Coyoacán" → "coyoacan"); ñ stays ñ. */
export function plainText(text: string): string {
  return text.normalize('NFD').replace(/[̀-̂̄-ͯ]/g, '').normalize('NFC').toLowerCase();
}

/**
 * The search words of a text, in the order typed, without stop words; an alias stays one word
 * here ("cdmx"), see expandAlias. Only letters and digits make words: "vet,CDMX!" → vet, cdmx.
 */
export function searchTokens(text: string): string[] {
  return plainText(text)
    .split(/[^a-z0-9ñ]+/)
    .filter((word) => word !== '' && !SEARCH_STOP_WORDS.has(word));
}

/** The words a token stands for: an alias's words ("cdmx" → ciudad de mexico), else itself. */
export function expandAlias(token: string): readonly string[] {
  return SEARCH_ALIASES[token] ?? [token];
}
