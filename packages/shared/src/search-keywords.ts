import type { CategorySlug } from './categories';

/**
 * Words people type for a kind of business, in Spanish and English, already lower-case and
 * without accents. "tlaxcala vet" searches the veterinarian category around Tlaxcala, so vets
 * whose names don't say "veterinario" are found too. Phrases are checked before single words.
 */
const KEYWORDS: Record<string, CategorySlug> = {
  // Veterinarians
  vet: 'veterinarian',
  vets: 'veterinarian',
  veterinario: 'veterinarian',
  veterinarios: 'veterinarian',
  veterinaria: 'veterinarian',
  veterinarias: 'veterinarian',
  veterinary: 'veterinarian',
  veterinarian: 'veterinarian',
  veterinarians: 'veterinarian',
  'clinica veterinaria': 'veterinarian',
  // Hospitals and emergencies
  hospital: 'vet_hospital',
  hospitales: 'vet_hospital',
  'hospital veterinario': 'vet_hospital',
  urgencias: 'vet_hospital',
  emergencias: 'vet_hospital',
  emergency: 'vet_hospital',
  // Pet stores
  tienda: 'pet_store',
  tiendas: 'pet_store',
  petshop: 'pet_store',
  'pet shop': 'pet_store',
  'pet store': 'pet_store',
  'tienda de mascotas': 'pet_store',
  // Pet food (Phase 18, search benchmark): stores, not only names with the word.
  croqueta: 'pet_store',
  croquetas: 'pet_store',
  'alimento para perro': 'pet_store',
  'alimento para perros': 'pet_store',
  'alimento para gato': 'pet_store',
  'alimento para gatos': 'pet_store',
  'alimento para mascotas': 'pet_store',
  'comida para perro': 'pet_store',
  'comida para perros': 'pet_store',
  'comida para gato': 'pet_store',
  'comida para gatos': 'pet_store',
  'comida para mascotas': 'pet_store',
  'pet food': 'pet_store',
  'dog food': 'pet_store',
  'cat food': 'pet_store',
  // Grooming
  estetica: 'groomer',
  esteticas: 'groomer',
  'estetica canina': 'groomer',
  peluqueria: 'groomer',
  grooming: 'groomer',
  groomer: 'groomer',
  // Boarding
  pension: 'boarding',
  pensiones: 'boarding',
  guarderia: 'boarding',
  // A hotel for pets is boarding; a plain "hotel" is lodging (below).
  'hotel para perros': 'boarding',
  'hotel para gatos': 'boarding',
  'hotel para mascotas': 'boarding',
  'hotel canino': 'boarding',
  'hotel de perros': 'boarding',
  'hospedaje para perros': 'boarding',
  'hospedaje para mascotas': 'boarding',
  'dog hotel': 'boarding',
  boarding: 'boarding',
  // Feed stores
  forrajeria: 'feed_store',
  forrajerias: 'feed_store',
  forrajera: 'feed_store',
  forrajes: 'feed_store',
  // Pet funerals
  crematorio: 'pet_funeral',
  crematorios: 'pet_funeral',
  funeraria: 'pet_funeral',
  funerarias: 'pet_funeral',
  cremacion: 'pet_funeral',
  // Dog training
  adiestramiento: 'dog_trainer',
  adiestrador: 'dog_trainer',
  adiestradores: 'dog_trainer',
  'adiestramiento canino': 'dog_trainer',
  'entrenamiento canino': 'dog_trainer',
  'entrenador canino': 'dog_trainer',
  'escuela canina': 'dog_trainer',
  'dog trainer': 'dog_trainer',
  'dog training': 'dog_trainer',
  // Public services
  antirrabico: 'public_vet_service',
  'control canino': 'public_vet_service',
  // Pet-friendly venues (Phase 18): on Pet-friendly, "café" is every café that takes pets.
  restaurante: 'restaurant',
  restaurantes: 'restaurant',
  restaurant: 'restaurant',
  restaurants: 'restaurant',
  cafe: 'cafe',
  cafes: 'cafe',
  cafeteria: 'cafe',
  cafeterias: 'cafe',
  coffee: 'cafe',
  hotel: 'lodging',
  hoteles: 'lodging',
  hospedaje: 'lodging',
  hostal: 'lodging',
  museo: 'museum',
  museos: 'museum',
  museum: 'museum',
  parque: 'park',
  parques: 'park',
  park: 'park',
  'parque para perros': 'park',
  'dog park': 'park',
};

/**
 * Words about the pet, not the business ("pensión para perros", "dog grooming"): once a keyword
 * names the category they add nothing, and required in names they hid most matches (search
 * benchmark, Phase 17).
 */
const PET_WORDS = new Set([
  'perro',
  'perros',
  'perrito',
  'perritos',
  'gato',
  'gatos',
  'gatito',
  'gatitos',
  'mascota',
  'mascotas',
  'canino',
  'canina',
  'caninos',
  'caninas',
  'felino',
  'felina',
  'felinos',
  'animal',
  'animales',
  'dog',
  'dogs',
  'cat',
  'cats',
  'pet',
  'pets',
]);

/** A typo is forgiven only in a word this long, and only one (veterinria → veterinaria). */
const TYPO_MIN_LENGTH = 7;

/**
 * Edit distance between two words, counting a swap of neighbors as one edit (optimal string
 * alignment), stopping early once it's over `max`.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows.push([i]);
  for (let j = 1; j <= b.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, rows[i - 2]![j - 2]! + 1);
      }
      rows[i]![j] = d;
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
  }
  return rows[a.length]![b.length]!;
}

const SINGLE_WORD_KEYWORDS = Object.keys(KEYWORDS).filter((key) => !key.includes(' '));

/** The keyword a long word misspells by one letter, if exactly one category is that close. */
function misspelledKeyword(word: string): CategorySlug | undefined {
  if (word.length < TYPO_MIN_LENGTH || /\d/.test(word)) return undefined;
  const found = new Set(
    SINGLE_WORD_KEYWORDS.filter(
      (key) => key.length >= TYPO_MIN_LENGTH - 1 && editDistance(word, key, 1) <= 1,
    ).map((key) => KEYWORDS[key]!),
  );
  return found.size === 1 ? [...found][0] : undefined;
}

/** Words that only join the others ("vet en tlaxcala", "tienda de mascotas cerca de"). */
const FILLER = new Set([
  'en',
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'cerca',
  'near',
  'in',
  'the',
  'para',
]);

function plainWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/**
 * The category a search's keywords name ("vet" → veterinarian) and the words left to search in
 * business names. A long keyword with one typo still counts ("veterinria"). Once a category is
 * found, later keywords ("urgencias veterinarias") and words about the pet ("pensión para
 * perros") are dropped too, and fillers when nothing else is left.
 */
export function detectCategory(text: string): { category: CategorySlug | null; words: string } {
  const words = plainWords(text);
  let category: CategorySlug | null = null;
  const kept: string[] = [];
  for (let i = 0; i < words.length;) {
    const three = words.slice(i, i + 3).join(' ');
    const two = words.slice(i, i + 2).join(' ');
    const one = words[i] ?? '';
    const [match, length] = KEYWORDS[three]
      ? [KEYWORDS[three], 3]
      : KEYWORDS[two]
        ? [KEYWORDS[two], 2]
        : [KEYWORDS[one] ?? misspelledKeyword(one), 1];
    if (match) {
      category ??= match;
      i += length;
    } else {
      kept.push(one);
      i += 1;
    }
  }
  const left = category ? kept.filter((word) => !PET_WORDS.has(word)) : kept;
  const meaningful = left.filter((word) => !FILLER.has(word));
  return { category, words: meaningful.length > 0 ? left.join(' ') : '' };
}
