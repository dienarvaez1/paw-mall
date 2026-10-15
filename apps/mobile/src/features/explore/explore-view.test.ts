import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Alert: { alert: () => {} }, Keyboard: { dismiss: () => {} } }));
vi.mock('@/lib/use-on-wake', () => ({ useOnWake: () => {} }));
vi.mock('@/i18n/use-app-translation', () => ({ useAppTranslation: () => ({}) }));
vi.mock('@/i18n/use-locale', () => ({ useLocale: () => 'es' }));
vi.mock('@/api/client', () => ({ apiGet: () => {} }));
vi.mock('@/features/location/location-context', () => ({ useUserLocation: () => ({}) }));

const { readsAsPlace, searchReading } = await import('./explore-view');

describe('readsAsPlace', () => {
  it('reads a picked place as the place only when the user said so, for that text', () => {
    const choice = { text: 'Tlaxcala', asPlace: true };
    expect(readsAsPlace(choice, ' Tlaxcala ')).toBe(true);
    expect(readsAsPlace({ text: 'Tlaxcala', asPlace: false }, 'Tlaxcala')).toBe(false);
    expect(readsAsPlace(choice, 'Tlaxcala vet')).toBe(false);
  });

  it('reads typed text as a business name: the search never moves to an unconfirmed place', () => {
    expect(readsAsPlace(null, 'Tlaxcala')).toBe(false);
  });
});

describe('searchReading', () => {
  it('sends a place as a place, typed text as names, and "by that name" word for word', () => {
    const text = 'veterinaria mascota';
    expect(searchReading({ text, asPlace: true }, text)).toEqual({});
    expect(searchReading(null, text)).toEqual({ namesOnly: true });
    expect(searchReading({ text, asPlace: false, exactWords: true }, text)).toEqual({
      namesOnly: true,
      exactWords: true,
    });
    // Editing the text forgets the answer.
    expect(searchReading({ text, asPlace: false, exactWords: true }, 'veterinaria')).toEqual({
      namesOnly: true,
    });
    expect(searchReading(null, '')).toEqual({});
  });
});
