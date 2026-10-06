import { describe, expect, it } from 'vitest';

import { detectCategory } from './search-keywords';

describe('detectCategory', () => {
  it('turns business keywords into a category, in Spanish or English', () => {
    expect(detectCategory('vet')).toEqual({ category: 'veterinarian', words: '' });
    expect(detectCategory('Veterinario')).toEqual({ category: 'veterinarian', words: '' });
    expect(detectCategory('estética canina')).toEqual({ category: 'groomer', words: '' });
    expect(detectCategory('pet shop')).toEqual({ category: 'pet_store', words: '' });
    expect(detectCategory('Crematorio')).toEqual({ category: 'pet_funeral', words: '' });
  });

  it('keeps other words for the name search and drops fillers left alone', () => {
    expect(detectCategory('vet huellitas')).toEqual({
      category: 'veterinarian',
      words: 'huellitas',
    });
    expect(detectCategory('tienda de mascotas en')).toEqual({ category: 'pet_store', words: '' });
    expect(detectCategory('huellitas')).toEqual({ category: null, words: 'huellitas' });
  });

  it('uses the first keyword only', () => {
    expect(detectCategory('hospital vet')).toEqual({ category: 'vet_hospital', words: 'vet' });
  });
});
