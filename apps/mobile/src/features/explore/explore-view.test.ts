import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Alert: { alert: () => {} } }));
vi.mock('@/features/location/location-context', () => ({ useUserLocation: () => ({}) }));
vi.mock('@/lib/use-on-wake', () => ({ useOnWake: () => {} }));
vi.mock('@/api/client', () => ({ apiGet: () => {} }));
vi.mock('@/i18n/use-app-translation', () => ({ useAppTranslation: () => ({}) }));
vi.mock('@/i18n/use-locale', () => ({ useLocale: () => 'es' }));

const { isPlaceQuestionPending, readsAsPlace } = await import('./explore-view');

describe('readsAsPlace', () => {
  it("gives the user's answer only for the text it was given for", () => {
    const choice = { text: 'Tlaxcala', asPlace: true };
    expect(readsAsPlace(choice, ' Tlaxcala ')).toBe(true);
    expect(readsAsPlace({ text: 'Tlaxcala', asPlace: false }, 'Tlaxcala')).toBe(false);
    expect(readsAsPlace(choice, 'Tlaxcala vet')).toBeNull();
    expect(readsAsPlace(null, 'Tlaxcala')).toBeNull();
  });
});

describe('isPlaceQuestionPending', () => {
  const base = {
    current: 'Tlaxcala',
    settled: 'Tlaxcala',
    answered: false,
    looking: false,
    foundArea: false,
  };

  it('waits while the typing settles, the lookup runs or the question is open', () => {
    expect(isPlaceQuestionPending({ ...base, settled: 'Tlax' })).toBe(true);
    expect(isPlaceQuestionPending({ ...base, looking: true })).toBe(true);
    expect(isPlaceQuestionPending({ ...base, foundArea: true })).toBe(true);
  });

  it('searches once answered, or when the text is no place', () => {
    expect(isPlaceQuestionPending({ ...base, foundArea: true, answered: true })).toBe(false);
    expect(isPlaceQuestionPending(base)).toBe(false);
  });

  it('never waits on short texts', () => {
    expect(isPlaceQuestionPending({ ...base, current: 'ab', settled: 'a' })).toBe(false);
  });
});
