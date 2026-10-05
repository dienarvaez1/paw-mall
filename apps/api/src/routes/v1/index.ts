import { Hono } from 'hono';

import type { AppEnv } from '../../env';
import { dbMiddleware } from '../../middleware/db';
import { localeMiddleware } from '../../middleware/locale';
import { categoriesRoute } from './categories';
import { placesRoute } from './places';

export const v1Route = new Hono<AppEnv>()
  .use('*', localeMiddleware)
  .use('*', dbMiddleware)
  .route('/categories', categoriesRoute)
  .route('/places', placesRoute);
