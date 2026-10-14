/** How long the app waits for the API before treating it as unreachable. */
export const API_TIMEOUT_MS = 15_000;

/**
 * fetch that gives up after `timeoutMs`: a server that accepts the connection but never answers
 * (overloaded, or stuck on its database) rejects like a network error instead of a spinner
 * that never ends.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = API_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
