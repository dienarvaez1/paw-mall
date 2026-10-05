/** Outcome of visiting a store's website once. */
export type WebsiteCheck = 'ok' | 'blocked' | 'unreachable' | 'dead';

/** Failed checks in a row before an unreachable (not definitively dead) site is hidden. */
export const FAILURES_TO_HIDE = 2;
const TIMEOUT_MS = 10_000;

/** Network errors that mean the site doesn't exist, as opposed to being temporarily down. */
const DEFINITELY_DEAD = new Set(['ENOTFOUND', 'EAI_NONAME', 'ERR_INVALID_URL']);

export function classifyStatus(status: number): WebsiteCheck {
  if (status < 400) return 'ok';
  if ([401, 403, 429, 451].includes(status)) return 'blocked';
  if (status === 404 || status === 410) return 'dead';
  return 'unreachable';
}

export function classifyError(error: unknown): WebsiteCheck {
  const cause = (error as { cause?: { code?: string } })?.cause;
  const code = cause?.code ?? (error as { code?: string })?.code;
  return code && DEFINITELY_DEAD.has(code) ? 'dead' : 'unreachable';
}

export async function checkWebsite(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<WebsiteCheck> {
  try {
    const response = await fetcher(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PawMall link check)' },
    });
    // Only the status matters; don't download the page.
    await response.body?.cancel();
    return classifyStatus(response.status);
  } catch (error) {
    return classifyError(error);
  }
}

/**
 * Whether the site stays visible after this check: dead hides it at once, unreachable only after
 * FAILURES_TO_HIDE checks in a row. Returns the new failure count and status to store.
 */
export function nextState(check: WebsiteCheck, previousFailures: number) {
  const failures = check === 'ok' || check === 'blocked' ? 0 : previousFailures + 1;
  const status: WebsiteCheck =
    check === 'unreachable' && failures >= FAILURES_TO_HIDE ? 'dead' : check;
  return { status, failures };
}
