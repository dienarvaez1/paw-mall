import { type ErrorCode, type Locale, errorResponseSchema } from '@paw-mall/shared';
import Constants from 'expo-constants';
import type { z } from 'zod';

import { buildApiUrl, resolveApiBaseUrl } from './base-url';

export const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Constants.expoConfig?.hostUri,
);

/** API failures carry a code only; NETWORK_ERROR means the API couldn't be reached. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK_ERROR',
    readonly status: number,
  ) {
    super(code);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

export async function apiGet<S extends z.ZodType>(
  path: string,
  params: Params,
  locale: Locale,
  schema: S,
): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl(API_BASE_URL, path, { ...params, lang: locale }));
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
