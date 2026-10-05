/** Whether a listing from another source (e.g. Google) is the same business as one of our places. */

/** A listing must be this close… */
export const MAX_MATCH_DISTANCE_M = 150;
/** …and its name this similar (Jaro-Winkler on normalized names), unless one contains the other. */
export const MIN_NAME_SIMILARITY = 0.85;

const SHARED_WORDS =
  /\b(veterinaria|veterinario|clinica|consultorio|hospital|estetica|canina|canino|mascotas?|tienda|forrajeria|forrajera|y|de|del|la|el|los|las|para|sa|cv|s a|c v)\b/g;

/** Lower-case, accent-free name without words many pet businesses share. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(SHARED_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - window); j < Math.min(b.length, i + window + 1); j++) {
      if (!bMatched[j] && a[i] === b[j]) {
        aMatched[i] = bMatched[j] = true;
        matches++;
        break;
      }
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  for (let i = 0, j = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[j]) j++;
    if (a[i] !== b[j]) transpositions++;
    j++;
  }
  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function isSamePlace(
  place: { name: string; lat: number; lng: number },
  listing: { name: string | null; location: { lat: number; lng: number } | null },
): boolean {
  if (!listing.name || !listing.location) return false;
  if (distanceMeters(place, listing.location) > MAX_MATCH_DISTANCE_M) return false;
  const a = normalizeName(place.name);
  const b = normalizeName(listing.name);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a) || jaroWinkler(a, b) >= MIN_NAME_SIMILARITY;
}
