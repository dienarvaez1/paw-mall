import { Hono } from 'hono';

import type { AppEnv } from '../../env';
import { dbMiddleware } from '../../middleware/db';
import { categoriesRoute } from './categories';
import { placesRoute } from './places';

export const v1Route = new Hono<AppEnv>()
  .use('*', dbMiddleware)
  .route('/categories', categoriesRoute)
  .route('/places', placesRoute);
