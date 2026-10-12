import { describe, expect, it } from 'vitest';

import {
  CATEGORY_COLORS,
  isPetFilterCategory,
  isPetFriendlyCategory,
  pinCategory,
  pinColor,
} from './categories';

const place = (...slugs: string[]) =>
  ({ categories: slugs.map((slug) => ({ slug, name: slug })) }) as Parameters<typeof pinColor>[0];

describe('pinColor', () => {
  it('uses the selected category', () => {
    expect(pinColor(place('veterinarian', 'groomer'), 'groomer')).toBe(CATEGORY_COLORS.groomer);
  });

  it('picks the most specific category without a selection', () => {
    expect(pinColor(place('veterinarian', 'vet_hospital'), null)).toBe(
      CATEGORY_COLORS.vet_hospital,
    );
    expect(pinColor(place('pet_store', 'boutique'), null)).toBe(CATEGORY_COLORS.boutique);
  });

  it('falls back to a neutral color', () => {
    expect(pinColor(place(), null)).toBe('#525252');
  });
});

describe('isPetFriendlyCategory', () => {
  it('is true for pet-friendly venues only', () => {
    expect(isPetFriendlyCategory('restaurant')).toBe(true);
    expect(isPetFriendlyCategory('lodging')).toBe(true);
    expect(isPetFriendlyCategory('veterinarian')).toBe(false);
    expect(isPetFriendlyCategory(null)).toBe(false);
  });
});

describe('isPetFilterCategory', () => {
  it('filters restaurants, cafés and lodging, but lists every museum and park', () => {
    expect(isPetFilterCategory('restaurant')).toBe(true);
    expect(isPetFilterCategory('museum')).toBe(false);
    expect(isPetFilterCategory('park')).toBe(false);
    expect(isPetFriendlyCategory('park')).toBe(true);
    expect(isPetFilterCategory(null)).toBe(false);
  });
});

describe('pinCategory', () => {
  it('picks the icon by the selected chip, else the most specific category', () => {
    expect(pinCategory(place('veterinarian', 'groomer'), 'groomer')).toBe('groomer');
    expect(pinCategory(place('veterinarian', 'vet_hospital'), null)).toBe('vet_hospital');
    expect(pinCategory(place(), null)).toBeNull();
  });
});
