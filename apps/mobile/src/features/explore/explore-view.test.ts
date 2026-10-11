import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Alert: { alert: () => {} } }));
vi.mock('@/features/location/location-context', () => ({ useUserLocation: () => ({}) }));
vi.mock('@/lib/use-on-wake', () => ({ useOnWake: () => {} }));
vi.mock('@/api/client', () => ({ apiGet: () => {} }));
vi.mock('@/i18n/use-app-translation', () => ({ useAppTranslation: () => ({}) }));
vi.mock('@/i18n/use-locale', () => ({ useLocale: () => 'es' }));

const { readsAsPlace } = await import('./explore-view');

describe('readsAsPlace', () => {
  it("gives the user's answer only for the text it was given for", () => {
    const choice = { text: 'Tlaxcala', asPlace: true };
    expect(readsAsPlace(choice, ' Tlaxcala ')).toBe(true);
    expect(readsAsPlace({ text: 'Tlaxcala', asPlace: false }, 'Tlaxcala')).toBe(false);
    expect(readsAsPlace(choice, 'Tlaxcala vet')).toBeNull();
    expect(readsAsPlace(null, 'Tlaxcala')).toBeNull();
  });
});
