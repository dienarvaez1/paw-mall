import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@/api/client', () => ({ apiPost: vi.fn() }));
vi.mock('@/i18n/use-locale', () => ({ useLocale: () => 'es' }));

const { randomClientId } = await import('./place-reports');

describe('randomClientId', () => {
  it('is 32 random hex characters, accepted by the API', () => {
    const id = randomClientId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(randomClientId()).not.toBe(id);
    expect(randomClientId(() => 0)).toBe('0'.repeat(32));
  });
});
