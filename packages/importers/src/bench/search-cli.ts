// Runs the search quality benchmark against a local API on the dev data (read-only).
//
//   pnpm search:bench                      scores every query and compares with the baseline
//   pnpm search:bench --only vet-cdmx      one query, with its returned places
//   pnpm search:bench --check              exits 1 when a query regressed
//   pnpm search:bench --save               writes the results as the new baseline
//   pnpm search:bench --base-url URL       another local API (default http://localhost:8787)
//
// Local only, like the load test: never point it at a deployed API.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import {
  type QueryResult,
  type Summary,
  apiParams,
  findRegressions,
  judge,
  judgedCircle,
  parseBenchmark,
  scoreQuery,
  summarize,
} from './search.ts';

const DATA = join(import.meta.dirname, '../../data');
const BENCHMARK_FILE = join(DATA, 'search-benchmark.json');
const BASELINE_FILE = join(DATA, 'search-baseline.json');
/** Timed runs per query after one warm-up; the median is kept. */
const RUNS = 3;

type Baseline = {
  createdOn: string;
  commit: string;
  visiblePlaces: number;
  summary: Summary;
  results: QueryResult[];
};

type ListResponse = {
  items: { id: number; name: string | null; distanceKm?: number; categories: { slug: string }[] }[];
  area: { name: string; state: string } | null;
  nearestBeyondKm: number | null;
};

const { values: args } = parseArgs({
  options: {
    'base-url': { type: 'string', default: 'http://localhost:8787' },
    only: { type: 'string' },
    check: { type: 'boolean', default: false },
    save: { type: 'boolean', default: false },
  },
});
const baseUrl = args['base-url']!;
const benchmark = parseBenchmark(JSON.parse(readFileSync(BENCHMARK_FILE, 'utf8')));
const queries = benchmark.queries.filter((q) => !args.only || q.id === args.only);
if (queries.length === 0) throw new Error(`No query ${args.only}`);

async function search(params: Record<string, string>) {
  const url = `${baseUrl}/v1/places?${new URLSearchParams(params)}`;
  const get = async () => {
    const started = performance.now();
    const response = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    if (!response.ok) throw new Error(`${response.status} for ${url}`);
    const body = (await response.json()) as ListResponse;
    return { body, ms: performance.now() - started };
  };
  await get();
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await get());
  const times = runs.map((r) => r.ms).sort((a, b) => a - b);
  return { body: runs[0]!.body, latencyMs: Math.round(times[Math.floor(RUNS / 2)]!) };
}

const pct = (value: number | null) =>
  value === null ? '   —' : `${Math.round(value * 100)}%`.padStart(4);

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
try {
  const health = await fetch(`${baseUrl}/health`).catch(() => null);
  if (!health?.ok) throw new Error(`No API at ${baseUrl}: start it with pnpm --filter api dev`);

  const results: QueryResult[] = [];
  console.log('query                          P@10 R@10  ret  rel  known  ms  notes');
  for (const query of queries) {
    const near = benchmark.locations[query.near]!;
    const { body, latencyMs } = await search(apiParams(query, near));
    const ids = body.items.map((item) => item.id);
    const judged = await judge(sql, query, judgedCircle(query, near), ids);
    const result = scoreQuery(query, {
      ...judged,
      returned: ids.length,
      nearestBeyondKm: body.nearestBeyondKm,
      area: body.area,
      latencyMs,
    });
    results.push(result);
    const notes = [
      result.zeroResult ? 'ZERO RESULTS' : '',
      result.negativePass === false ? 'NEGATIVE RETURNED PLACES' : '',
      result.areaMatched === false ? `WRONG PLACE (${body.area?.name ?? 'none'})` : '',
    ].filter(Boolean);
    console.log(
      `${query.id.padEnd(30)} ${pct(result.precision)} ${pct(result.recall)} ${String(result.returned).padStart(4)} ${String(result.relevantInCircle).padStart(4)}  ${`${result.knownFound}/${result.knownTotal}`.padStart(5)} ${String(latencyMs).padStart(4)}  ${notes.join(', ')}`,
    );
    if (args.only) {
      for (const item of body.items) {
        console.log(
          `  ${item.id} ${item.name ?? 'sin nombre'} [${item.categories.map((c) => c.slug).join(', ')}]`,
        );
      }
    }
  }

  const summary = summarize(results);
  console.log(`
Queries ${summary.queries} · precision@10 ${pct(summary.precisionAt10)} · recall@10 ${pct(summary.recallAt10)} · zero results ${pct(summary.zeroResultRate)}
Known items ${pct(summary.knownItemRate)} · negative cases passed ${pct(summary.negativePassRate)} · place intent ${pct(summary.areaIntentRate)} · latency p50 ${summary.latencyP50Ms} ms, p95 ${summary.latencyP95Ms} ms`);

  let baseline: Baseline | null = null;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as Baseline;
  } catch {
    console.log('\nNo baseline yet: run with --save to record one.');
  }
  const [{ count: visiblePlaces }] = await sql<
    [{ count: number }]
  >`SELECT count(*)::int AS count FROM places WHERE hidden_at IS NULL`;
  let regressionCount = 0;
  if (baseline) {
    const regressions = findRegressions(baseline.results, results);
    regressionCount = regressions.length;
    const compared = results.filter((r) => baseline.results.some((b) => b.id === r.id)).length;
    console.log(
      `\nAgainst the baseline of ${baseline.createdOn} (${baseline.commit}): ${regressions.length} of ${compared} queries regressed (${pct(compared ? regressions.length / compared : null)}).`,
    );
    for (const r of regressions) console.log(`  ${r.id}: ${r.reasons.join('; ')}`);
    if (baseline.visiblePlaces !== visiblePlaces) {
      console.log(
        `  Note: the data changed since the baseline (${baseline.visiblePlaces} → ${visiblePlaces} visible places).`,
      );
    }
  }

  if (args.save) {
    if (args.only) throw new Error('--save needs every query (drop --only)');
    const commit = execSync('git rev-parse --short HEAD').toString().trim();
    const record: Baseline = {
      createdOn: new Date().toLocaleDateString('sv'),
      commit,
      visiblePlaces,
      summary,
      results,
    };
    writeFileSync(BASELINE_FILE, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`\nBaseline saved to data/search-baseline.json.`);
  }
  if (args.check && regressionCount > 0) process.exitCode = 1;
} finally {
  await sql.end();
}
