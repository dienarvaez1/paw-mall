import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ AppState: {} }));

describe('isWake', () => {
  it('is a return from the background only', async () => {
    const { isWake } = await import('./use-on-wake');
    expect(isWake('background', 'active')).toBe(true);
    expect(isWake('inactive', 'active')).toBe(false);
    expect(isWake('active', 'background')).toBe(false);
  });
});
