import { type PageFindings, readPage } from './page.ts';

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

/** Homepages are read up to this size; the rest isn't downloaded. */
const MAX_PAGE_BYTES = 1_500_000;

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (bytes >= MAX_PAGE_BYTES) {
      await reader.cancel();
      break;
    }
  }
  return text;
}

/**
 * Visits a website once: its status, and for a working HTML homepage what it says about hours
 * and pets (see page.ts). Findings are null when the page couldn't be read.
 */
export async function inspectWebsite(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<{ check: WebsiteCheck; findings: PageFindings | null }> {
  try {
    const response = await fetcher(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PetHelper link check)' },
    });
    const check = classifyStatus(response.status);
    if (check !== 'ok' || !(response.headers.get('content-type') ?? '').includes('html')) {
      await response.body?.cancel();
      return { check, findings: null };
    }
    return { check, findings: readPage(await readLimited(response)) };
  } catch (error) {
    return { check: classifyError(error), findings: null };
  }
}

export async function checkWebsite(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<WebsiteCheck> {
  return (await inspectWebsite(url, fetcher)).check;
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
