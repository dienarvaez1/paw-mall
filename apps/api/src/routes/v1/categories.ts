import type { CategoryListResponse } from '@pet-helper/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../../env';
import { listCategories } from '../../queries/places';

export const categoriesRoute = new Hono<AppEnv>().get('/', async (c) => {
  const body: CategoryListResponse = { items: await listCategories(c.var.db, c.var.locale) };
  return c.json(body);
});
