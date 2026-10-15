import { describe, expect, it } from 'vitest';

import { detectCategory, editDistance, isPetWord } from './search-keywords';

describe('detectCategory', () => {
  it('turns business keywords into a category, in Spanish or English', () => {
    expect(detectCategory('vet')).toEqual({ category: 'veterinarian', words: '' });
    expect(detectCategory('Veterinario')).toEqual({ category: 'veterinarian', words: '' });
    expect(detectCategory('estética canina')).toEqual({ category: 'groomer', words: '' });
    expect(detectCategory('pet shop')).toEqual({ category: 'pet_store', words: '' });
    expect(detectCategory('Crematorio')).toEqual({ category: 'pet_funeral', words: '' });
    expect(detectCategory('adiestramiento canino')).toEqual({ category: 'dog_trainer', words: '' });
  });

  it('keeps other words for the name search and drops fillers left alone', () => {
    expect(detectCategory('vet huellitas')).toEqual({
      category: 'veterinarian',
      words: 'huellitas',
    });
    expect(detectCategory('tienda de mascotas en')).toEqual({ category: 'pet_store', words: '' });
    expect(detectCategory('huellitas')).toEqual({ category: null, words: 'huellitas' });
  });

  it('uses the first keyword and drops later ones', () => {
    expect(detectCategory('hospital vet')).toEqual({ category: 'vet_hospital', words: '' });
    expect(detectCategory('urgencias veterinarias')).toEqual({
      category: 'vet_hospital',
      words: '',
    });
  });

  it('drops words about the pet once a keyword names the category', () => {
    expect(detectCategory('pensión para perros')).toEqual({ category: 'boarding', words: '' });
    expect(detectCategory('dog grooming')).toEqual({ category: 'groomer', words: '' });
    expect(detectCategory('adiestrador de perros')).toEqual({ category: 'dog_trainer', words: '' });
    expect(detectCategory('vet perrito feliz')).toEqual({
      category: 'veterinarian',
      words: 'feliz',
    });
    // Without a keyword they're ordinary words of a name.
    expect(detectCategory('perros felices')).toEqual({ category: null, words: 'perros felices' });
  });

  it('forgives one typo in a long keyword', () => {
    expect(detectCategory('veterinria')).toEqual({ category: 'veterinarian', words: '' });
    expect(detectCategory('esteitca canina')).toEqual({ category: 'groomer', words: '' });
    // Short words and plain names aren't stretched to a keyword.
    expect(detectCategory('vt')).toEqual({ category: null, words: 'vt' });
    expect(detectCategory('huellitas')).toEqual({ category: null, words: 'huellitas' });
  });

  it('knows pet food, pet hotels and pet-friendly venues', () => {
    expect(detectCategory('croquetas').category).toBe('pet_store');
    expect(detectCategory('alimento para perro').category).toBe('pet_store');
    expect(detectCategory('hotel para perros')).toEqual({ category: 'boarding', words: '' });
    expect(detectCategory('hotel').category).toBe('lodging');
    expect(detectCategory('Café').category).toBe('cafe');
    expect(detectCategory('restaurante').category).toBe('restaurant');
    expect(detectCategory('parque para perros')).toEqual({ category: 'park', words: '' });
  });
});

describe('isPetWord', () => {
  it('tells words about the pet from other names', () => {
    expect(isPetWord('Mascota')).toBe(true);
    expect(isPetWord('perros')).toBe(true);
    expect(isPetWord('Tlaxcala')).toBe(false);
    expect(isPetWord('mi mascota')).toBe(false);
  });
});

describe('editDistance', () => {
  it('counts edits, a swap of neighbors as one', () => {
    expect(editDistance('veterinria', 'veterinaria')).toBe(1);
    expect(editDistance('estetcia', 'estetica')).toBe(1);
    expect(editDistance('gato', 'pato')).toBe(1);
    expect(editDistance('tienda', 'tiendita')).toBe(2);
    expect(editDistance('abc', 'xyz12345', 1)).toBe(2);
  });
});
