import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Alert: { alert: () => {} }, Keyboard: { dismiss: () => {} } }));
vi.mock('@/lib/use-on-wake', () => ({ useOnWake: () => {} }));
vi.mock('@/i18n/use-app-translation', () => ({ useAppTranslation: () => ({}) }));
vi.mock('@/i18n/use-locale', () => ({ useLocale: () => 'es' }));
vi.mock('@/api/client', () => ({ apiGet: () => {} }));
vi.mock('@/features/location/location-context', () => ({ useUserLocation: () => ({}) }));

const { readsAsPlace } = await import('./explore-view');

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
