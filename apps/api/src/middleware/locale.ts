import { DEFAULT_LOCALE, isSupportedLocale } from '@pet-helper/shared';
import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '../env';

/** The response language from `?lang=`, Spanish by default. */
export const localeMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const lang = c.req.query('lang');
  c.set('locale', isSupportedLocale(lang) ? lang : DEFAULT_LOCALE);
  await next();
});
