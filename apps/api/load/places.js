/* global __ENV */
// Load test of the API's read endpoints, plus a burst of writes that checks the rate limit.
// Runs with k6 (https://k6.io), installed apart from the repo (`brew install k6`), against the
// local API on the full dev data: `pnpm --filter api dev:load`, then `pnpm load`. See
// docs/DEVELOPMENT.md, "Load test".
//
// Never point it at a deployed API (CLAUDE.md, "Development only"), and never call
// POST /places/:id/google: each lookup can be a billed Google request. dev:load also runs without
// the Google key, so the API couldn't call Google anyway.
import { check, group, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8789';
const PEAK_USERS = Number(__ENV.PEAK_USERS || 50);

// Busy cities, so the queries scan the densest parts of the data.
const CITIES = [
  { name: 'cdmx', lat: 19.4326, lng: -99.1332 },
  { name: 'guadalajara', lat: 20.6767, lng: -103.3475 },
  { name: 'monterrey', lat: 25.6866, lng: -100.3161 },
  { name: 'puebla', lat: 19.0414, lng: -98.2063 },
  { name: 'merida', lat: 20.9674, lng: -89.5926 },
  { name: 'tijuana', lat: 32.5149, lng: -117.0382 },
];
const RADII_KM = [5, 10, 25];
const SEARCHES = ['veterinaria', 'estetica canina', 'croquetas', 'Coyoacán', 'Zapopan'];
const TYPING = ['Puerto V', 'Guada', 'Coyo', 'Polanco'];
const ENDPOINTS = ['list', 'map', 'area-suggestions', 'area', 'search', 'detail', 'urgent'];

export const options = {
  scenarios: {
    // People browsing: ramps to PEAK_USERS at once, each pausing about a second between screens.
    reads: {
      executor: 'ramping-vus',
      exec: 'reads',
      startVUs: 1,
      stages: [
        { duration: '30s', target: PEAK_USERS },
        { duration: '1m', target: PEAK_USERS },
        { duration: '15s', target: 0 },
      ],
    },
    // One phone sending 25 writes in a row: the first 20 reach the API (and fail validation, so
    // nothing is stored), the rest get 429 RATE_LIMITED (20 per minute, wrangler.toml).
    writes: {
      executor: 'per-vu-iterations',
      exec: 'writes',
      vus: 1,
      iterations: 1,
      startTime: '10s',
    },
  },
  thresholds: {
    'http_req_duration{scenario:reads}': ['p(95)<500'],
    'http_req_failed{scenario:reads}': ['rate<0.01'],
    'checks{scenario:writes}': ['rate==1'],
    // Per endpoint, only so the summary lists each one's times (always true).
    ...Object.fromEntries(
      ENDPOINTS.map((name) => [`http_req_duration{name:${name}}`, ['max>=0']]),
    ),
  },
  summaryTrendStats: ['med', 'p(95)', 'max'],
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const query = (params) =>
  Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
const get = (path, params, name) =>
  http.get(`${BASE_URL}/v1/places${path}?${query(params)}`, { tags: { name } });

export function reads() {
  const city = pick(CITIES);
  const here = { lat: city.lat, lng: city.lng };
  const radiusKm = pick(RADII_KM);
  let ids = [];

  group('nearby', () => {
    const list = get('', { ...here, radiusKm, group: 'pet_business' }, 'list');
    check(list, { 'list 200': (r) => r.status === 200 });
    if (list.status === 200) ids = list.json('items').map((place) => place.id);

    const d = radiusKm / 111;
    const bbox = [city.lng - d, city.lat - d, city.lng + d, city.lat + d].join(',');
    const map = get('/map', { ...here, radiusKm, bbox, group: 'pet_business' }, 'map');
    check(map, { 'map 200': (r) => r.status === 200 });
  });
  sleep(1);

  group('search', () => {
    const typed = get('/area-suggestions', { ...here, q: pick(TYPING) }, 'area-suggestions');
    check(typed, { 'suggestions 200': (r) => r.status === 200 });
    const q = pick(SEARCHES);
    const area = get('/area', { ...here, q }, 'area');
    check(area, { 'area 200': (r) => r.status === 200 });
    const found = get('', { ...here, radiusKm, q }, 'search');
    check(found, { 'search 200': (r) => r.status === 200 });
  });
  sleep(1);

  group('detail', () => {
    if (ids.length > 0) {
      const place = http.get(`${BASE_URL}/v1/places/${pick(ids)}`, { tags: { name: 'detail' } });
      check(place, { 'detail 200': (r) => r.status === 200 });
    }
    const urgent = get('/urgent', { ...here, radiusKm: 25 }, 'urgent');
    check(urgent, { 'urgent 200': (r) => r.status === 200 });
  });
  sleep(1);
}

export function writes() {
  const statuses = [];
  for (let i = 0; i < 25; i++) {
    // An empty report: rejected by validation after the rate limiter has counted it.
    const res = http.post(`${BASE_URL}/v1/places/1/reports`, '{}', {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'report' },
      responseCallback: http.expectedStatuses(400, 429),
    });
    statuses.push(res.status);
  }
  check(statuses, {
    'first 20 writes reach the API': (s) => s.slice(0, 20).every((status) => status === 400),
    'writes after 20 get 429': (s) => s.slice(20).every((status) => status === 429),
  });
}
