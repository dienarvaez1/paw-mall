import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db-url.ts';
import {
  type BenchmarkQuery,
  type QueryResult,
  apiParams,
  findRegressions,
  judge,
  parseBenchmark,
  percentile,
  scoreQuery,
  summarize,
} from './search.ts';

const near = { lat: 19.4326, lng: -99.1332 };

function query(overrides: Partial<BenchmarkQuery> & { id: string }): BenchmarkQuery {
  return parseBenchmark({
    locations: { here: near },
    queries: [{ q: 'veterinaria', near: 'here', relevant: {}, ...overrides }],
  }).queries[0]!;
}

const judged = {
  returned: 10,
  relevantReturned: 8,
  relevantInCircle: 40,
  relevantReturnedInCircle: 7,
  knownFound: 0,
  nearestBeyondKm: null,
  area: null,
  latencyMs: 30,
};

function result(id: string, overrides: Partial<QueryResult> = {}): QueryResult {
  return { ...scoreQuery(query({ id }), judged), ...overrides };
}

describe('the benchmark file', () => {
  it('parses, with unique ids and known locations', () => {
    const file = join(import.meta.dirname, '../../data/search-benchmark.json');
    const benchmark = parseBenchmark(JSON.parse(readFileSync(file, 'utf8')));
    expect(benchmark.queries.length).toBeGreaterThanOrEqual(40);
    expect(benchmark.queries.some((q) => q.relevant === null)).toBe(true);
  });

  it('rejects a duplicate id or an unknown location', () => {
    const q = { id: 'a', q: 'vet', near: 'here', relevant: {} };
    expect(() => parseBenchmark({ locations: { here: near }, queries: [q, q] })).toThrow(
      /Duplicate/,
    );
    expect(() =>
      parseBenchmark({ locations: { here: near }, queries: [{ ...q, near: 'there' }] }),
    ).toThrow(/unknown location/);
  });
});

describe('apiParams', () => {
  it('sends typed text as names only, like the app', () => {
    expect(apiParams(query({ id: 'a' }), near)).toMatchObject({
      q: 'veterinaria',
      namesOnly: 'true',
      group: 'pet_business',
      pageSize: '10',
    });
    expect(apiParams(query({ id: 'b', mode: 'place' }), near).namesOnly).toBeUndefined();
  });

  it('sends "by that name" as exact words', () => {
    expect(apiParams(query({ id: 'a', mode: 'exact' }), near)).toMatchObject({
      namesOnly: 'true',
      exactWords: 'true',
    });
  });

  it("uses Pet-friendly's default filter", () => {
    expect(apiParams(query({ id: 'a', group: 'pet_friendly' }), near).petFriendly).toBe('true');
  });
});

describe('scoreQuery', () => {
  it('computes precision and recall at 10', () => {
    const r = scoreQuery(query({ id: 'a' }), judged);
    expect(r.precision).toBe(0.8);
    expect(r.recall).toBe(0.7);
  });

  it('caps recall at the relevant places that exist', () => {
    const r = scoreQuery(query({ id: 'a' }), {
      ...judged,
      relevantInCircle: 4,
      relevantReturnedInCircle: 3,
    });
    expect(r.recall).toBe(0.75);
  });

  it('flags zero results only when the app has no nearer match to widen to', () => {
    const empty = { ...judged, returned: 0, relevantReturned: 0, relevantReturnedInCircle: 0 };
    expect(scoreQuery(query({ id: 'a' }), empty).zeroResult).toBe(true);
    expect(scoreQuery(query({ id: 'a' }), { ...empty, nearestBeyondKm: 7 }).zeroResult).toBe(false);
  });

  it('passes a negative case only when nothing is returned', () => {
    const negative = query({ id: 'a', relevant: null });
    expect(scoreQuery(negative, { ...judged, returned: 0 }).negativePass).toBe(true);
    const failed = scoreQuery(negative, judged);
    expect(failed).toMatchObject({ negativePass: false, precision: null, zeroResult: false });
  });

  it('checks the place a place search moved to', () => {
    const place = query({
      id: 'a',
      mode: 'place',
      expectArea: { name: 'Coyoacán', state: 'CDMX' },
    });
    const area = { name: 'Coyoacán', state: 'CDMX' };
    expect(scoreQuery(place, { ...judged, area }).areaMatched).toBe(true);
    expect(scoreQuery(place, { ...judged, area: { ...area, state: 'Jalisco' } }).areaMatched).toBe(
      false,
    );
  });
});

describe('summarize', () => {
  it('averages the metrics that apply', () => {
    const summary = summarize([
      result('a', { precision: 1, recall: 0.5, latencyMs: 10 }),
      result('b', { precision: null, recall: null, zeroResult: true, latencyMs: 30 }),
      result('c', { negativePass: true, precision: null, recall: null, latencyMs: 20 }),
    ]);
    expect(summary).toMatchObject({
      queries: 3,
      precisionAt10: 1,
      recallAt10: 0.5,
      zeroResultRate: 0.5,
      negativePassRate: 1,
      latencyP50Ms: 20,
    });
  });

  it('takes percentiles by nearest rank', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([5, 1, 3, 2, 4], 95)).toBe(5);
    expect(percentile([], 95)).toBeNull();
  });
});

describe('findRegressions', () => {
  it('reports drops beyond one result in ten, lost items and new failures', () => {
    const baseline = [
      result('steady', { precision: 0.8 }),
      result('worse', { precision: 0.9, recall: 0.9, knownFound: 1, knownTotal: 1 }),
      result('negative', { negativePass: true }),
    ];
    const current = [
      result('steady', { precision: 0.75 }),
      result('worse', { precision: 0.7, recall: 0.9, knownFound: 0, knownTotal: 1 }),
      result('negative', { negativePass: false, returned: 3 }),
      result('new', { precision: 0 }),
    ];
    expect(findRegressions(baseline, current)).toEqual([
      { id: 'worse', reasons: ['precision@10 0.90 → 0.70', 'known items 1 → 0 of 1'] },
      { id: 'negative', reasons: ['negative case returns 3'] },
    ]);
  });
});

describe('judge', () => {
  // Needs the local database (pnpm db:up && pnpm db:migrate), like the API tests.
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  const ids: Record<string, number> = {};

  async function addPlace(key: string, name: string, slug: string, lat = near.lat) {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO places (source, external_id, name, address, city, state, location)
      VALUES ('curated', ${`test-bench-${key}`}, ${name}, 'Calle 1', 'Coyoacán', 'Ciudad de México',
              ST_SetSRID(ST_MakePoint(${near.lng}, ${lat}), 4326)::geography)
      RETURNING id`;
    await sql`INSERT INTO place_categories (place_id, category_id, source)
              SELECT ${row!.id}, id, 'curated' FROM categories WHERE slug = ${slug}`;
    ids[key] = row!.id;
  }

  beforeAll(async () => {
    await sql`DELETE FROM places WHERE external_id LIKE 'test-bench-%'`;
    await addPlace('vet', 'Veterinaria Huellitas', 'veterinarian');
    await addPlace('far-vet', 'Veterinaria Lejana', 'veterinarian', near.lat + 1);
    await addPlace('store', 'Tienda Huellitas', 'pet_store');
    await addPlace('cafe', 'Café Huellitas', 'cafe');
  });

  afterAll(async () => {
    await sql`DELETE FROM places WHERE external_id LIKE 'test-bench-%'`;
    await sql.end();
  });

  it('judges by category within the circle, not by what the API returned', async () => {
    const q = query({ id: 'a', relevant: { categories: ['veterinarian'] } });
    const counts = await judge(sql, q, { ...near, radiusKm: 0.1 }, [ids.store!, ids['far-vet']!]);
    expect(counts).toMatchObject({ relevantReturned: 1, relevantReturnedInCircle: 0 });
    // Other tests' places may sit at the same spot: at least this test's vet is in the circle.
    expect(counts.relevantInCircle).toBeGreaterThanOrEqual(1);
  });

  it("matches name words at a word's start, within the query's group", async () => {
    const q = query({ id: 'a', relevant: { nameWords: ['huellitas'], city: 'coyoacan' } });
    const returned = [ids.vet!, ids.store!, ids.cafe!];
    expect((await judge(sql, q, { ...near, radiusKm: 0.1 }, returned)).relevantReturned).toBe(2);
    const partial = query({ id: 'b', relevant: { nameWords: ['llitas'] } });
    expect((await judge(sql, partial, { ...near, radiusKm: 0.1 }, returned)).relevantReturned).toBe(
      0,
    );
  });

  it('counts known items among the returned places', async () => {
    const q = query({
      id: 'a',
      knownItems: [
        { source: 'curated', externalId: 'test-bench-vet', name: 'Veterinaria Huellitas' },
      ],
    });
    expect((await judge(sql, q, { ...near, radiusKm: 1 }, [ids.vet!])).knownFound).toBe(1);
    expect((await judge(sql, q, { ...near, radiusKm: 1 }, [])).knownFound).toBe(0);
  });
});
