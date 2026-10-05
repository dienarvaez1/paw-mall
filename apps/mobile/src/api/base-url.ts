const API_PORT = 8787;

/**
 * Where the API lives: EXPO_PUBLIC_API_URL if set, otherwise the dev machine that serves the
 * bundle (Expo's host, e.g. "192.168.18.24:8081") on the API port, so a phone on the same
 * network reaches `pnpm --filter api dev` without configuration.
 */
export function resolveApiBaseUrl(envUrl: string | undefined, hostUri: string | undefined): string {
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const host = hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:${API_PORT}`;
}

/** Path plus query string, skipping undefined values. */
export function buildApiUrl(
  baseUrl: string,
  path: string,
  params: Record<string, string | number | boolean | undefined>,
): string {
  const query = Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${baseUrl}${path}${query ? `?${query}` : ''}`;
}
