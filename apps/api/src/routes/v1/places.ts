import { idParamSchema, placeListQuerySchema, placeMapQuerySchema } from '@paw-mall/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../../env';
import { errorResponse, parseInput } from '../../lib/http';
import { getPlace, listPlaces, placesForMap } from '../../queries/places';

export const placesRoute = new Hono<AppEnv>()
  .get('/', async (c) => {
    const query = parseInput(c, placeListQuerySchema, c.req.query());
    if (!query.ok) return query.response;
    return c.json(await listPlaces(c.var.db, query.data, c.var.locale));
  })
  // Before /:id, so "map" isn't read as a place id.
  .get('/map', async (c) => {
    const query = parseInput(c, placeMapQuerySchema, c.req.query());
    if (!query.ok) return query.response;
    return c.json(await placesForMap(c.var.db, query.data, c.var.locale));
  })
  .get('/:id', async (c) => {
    const params = parseInput(c, idParamSchema, c.req.param());
    if (!params.ok) return params.response;
    const place = await getPlace(c.var.db, params.data.id, c.var.locale);
    return place ? c.json(place) : errorResponse(c, 404, 'PLACE_NOT_FOUND');
  });
