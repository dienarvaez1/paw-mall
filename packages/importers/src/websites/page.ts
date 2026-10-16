// What a business's own homepage says, read on the website check's single visit: weekly hours
// from its schema.org data (openingHoursSpecification or openingHours), and whether it says pets
// are welcome (schema.org petsAllowed, or plain wording such as "pet friendly" or "aceptamos
// mascotas", never when the page also says no to pets).
import type { PlaceHours } from '@pet-helper/shared';

import { parseHoursSpecification, parseOpeningHours } from '../hours/opening-hours.ts';

/** `text`: the page's visible words (lower case, no accents), to check it names the place. */
export type PageFindings = { hours: PlaceHours | null; petFriendly: boolean; text: string };

/** Enough of the page to find the place's name; the rest isn't kept. */
const MAX_TEXT = 200_000;

const JSON_LD =
  /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
const PETS_WELCOME =
  /\b(pet[\s-]?friendly|dog[\s-]?friendly|mascotas?\s+(son\s+)?bienvenid[ao]s|aceptamos\s+mascotas|se\s+aceptan\s+mascotas|se\s+permiten\s+mascotas|admitimos\s+mascotas|tu\s+mascota\s+es\s+bienvenida|pets?\s+(are\s+)?welcome)\b/;
const NO_PETS =
  /\b(no\s+(se\s+)?(aceptan|permiten|admiten)\s+(mascotas|perros|animales)|no\s+pet[\s-]?friendly|sin\s+mascotas|no\s+mascotas|no\s+pets|pets?\s+(are\s+)?not\s+allowed|prohibid[ao]s?\s+(las\s+|los\s+)?(mascotas|perros|animales))\b/;

function plainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function yesNo(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (['true', 'yes', 'si', 'sí'].includes(text)) return true;
  if (['false', 'no'].includes(text)) return false;
  return null;
}

/** The hours and pet answer found in a homepage's HTML. */
export function readPage(html: string): PageFindings {
  let hours: PlaceHours | null = null;
  let petsAllowed: boolean | null = null;
  const visit = (node: unknown, depth: number) => {
    if (depth > 4 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    if (!hours && record.openingHoursSpecification) {
      hours = parseHoursSpecification(record.openingHoursSpecification);
    }
    if (!hours && (typeof record.openingHours === 'string' || Array.isArray(record.openingHours))) {
      hours = parseOpeningHours(record.openingHours as string | string[]);
    }
    if (petsAllowed === null && 'petsAllowed' in record) petsAllowed = yesNo(record.petsAllowed);
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') visit(value, depth + 1);
    }
  };
  for (const match of html.matchAll(JSON_LD)) {
    try {
      visit(JSON.parse(match[1]!.trim()), 0);
    } catch {
      // Broken JSON-LD: ignore that block.
    }
  }
  const text = plainText(html);
  const petFriendly = petsAllowed ?? (PETS_WELCOME.test(text) && !NO_PETS.test(text));
  return { hours, petFriendly, text: text.slice(0, MAX_TEXT) };
}

/** Words too common in business names to tell one place from another. */
const GENERIC = new Set(
  'hotel hoteles hostal suites boutique express plaza restaurante restaurant comida cocina cafe cafeteria coffee bar grill house inn the los las del sucursal mexico ciudad cdmx centro aeropuerto tacos taqueria sushi pizza pizzeria'.split(
    ' ',
  ),
);

/** The distinctive words of a place's name (4+ letters, not GENERIC), at most three. */
export function nameWords(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !GENERIC.has(word))
    .slice(0, 3);
}

/** Whether the page names the place: every distinctive word of its name appears on it. */
export function pageNamesPlace(text: string, name: string | null): boolean {
  const words = nameWords(name ?? '');
  return words.length > 0 && words.every((word) => new RegExp(`\\b${word}\\b`).test(text));
}

/** Hotel groups' homepages speak for all their hotels, never one. */
export const CHAIN_HOMEPAGES = new Set([
  'wyndhamhotels.com',
  'marriott.com',
  'hilton.com',
  'ihg.com',
  'all.accor.com',
  'accor.com',
  'novotel.com',
  'ibis.com',
  'fiestainn.com',
  'fiestamericana.com',
  'posadas.com',
  'hyatt.com',
  'choicehotels.com',
  'bestwestern.com',
  'cityexpress.com',
  'nh-hotels.com',
]);
