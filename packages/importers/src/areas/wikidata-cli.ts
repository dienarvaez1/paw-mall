// Refreshes the Wikidata landmarks snapshot (data/landmarks-wikidata.json).
//
//   pnpm places:landmarks
//
// The snapshot is committed, so building the search areas (pnpm places:areas) never needs the
// network and only changes when this command is run. Wikidata is CC0.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  MEXICO_BOXES,
  STATE_IDS,
  adminIds,
  landmarksQuery,
  parseLandmarks,
  statesQuery,
} from './wikidata.ts';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'PawMall/0.1 (development; landmark search areas)';

type Bindings = Parameters<typeof parseLandmarks>[0];

async function sparql(query: string): Promise<Bindings> {
  // POST: the states query lists hundreds of ids, too long for a URL.
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ query }),
  });
  if (!response.ok) {
    throw new Error(`Wikidata: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return ((await response.json()) as { results: { bindings: Bindings } }).results.bindings;
}

const rows: Bindings = [];
for (const box of MEXICO_BOXES) {
  const part = await sparql(landmarksQuery(box));
  console.log(`Box ${box.join(',')}: ${part.length} rows`);
  rows.push(...part);
}
const admins = adminIds(rows);
const stateOf = new Map<string, string>();
for (let i = 0; i < admins.length; i += 200) {
  for (const b of await sparql(statesQuery(admins.slice(i, i + 200)))) {
    const state = STATE_IDS[b.state?.value.split('/').pop() ?? ''];
    if (state) stateOf.set(b.admin?.value.split('/').pop() ?? '', state);
  }
}
const landmarks = parseLandmarks(rows, stateOf);
const path = join(import.meta.dirname, '../../data/landmarks-wikidata.json');
writeFileSync(path, `${JSON.stringify(landmarks, null, 2)}\n`);
const byState = landmarks.reduce<Record<string, number>>((acc, l) => {
  acc[l.state] = (acc[l.state] ?? 0) + 1;
  return acc;
}, {});
console.log(`Saved ${landmarks.length} Wikidata landmarks to ${path}:`, byState);
