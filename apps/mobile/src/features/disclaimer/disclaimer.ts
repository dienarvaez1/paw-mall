/**
 * The disclaimer shown on the first launch (owner's request, 2026-10-14). Accepting opens the
 * whole app; cancelling leaves only Urgencias and the notice, to read and accept later. The answer
 * is kept on the phone with the notice's version: a new version asks again.
 */

/** The notice's version: its date (the text in i18n `disclaimer`). Change it with the text. */
export const DISCLAIMER_VERSION = '2026-10-14';

export const DISCLAIMER_STORAGE_KEY = 'disclaimer.answer';

/** loading: not read yet; pending: never answered (or an older version). */
export type DisclaimerStatus = 'loading' | 'pending' | 'accepted' | 'declined';

/** The stored answer, if it's for the current version; anything else asks again. */
export function parseDisclaimerAnswer(raw: string | null): 'pending' | 'accepted' | 'declined' {
  try {
    const value = raw ? (JSON.parse(raw) as { version?: unknown; answer?: unknown }) : null;
    if (value?.version !== DISCLAIMER_VERSION) return 'pending';
    return value.answer === 'accepted' || value.answer === 'declined' ? value.answer : 'pending';
  } catch {
    return 'pending';
  }
}

export function serializeDisclaimerAnswer(answer: 'accepted' | 'declined'): string {
  return JSON.stringify({ version: DISCLAIMER_VERSION, answer });
}

/** Tabs shown for each answer: everything once accepted; Urgencias and the notice otherwise. */
export function visibleTabs(status: DisclaimerStatus): readonly string[] {
  return status === 'accepted'
    ? ['explore', 'pet-friendly', 'urgent', 'favorites', 'settings']
    : ['urgent', 'notice'];
}
