import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db-url.ts';
import { inspectWebsite } from './check.ts';
import { nameWords, pageNamesPlace, readPage } from './page.ts';
import { saveFindings } from './save.ts';

const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe('readPage', () => {
  it('reads schema.org hours, also inside @graph', () => {
    const html = jsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Tacos' },
        {
          '@type': 'Restaurant',
          openingHoursSpecification: [
            { dayOfWeek: ['Monday', 'Tuesday'], opens: '13:00', closes: '23:00' },
          ],
        },
      ],
    });
    expect(readPage(html).hours?.['1']).toEqual({ open: '13:00', close: '23:00' });
    expect(readPage(jsonLd({ openingHours: 'Mo-Su 08:00-20:00' })).hours?.['0']).toEqual({
      open: '08:00',
      close: '20:00',
    });
  });

  it('says pet-friendly from petsAllowed or welcoming words, never next to a no', () => {
    expect(readPage(jsonLd({ '@type': 'Hotel', petsAllowed: true })).petFriendly).toBe(true);
    expect(readPage(`${jsonLd({ petsAllowed: 'false' })}<p>Pet friendly</p>`).petFriendly).toBe(
      false,
    );
    expect(readPage('<h2>Somos <b>Pet Friendly</b> 🐶</h2>').petFriendly).toBe(true);
    expect(readPage('<p>¡Tus mascotas son bienvenidas en la terraza!</p>').petFriendly).toBe(true);
    expect(
      readPage('<p>Pet friendly. No se permiten mascotas en el interior.</p>').petFriendly,
    ).toBe(false);
    expect(readPage('<p>Hot dogs y perros calientes</p>').petFriendly).toBe(false);
    expect(readPage('<script>var x = "pet friendly";</script><p>Menú</p>').petFriendly).toBe(false);
  });
});

describe('pageNamesPlace', () => {
  it('needs every distinctive word of the name on the page', () => {
    expect(nameWords('Restaurante Hostería de la Selva Negra')).toEqual([
      'hosteria',
      'selva',
      'negra',
    ]);
    expect(
      pageNamesPlace('bienvenidos a hosteria de la selva negra', 'Hostería de la Selva Negra'),
    ).toBe(true);
    expect(pageNamesPlace('hoteles tryp by wyndham', 'Hotel Tryp WTC Mexico')).toBe(true);
    expect(pageNamesPlace('sucursales sushi roll', 'Sushi Roll Pedregal')).toBe(false);
    expect(pageNamesPlace('hotel', 'Hotel Centro')).toBe(false);
  });
});

describe('inspectWebsite', () => {
  const fake = (body: string, init: ResponseInit) =>
    (async () => new Response(body, init)) as typeof fetch;

  it('reads a working HTML homepage', async () => {
    const result = await inspectWebsite(
      'https://example.mx',
      fake('<p>Pet friendly</p>', { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    expect(result).toMatchObject({ check: 'ok', findings: { hours: null, petFriendly: true } });
  });

  it('skips the page when it is not HTML or not working', async () => {
    const pdf = await inspectWebsite(
      'https://example.mx',
      fake('%PDF', { status: 200, headers: { 'content-type': 'application/pdf' } }),
    );
    expect(pdf).toEqual({ check: 'ok', findings: null });
    const gone = await inspectWebsite('https://example.mx', fake('', { status: 404 }));
    expect(gone).toEqual({ check: 'dead', findings: null });
  });
});

// Needs the test database, like the other importer tests.
describe('saveFindings', () => {
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  const siteOf = (key: string) => `https://${key}.test-findings.example.mx/`;
  const chainSite = 'https://cadena.example.mx/';
  afterAll(async () => {
    await sql`DELETE FROM places WHERE external_id LIKE 'test-findings-%'`;
    await sql.end();
  });

  it('gives hours to the places and a policy to venues without one', async () => {
    await sql`DELETE FROM places WHERE external_id LIKE 'test-findings-%'`;
    const ids: Record<string, number> = {};
    for (const [key, slug] of [
      ['cafe', 'cafe'],
      ['vet', 'veterinarian'],
      ['curated', 'cafe'],
      ['branch-a', 'cafe'],
      ['branch-b', 'cafe'],
    ] as const) {
      const website = key.startsWith('branch') ? chainSite : siteOf(key);
      const [row] = await sql<{ id: number }[]>`
        INSERT INTO places (source, external_id, name, address, city, state, location, website)
        VALUES ('denue', ${`test-findings-${key}`}, 'Lugar Prueba', 'Calle 1', 'Ciudad', 'Estado',
                ST_SetSRID(ST_MakePoint(-131, 2), 4326)::geography, ${website})
        RETURNING id`;
      ids[key] = row!.id;
      await sql`INSERT INTO place_categories (place_id, category_id, source)
                SELECT ${row!.id}, id, 'activity' FROM categories WHERE slug = ${slug}`;
    }
    await sql`INSERT INTO pet_policies (place_id, dogs, source, last_confirmed_on)
              VALUES (${ids.curated!}, false, 'curated', '2026-10-01')`;
    const hours = {
      0: null,
      1: { open: '09:00', close: '18:00' },
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    };
    const found = { hours, petFriendly: true, text: 'bienvenidos a lugar prueba' };
    for (const key of ['cafe', 'vet', 'curated']) await saveFindings(sql, siteOf(key), found);
    expect(await saveFindings(sql, chainSite, found)).toEqual({ hours: 0, petFriendly: 0 });
    // A page that doesn't name the place speaks for nothing.
    expect(await saveFindings(sql, siteOf('vet'), { ...found, text: 'otra cosa' })).toEqual({
      hours: 0,
      petFriendly: 0,
    });
    await saveFindings(sql, siteOf('vet'), found);
    const rows = await sql`
      SELECT p.external_id, p.hours_source, pp.source, pp.source_name FROM places p
      LEFT JOIN pet_policies pp ON pp.place_id = p.id
      WHERE p.external_id LIKE 'test-findings-%' ORDER BY 1`;
    expect(rows.map((r) => [r.external_id, r.hours_source, r.source, r.source_name])).toEqual([
      ['test-findings-branch-a', null, null, null],
      ['test-findings-branch-b', null, null, null],
      ['test-findings-cafe', 'website', 'website', 'cafe.test-findings.example.mx'],
      ['test-findings-curated', 'website', 'curated', null],
      ['test-findings-vet', 'website', null, null],
    ]);
    // The page dropped both: they go away, the curated policy stays.
    await saveFindings(sql, siteOf('cafe'), { hours: null, petFriendly: false, text: '' });
    const [left] = await sql`
      SELECT p.hours_source, pp.source FROM places p
      LEFT JOIN pet_policies pp ON pp.place_id = p.id
      WHERE p.external_id = 'test-findings-cafe'`;
    expect(left).toEqual({ hours_source: null, source: null });
  });
});
