import { type CategoryListResponse, DEFAULT_LOCALE, isSupportedLocale } from '@paw-mall/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../../env';
import { listCategories } from '../../queries/places';

export const categoriesRoute = new Hono<AppEnv>().get('/', async (c) => {
  const lang = c.req.query('lang');
  const locale = isSupportedLocale(lang) ? lang : DEFAULT_LOCALE;
  const body: CategoryListResponse = { items: await listCategories(c.get('db'), locale) };
  return c.json(body);
});
