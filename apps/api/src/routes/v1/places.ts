import {
  type GoogleDetailsResponse,
  idParamSchema,
  placeClaimSchema,
  placeListQuerySchema,
  placeMapQuerySchema,
  placeReportSchema,
  policyAnswerSchema,
  type receivedResponseSchema,
  urgentQuerySchema,
} from '@paw-mall/shared';
import { Hono } from 'hono';
import type { z } from 'zod';

import type { AppEnv } from '../../env';
import { GoogleError } from '../../lib/google-places';
import { errorResponse, parseInput } from '../../lib/http';
import { lookupGoogleDetails, userKey } from '../../queries/google';
import { getPlace, listPlaces, placesForMap, urgentPlaces } from '../../queries/places';
import { answerPolicy, createClaim, reportPlace } from '../../queries/trust';

type Received = z.infer<typeof receivedResponseSchema>;

export const placesRoute = new Hono<AppEnv>()
  .get('/', async (c) => {
    const query = parseInput(c, placeListQuerySchema, c.req.query());
    if (!query.ok) return query.response;
    return c.json(await listPlaces(c.var.db, query.data, c.var.locale));
  })
  // Before /:id, so "map" and "urgent" aren't read as place ids.
  .get('/map', async (c) => {
    const query = parseInput(c, placeMapQuerySchema, c.req.query());
    if (!query.ok) return query.response;
    return c.json(await placesForMap(c.var.db, query.data, c.var.locale));
  })
  .get('/urgent', async (c) => {
    const query = parseInput(c, urgentQuerySchema, c.req.query());
    if (!query.ok) return query.response;
    // "Open now" changes by the minute; don't let anything cache it.
    c.header('Cache-Control', 'no-store');
    return c.json(await urgentPlaces(c.var.db, query.data, c.var.locale));
  })
  .get('/:id', async (c) => {
    const params = parseInput(c, idParamSchema, c.req.param());
    if (!params.ok) return params.response;
    const place = await getPlace(c.var.db, params.data.id, c.var.locale);
    return place ? c.json(place) : errorResponse(c, 404, 'PLACE_NOT_FOUND');
  })
  // Reports carry only a reason and the app's random id; nothing about the phone is read or kept.
  .post('/:id/reports', async (c) => {
    const params = parseInput(c, idParamSchema, c.req.param());
    if (!params.ok) return params.response;
    const report = parseInput(c, placeReportSchema, await c.req.json().catch(() => null));
    if (!report.ok) return report.response;
    if (!(await getPlace(c.var.db, params.data.id, c.var.locale))) {
      return errorResponse(c, 404, 'PLACE_NOT_FOUND');
    }
    await reportPlace(c.var.db, params.data.id, report.data);
    return c.json<Received>({ received: true }, 201);
  })
  .post('/:id/claims', async (c) => {
    const params = parseInput(c, idParamSchema, c.req.param());
    if (!params.ok) return params.response;
    const claim = parseInput(c, placeClaimSchema, await c.req.json().catch(() => null));
    if (!claim.ok) return claim.response;
    if (!(await getPlace(c.var.db, params.data.id, c.var.locale))) {
      return errorResponse(c, 404, 'PLACE_NOT_FOUND');
    }
    await createClaim(c.var.db, params.data.id, claim.data);
    return c.json<Received>({ received: true }, 201);
  })
  // Confirm or dispute a pet policy: only the answer and the app's random id are read or kept.
  .post('/:id/policy-answers', async (c) => {
    const params = parseInput(c, idParamSchema, c.req.param());
    if (!params.ok) return params.response;
    const answer = parseInput(c, policyAnswerSchema, await c.req.json().catch(() => null));
    if (!answer.ok) return answer.response;
    if (!(await getPlace(c.var.db, params.data.id, c.var.locale))) {
      return errorResponse(c, 404, 'PLACE_NOT_FOUND');
    }
    if (!(await answerPolicy(c.var.db, params.data.id, answer.data))) {
      return errorResponse(c, 404, 'POLICY_NOT_FOUND');
    }
    return c.json<Received>({ received: true }, 201);
  })
  // POST, not GET: each call can spend from the monthly Google allowance, so nothing may prefetch it.
  .post('/:id/google', async (c) => {
    const params = parseInput(c, idParamSchema, c.req.param());
    if (!params.ok) return params.response;
    c.header('Cache-Control', 'no-store');

    const apiKey = c.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      if (!(await getPlace(c.var.db, params.data.id, c.var.locale))) {
        return errorResponse(c, 404, 'PLACE_NOT_FOUND');
      }
      return c.json<GoogleDetailsResponse>({ status: 'unavailable' });
    }
    try {
      const result = await lookupGoogleDetails(c.var.db, params.data.id, {
        apiKey,
        client: await userKey(c.req.header('CF-Connecting-IP') ?? 'unknown'),
        language: c.var.locale,
        monthlyLimit: optionalNumber(c.env.GOOGLE_MONTHLY_LIMIT),
        dailyLookups: optionalNumber(c.env.GOOGLE_DAILY_LOOKUPS),
      });
      return result ? c.json(result) : errorResponse(c, 404, 'PLACE_NOT_FOUND');
    } catch (error) {
      if (!(error instanceof GoogleError)) throw error;
      console.error(error.message);
      return c.json<GoogleDetailsResponse>({ status: 'unavailable' });
    }
  });

function optionalNumber(value: string | undefined): number | undefined {
  const number = Number(value);
  return value && Number.isFinite(number) ? number : undefined;
}
