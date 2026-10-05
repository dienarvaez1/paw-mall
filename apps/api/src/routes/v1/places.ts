import { type PlaceListResponse, placeListQuerySchema } from '@paw-mall/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../../env';
import { parseInput } from '../../lib/http';
import { listPlaces } from '../../queries/places';

export const placesRoute = new Hono<AppEnv>().get('/', async (c) => {
  const query = parseInput(c, placeListQuerySchema, c.req.query());
  if (!query.ok) return query.response;
  const body: PlaceListResponse = await listPlaces(c.get('db'), query.data);
  return c.json(body);
});
