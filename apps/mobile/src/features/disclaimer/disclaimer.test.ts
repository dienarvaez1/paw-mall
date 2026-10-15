import { describe, expect, it } from 'vitest';

import {
  DISCLAIMER_VERSION,
  parseDisclaimerAnswer,
  serializeDisclaimerAnswer,
  visibleTabs,
} from './disclaimer';

describe('parseDisclaimerAnswer', () => {
  it('reads an answer to the current version', () => {
    expect(parseDisclaimerAnswer(serializeDisclaimerAnswer('accepted'))).toBe('accepted');
    expect(parseDisclaimerAnswer(serializeDisclaimerAnswer('declined'))).toBe('declined');
  });

  it('asks again on the first launch, for an older version, or a broken value', () => {
    expect(parseDisclaimerAnswer(null)).toBe('pending');
    expect(
      parseDisclaimerAnswer(JSON.stringify({ version: '2020-01-01', answer: 'accepted' })),
    ).toBe('pending');
    expect(
      parseDisclaimerAnswer(JSON.stringify({ version: DISCLAIMER_VERSION, answer: 'maybe' })),
    ).toBe('pending');
    expect(parseDisclaimerAnswer('{not json')).toBe('pending');
  });
});

describe('visibleTabs', () => {
  it('shows the five tabs once accepted, only Urgencias and the notice otherwise', () => {
    expect(visibleTabs('accepted')).toEqual([
      'explore',
      'pet-friendly',
      'urgent',
      'favorites',
      'settings',
    ]);
    expect(visibleTabs('declined')).toEqual(['urgent', 'notice']);
    expect(visibleTabs('pending')).toEqual(['urgent', 'notice']);
  });
});
