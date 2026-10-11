import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@/api/client', () => ({ apiPost: vi.fn() }));
vi.mock('@/i18n/use-locale', () => ({ useLocale: () => 'es' }));

const { parseAnswers } = await import('./policy-answers');

describe('parseAnswers', () => {
  it('keeps only known answers', () => {
    expect(parseAnswers('{"12":"confirm","13":"dispute","14":"maybe"}')).toEqual({
      '12': 'confirm',
      '13': 'dispute',
    });
  });

  it('treats missing or broken values as no answers', () => {
    expect(parseAnswers(null)).toEqual({});
    expect(parseAnswers('[1,2]')).toEqual({});
    expect(parseAnswers('not json')).toEqual({});
  });
});
