// Search quality benchmark (docs/QA-STRATEGY.md, section 5): labeled queries in
// data/search-benchmark.json are sent to the API as the app sends them, and the top 10 results are
// judged against the labels in SQL, independently of the API's search code. Metrics: precision@10,
// recall@10, zero results, known items found, negative cases, place intent and latency; compared
// with the committed baseline (data/search-baseline.json) to find regressions.
import type postgres from 'postgres';
import { z } from 'zod';

/** Results judged per query: the app's first screen of the list. */
export const TOP_K = 10;
/** A metric falling by more than this (one result in ten) counts as a regression. */
export const REGRESSION_DROP = 0.1;
/** The app's circle around a searched place, and a busy city's: 5 km (km users; hooks.ts). */
const APP_AREA_RADIUS_KM = 5;
const DEFAULT_RADIUS_KM = 5;

const point = z.object({ lat: z.number(), lng: z.number() });
const benchmarkQuery = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  q: z.string().min(1),
  near: z.string(),
  radiusKm: z.number().positive().default(DEFAULT_RADIUS_KM),
  group: z.enum(['pet_business', 'pet_friendly']).default('pet_business'),
  /**
   * typed: text sent with the search key (names only); place: a place picked from the suggestions,
   * or a kind of business in a place (the app goes there, or asks and the user says "in the
   * place"); exact: "by that name" after that question (every word in names, no keyword).
   */
  mode: z.enum(['typed', 'place', 'exact']).default('typed'),
  tags: z.array(z.string()).default([]),
  /** Pet-friendly widened to venues nobody has answered for, as the app does when none is confirmed. */
  widened: z.boolean().default(false),
  /** The user's intent; null for a negative case (any result is wrong). */
  relevant: z
    .object({
      categories: z.array(z.string()).optional(),
      /** Every word must start a word of the name (accents and case aside). */
      nameWords: z.array(z.string()).optional(),
      city: z.string().optional(),
      /** A pet policy that takes pets and isn't under review. */
      takesPets: z.boolean().optional(),
    })
    .nullable(),
  /** Where the relevant places are (default: `near` and radiusKm). */
  judge: point.extend({ radiusKm: z.number().positive() }).optional(),
  /** The place the search should move to (mode "place"). */
  expectArea: z.object({ name: z.string(), state: z.string() }).optional(),
  knownItems: z
    .array(z.object({ source: z.string(), externalId: z.string(), name: z.string() }))
    .default([]),
  /** Why the label is what it is, when it isn't obvious. */
  note: z.string().optional(),
});
export type BenchmarkQuery = z.infer<typeof benchmarkQuery>;

export const benchmarkSchema = z.object({
  locations: z.record(z.string(), point),
  queries: z.array(benchmarkQuery).min(1),
});
export type Benchmark = z.infer<typeof benchmarkSchema>;

export function parseBenchmark(json: unknown): Benchmark {
  const benchmark = benchmarkSchema.parse(json);
  const ids = new Set<string>();
  for (const query of benchmark.queries) {
    if (ids.has(query.id)) throw new Error(`Duplicate query id ${query.id}`);
    ids.add(query.id);
    if (!benchmark.locations[query.near])
      throw new Error(`${query.id}: unknown location ${query.near}`);
  }
  return benchmark;
}

/** The API request the app makes for this search (apps/mobile/src/api/hooks.ts, usePlaces). */
export function apiParams(query: BenchmarkQuery, near: { lat: number; lng: number }) {
  const params: Record<string, string> = {
    lat: String(near.lat),
    lng: String(near.lng),
    radiusKm: String(query.radiusKm),
    q: query.q,
    group: query.group,
    areaRadiusKm: String(APP_AREA_RADIUS_KM),
    cityRadiusKm: String(APP_AREA_RADIUS_KM),
    page: '1',
    pageSize: String(TOP_K),
  };
  if (query.mode !== 'place') params.namesOnly = 'true';
  if (query.mode === 'exact') params.exactWords = 'true';
  // Pet-friendly's default: only places confirmed to take pets (Ajustes, "Solo lugares confirmados").
  if (query.group === 'pet_friendly') params.petFriendly = 'true';
  if (query.widened) params.withUnconfirmed = 'true';
  return params;
}

/** What one query scored; null where a metric doesn't apply. */
export type QueryResult = {
  id: string;
  tags: string[];
  returned: number;
  /** Results that match the intent (anywhere). */
  relevantReturned: number;
  /** Relevant places inside the judged circle, and how many of them are in the top 10. */
  relevantInCircle: number;
  relevantReturnedInCircle: number;
  precision: number | null;
  recall: number | null;
  /** No result, and no nearer match for the app to widen the radius to. */
  zeroResult: boolean;
  knownFound: number;
  knownTotal: number;
  /** Negative case: true when nothing was returned. */
  negativePass: boolean | null;
  /** Place search: whether the API moved to the expected place. */
  areaMatched: boolean | null;
  latencyMs: number;
};

export function scoreQuery(
  query: BenchmarkQuery,
  judged: {
    returned: number;
    relevantReturned: number;
    relevantInCircle: number;
    relevantReturnedInCircle: number;
    knownFound: number;
    nearestBeyondKm: number | null;
    area: { name: string; state: string } | null;
    latencyMs: number;
  },
): QueryResult {
  const negative = query.relevant === null;
  return {
    id: query.id,
    tags: query.tags,
    returned: judged.returned,
    relevantReturned: judged.relevantReturned,
    relevantInCircle: judged.relevantInCircle,
    relevantReturnedInCircle: judged.relevantReturnedInCircle,
    precision: negative || judged.returned === 0 ? null : judged.relevantReturned / judged.returned,
    recall:
      negative || judged.relevantInCircle === 0
        ? null
        : judged.relevantReturnedInCircle / Math.min(TOP_K, judged.relevantInCircle),
    zeroResult: !negative && judged.returned === 0 && judged.nearestBeyondKm === null,
    knownFound: judged.knownFound,
    knownTotal: query.knownItems.length,
    negativePass: negative ? judged.returned === 0 : null,
    areaMatched: query.expectArea
      ? judged.area?.name === query.expectArea.name && judged.area.state === query.expectArea.state
      : null,
    latencyMs: judged.latencyMs,
  };
}

const mean = (values: number[]) =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
const share = (flags: boolean[]) => mean(flags.map((flag) => (flag ? 1 : 0)));

/** The value at a percentile (nearest rank) of unsorted numbers. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

export type Summary = {
  queries: number;
  precisionAt10: number | null;
  recallAt10: number | null;
  zeroResultRate: number | null;
  knownItemRate: number | null;
  negativePassRate: number | null;
  areaIntentRate: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
};

export function summarize(results: QueryResult[]): Summary {
  const known = results.reduce((n, r) => n + r.knownTotal, 0);
  const positives = results.filter((r) => r.negativePass === null);
  return {
    queries: results.length,
    precisionAt10: mean(results.flatMap((r) => (r.precision === null ? [] : [r.precision]))),
    recallAt10: mean(results.flatMap((r) => (r.recall === null ? [] : [r.recall]))),
    zeroResultRate: share(positives.map((r) => r.zeroResult)),
    knownItemRate: known === 0 ? null : results.reduce((n, r) => n + r.knownFound, 0) / known,
    negativePassRate: share(
      results.flatMap((r) => (r.negativePass === null ? [] : [r.negativePass])),
    ),
    areaIntentRate: share(results.flatMap((r) => (r.areaMatched === null ? [] : [r.areaMatched]))),
    latencyP50Ms: percentile(
      results.map((r) => r.latencyMs),
      50,
    ),
    latencyP95Ms: percentile(
      results.map((r) => r.latencyMs),
      95,
    ),
  };
}

export type Regression = { id: string; reasons: string[] };

/**
 * Queries that got worse than the baseline: precision or recall down by more than
 * REGRESSION_DROP, a known item lost, a new zero result, a negative case now returning places, or
 * a place search no longer finding its place. Latency is reported, never a regression (it varies
 * from run to run).
 */
export function findRegressions(baseline: QueryResult[], current: QueryResult[]): Regression[] {
  const before = new Map(baseline.map((r) => [r.id, r]));
  const regressions: Regression[] = [];
  for (const now of current) {
    const was = before.get(now.id);
    if (!was) continue;
    const reasons: string[] = [];
    const dropped = (name: string, a: number | null, b: number | null) => {
      if (a !== null && (b ?? 0) < a - REGRESSION_DROP) {
        reasons.push(`${name} ${a.toFixed(2)} → ${b === null ? '—' : b.toFixed(2)}`);
      }
    };
    dropped('precision@10', was.precision, now.precision);
    dropped('recall@10', was.recall, now.recall);
    if (now.knownFound < was.knownFound) {
      reasons.push(`known items ${was.knownFound} → ${now.knownFound} of ${now.knownTotal}`);
    }
    if (now.zeroResult && !was.zeroResult) reasons.push('no results');
    if (was.negativePass === true && now.negativePass === false) {
      reasons.push(`negative case returns ${now.returned}`);
    }
    if (was.areaMatched === true && now.areaMatched === false) reasons.push('wrong place');
    if (reasons.length > 0) regressions.push({ id: now.id, reasons });
  }
  return regressions;
}

type Sql = postgres.Sql;
type Fragment = postgres.PendingQuery<postgres.Row[]>;

/** The intent's conditions on places aliased `p` (visible places only). */
export function intentSql(sql: Sql, query: BenchmarkQuery): Fragment {
  const relevant = query.relevant ?? {};
  const name = sql`lower(f_unaccent(coalesce(p.name, '')))`;
  const conditions: Fragment[] = [
    sql`p.hidden_at IS NULL`,
    sql`EXISTS (SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
                WHERE pc.place_id = p.id AND c."group" = ${query.group}
                  ${relevant.categories ? sql`AND c.slug IN ${sql(relevant.categories)}` : sql``})`,
    ...(relevant.nameWords ?? []).map(
      (word) => sql`${name} ~ ('\\m' || lower(f_unaccent(${escapeRegex(word)})))`,
    ),
  ];
  if (relevant.city) {
    conditions.push(sql`lower(f_unaccent(p.city)) = lower(f_unaccent(${relevant.city}))`);
  }
  if (relevant.takesPets) {
    conditions.push(sql`EXISTS (SELECT 1 FROM pet_policies pp WHERE pp.place_id = p.id
                                  AND pp.review_since IS NULL
                                  AND (pp.dogs OR pp.cats OR pp.other_pets) IS TRUE)`);
  }
  return conditions.reduce((all, condition) => sql`${all} AND ${condition}`);
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Judges the returned places: how many match the intent, how many relevant places the judged
 * circle holds and how many of those were returned, and which known items were.
 */
export async function judge(
  sql: Sql,
  query: BenchmarkQuery,
  circle: { lat: number; lng: number; radiusKm: number },
  returnedIds: number[],
) {
  const center = sql`ST_SetSRID(ST_MakePoint(${circle.lng}, ${circle.lat}), 4326)::geography`;
  const inCircle = sql`ST_DWithin(p.location, ${center}, ${circle.radiusKm * 1000})`;
  const ids = returnedIds.length > 0 ? returnedIds : [-1];
  const negative = query.relevant === null;
  const [counts] = negative
    ? [{ relevant_returned: 0, relevant_in_circle: 0, relevant_returned_in_circle: 0 }]
    : await sql<
        {
          relevant_returned: number;
          relevant_in_circle: number;
          relevant_returned_in_circle: number;
        }[]
      >`
        SELECT
          (SELECT count(*)::int FROM places p WHERE p.id IN ${sql(ids)} AND ${intentSql(sql, query)})
            AS relevant_returned,
          (SELECT count(*)::int FROM places p WHERE ${inCircle} AND ${intentSql(sql, query)})
            AS relevant_in_circle,
          (SELECT count(*)::int FROM places p
            WHERE p.id IN ${sql(ids)} AND ${inCircle} AND ${intentSql(sql, query)})
            AS relevant_returned_in_circle`;
  let knownFound = 0;
  if (query.knownItems.length > 0) {
    const keys = query.knownItems.map((item) => `${item.source}:${item.externalId}`);
    const [row] = await sql<{ found: number }[]>`
      SELECT count(*)::int AS found FROM places
      WHERE id IN ${sql(ids)} AND source || ':' || external_id IN ${sql(keys)}`;
    knownFound = row!.found;
  }
  return {
    relevantReturned: counts!.relevant_returned,
    relevantInCircle: counts!.relevant_in_circle,
    relevantReturnedInCircle: counts!.relevant_returned_in_circle,
    knownFound,
  };
}

/** The judged circle: the label's, else the user's position and radius. */
export function judgedCircle(query: BenchmarkQuery, near: { lat: number; lng: number }) {
  return query.judge ?? { ...near, radiusKm: query.radiusKm };
}
