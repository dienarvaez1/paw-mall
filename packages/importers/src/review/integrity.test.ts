import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db-url.ts';
import { type IntegrityCheck, integrityReport } from './integrity.ts';

// Needs the local database (pnpm db:up && pnpm db:migrate), like the API tests.
const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
const ids: Record<string, number> = {};
let report: IntegrityCheck[] = [];

async function addPlace(
  key: string,
  { name = `Veterinaria ${key}`, lat = 19.4326, lng = -99.1332, phone = '55 1234 5678' } = {},
  extra: { hours?: unknown; sourceUpdatedOn?: string; website?: string } = {},
) {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, phone, location, hours,
                        source_updated_on, website)
    VALUES ('curated', ${`test-integrity-${key}`}, ${name}, 'Calle 1', 'Ciudad', 'Estado', ${phone},
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${extra.hours ? sql.json(extra.hours as never) : null},
            ${extra.sourceUpdatedOn ?? null}, ${extra.website ?? null})
    RETURNING id`;
  ids[key] = row!.id;
  return row!.id;
}

/** The ids a check flagged among this test's places. */
const flagged = (check: string) =>
  report
    .find((c) => c.id === check)!
    .samples.map((s) => s.id)
    .filter((id) => Object.values(ids).includes(id))
    .sort((a, b) => a - b);

beforeAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-integrity-%'`;
  // A twin 10 m away with the same name, accents and case aside.
  await addPlace('original', { name: 'Clínica Huellitas', lat: 19.5, lng: -99.2 });
  await addPlace('twin', { name: 'CLINICA HUELLITAS', lat: 19.50009, lng: -99.2 });
  await addPlace('elsewhere', { name: 'Clínica Huellitas', lat: 19.6, lng: -99.2 });
  // Two market stalls: one name, one spot, different phones.
  await addPlace('stall', { name: 'Cocina Económica', lat: 19.7, lng: -99.2 });
  await addPlace('stall-next', {
    name: 'Cocina Economica',
    lat: 19.7,
    lng: -99.2,
    phone: '55 0000',
  });
  await addPlace('outside', { lat: 40.4, lng: -3.7 });
  const week = (open: string) =>
    Object.fromEntries(
      ['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, { open, close: '18:00' }]),
    );
  await addPlace('bad-hours', {}, { hours: week('25:00') });
  await addPlace('good-hours', {}, { hours: week('09:00') });
  await addPlace('stale', {}, { sourceUpdatedOn: '2020-01-01' });
  await addPlace('unchecked-website', {}, { website: 'https://example.com' });
  const hospital = await addPlace('hospital-no-phone', { phone: null as never });
  await sql`INSERT INTO place_categories (place_id, category_id, source)
            SELECT ${hospital}, id, 'curated' FROM categories WHERE slug = 'vet_hospital'`;
  const hint = await addPlace('name-24h');
  await sql`INSERT INTO vet_details (place_id, open24h, open24h_source) VALUES (${hint}, true, 'name')`;
  await sql`INSERT INTO place_reports (place_id, reason, client_id)
            VALUES (${ids.stale!}, 'closed', 'phone-0000000000000001')`;
  report = await integrityReport(sql, 10_000);
});

afterAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-integrity-%'`;
  await sql.end();
});

describe('integrityReport', () => {
  it('runs every check, each with a count at least as large as its samples', () => {
    expect(report.map((c) => c.id)).toEqual([
      'outside_mexico',
      'duplicates',
      'same_name_nearby',
      'invalid_hours',
      'urgent_without_phone',
      'urgent_unconfirmed_24h',
      'stale_source',
      'website_unchecked',
      'policy_stale',
      'no_category',
      'review_queue',
    ]);
    for (const check of report) expect(check.count).toBeGreaterThanOrEqual(check.samples.length);
  });

  it('flags coordinates outside Mexico', () => {
    expect(flagged('outside_mexico')).toEqual([ids.outside]);
  });

  it('flags the same name and phone within 50 m once, ignoring accents and case', () => {
    expect(flagged('duplicates')).toEqual([ids.original]);
  });

  it('lists the same name nearby with other phones apart', () => {
    expect(flagged('same_name_nearby')).toEqual([ids.stall]);
  });

  it('flags hours the shared schema rejects', () => {
    expect(flagged('invalid_hours')).toEqual([ids['bad-hours']]);
  });

  it('flags Urgencias places without a phone and "24 horas" only from the name', () => {
    expect(flagged('urgent_without_phone')).toEqual([ids['hospital-no-phone']]);
    expect(flagged('urgent_unconfirmed_24h')).toEqual([ids['name-24h']]);
  });

  it('flags stale sources, unchecked websites and reported places', () => {
    expect(flagged('stale_source')).toEqual([ids.stale]);
    expect(flagged('website_unchecked')).toEqual([ids['unchecked-website']]);
    expect(flagged('review_queue')).toEqual([ids.stale]);
  });
});
