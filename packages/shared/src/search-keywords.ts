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
  // Public services
  antirrabico: 'public_vet_service',
  'control canino': 'public_vet_service',
};

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
 * business names. Fillers between words are dropped once a keyword or nothing else is left.
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
        : [KEYWORDS[one], 1];
    if (match && !category) {
      category = match;
      i += length;
    } else {
      kept.push(one);
      i += 1;
    }
  }
  const meaningful = kept.filter((word) => !FILLER.has(word));
  return { category, words: meaningful.length > 0 ? kept.join(' ') : '' };
}
