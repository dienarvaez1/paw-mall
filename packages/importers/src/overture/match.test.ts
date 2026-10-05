import { DuckDBInstance } from '@duckdb/node-api';
import { describe, expect, it } from 'vitest';

import { contributions, findMatches, normalizeOverturePhone, pickSocial } from './match.ts';

async function withTables(ours: string, overture: string) {
  const db = await DuckDBInstance.create(':memory:');
  const con = await db.connect();
  await con.run('INSTALL spatial; LOAD spatial;');
  await con.run(`CREATE TABLE ours AS SELECT * FROM (VALUES ${ours}) t(id, name, lat, lng)`);
  await con.run(
    `CREATE TABLE overture AS SELECT * FROM (VALUES ${overture}) t(id, name, lat, lng, phones, websites, socials)`,
  );
  return con;
}

describe('findMatches', () => {
  it('matches nearby places with the same name, ignoring accents and shared words', async () => {
    const con = await withTables(
      `(1, 'Veterinaria San Juan', 19.43, -99.13),
       (2, 'Estetica Canina Firulais', 19.40, -99.10),
       (3, 'Petshop Luna', 19.38, -99.15),
       (4, NULL, 19.37, -99.16),
       (5, 'Veterinaria Lejana', 19.30, -99.20),
       (6, 'Clinica Veterinaria', 19.36, -99.17)`,
      `('a', 'Clínica Veterinaria San Juan', 19.43, -99.13, ['+52 55 1111 2222'], [], []),
       ('b', 'Firulais Estética Canina', 19.40008, -99.10, [], ['https://firulais.mx'], []),
       ('c', 'Pet Store Sol', 19.38, -99.15, [], [], []),
       ('d', 'Veterinaria Sin Nombre', 19.37, -99.16, [], [], []),
       ('e', 'Veterinaria Lejana', 19.302, -99.20, [], [], []),
       ('f', 'Veterinaria', 19.36, -99.17, [], [], [])`,
    );
    const matches = await findMatches(con);
    // 3: different business; 4: unnamed; 5: same name but ~220 m away; 6: only shared words.
    expect(matches.map((m) => [m.placeId, m.overtureId])).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });
});

describe('contributions', () => {
  it('normalizes the phone, filters the website and picks a social page', () => {
    expect(
      contributions({
        placeId: 1,
        overtureId: 'a',
        phones: ['+52 55 3708 8580'],
        websites: ['vetsanjuan1gmail.com', 'https://vetsanjuan.mx'],
        socials: ['not a url', 'https://www.facebook.com/vetsanjuan'],
      }),
    ).toEqual({
      phone: '55 3708 8580',
      website: 'https://vetsanjuan.mx',
      social: 'https://www.facebook.com/vetsanjuan',
    });
  });

  it('handles missing values', () => {
    expect(normalizeOverturePhone(undefined)).toBeNull();
    expect(pickSocial([])).toBeNull();
  });
});
