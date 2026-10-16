import { type ErrorCode, type Locale, errorResponseSchema } from '@pet-helper/shared';
import Constants from 'expo-constants';
import type { z } from 'zod';

import { buildApiUrl, resolveApiBaseUrl } from './base-url';
import { fetchWithTimeout } from './fetch-timeout';

export const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Constants.expoConfig?.hostUri,
);

/**
 * API failures carry a code only; NETWORK_ERROR means the API couldn't be reached or didn't answer
 * in time.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK_ERROR',
    readonly status: number,
  ) {
    super(code);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

async function request<S extends z.ZodType>(
  url: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url, init);
  } catch {
    throw new ApiError('NETWORK_ERROR', 0);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    throw new ApiError(parsed.success ? parsed.data.error.code : 'INTERNAL_ERROR', response.status);
  }
  return schema.parse(body);
}

export function apiGet<S extends z.ZodType>(
  path: string,
  params: Params,
  locale: Locale,
  schema: S,
): Promise<z.infer<S>> {
  return request(buildApiUrl(API_BASE_URL, path, { ...params, lang: locale }), schema);
}

export function apiPost<S extends z.ZodType>(
  path: string,
  body: unknown,
  locale: Locale,
  schema: S,
): Promise<z.infer<S>> {
  return request(buildApiUrl(API_BASE_URL, path, { lang: locale }), schema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
