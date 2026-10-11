import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@/api/client', () => ({ apiPost: vi.fn() }));
vi.mock('@/i18n/use-locale', () => ({ useLocale: () => 'es' }));

const { parsePetAnswers } = await import('./pet-answers');

describe('parsePetAnswers', () => {
  it('keeps valid answers and drops the rest', () => {
    const raw = JSON.stringify({
      1: { takesDogs: true, maxDogSize: 'large' },
      2: { takesDogs: false, maxDogSize: null },
      3: { takesDogs: 'yes', maxDogSize: null },
      4: { takesDogs: true, maxDogSize: 'huge' },
    });
    expect(parsePetAnswers(raw)).toEqual({
      1: { takesDogs: true, maxDogSize: 'large' },
      2: { takesDogs: false, maxDogSize: null },
    });
    expect(parsePetAnswers('not json')).toEqual({});
    expect(parsePetAnswers(null)).toEqual({});
  });
});
