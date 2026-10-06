import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCsvRecords } from '../csv.ts';
import {
  type DenuePlace,
  buildAddress,
  categorize,
  dedupeChainBranches,
  formatPhone,
  isCrueltyLinked,
  mapDenueRow,
  normalizeWebsite,
  parseEditionDate,
  titleCase,
} from './map.ts';

/** The sample file is Latin-1, like INEGI's. */
async function sampleRows() {
  const text = readFileSync(
    join(import.meta.dirname, '../../test/fixtures/denue-sample.csv'),
    'latin1',
  );
  const rows: Record<string, string>[] = [];
  for await (const row of parseCsvRecords(text.split(/\r?\n/))) rows.push(row);
  return new Map(rows.map((row) => [row.id ?? '', row]));
}

async function mapSample(id: string) {
  const row = (await sampleRows()).get(id);
  if (!row) throw new Error(`No sample row ${id}`);
  return mapDenueRow(row);
}

async function placeFromSample(id: string): Promise<DenuePlace> {
  const mapped = await mapSample(id);
  if (mapped?.kind !== 'place') throw new Error(`Row ${id} is not a place`);
  return mapped.place;
}

const slugs = (place: DenuePlace) => place.categories.map((c) => `${c.slug}:${c.source}`);

describe('mapDenueRow on the sample file', () => {
  it('maps a pet store with its contact data', async () => {
    expect(await placeFromSample('1')).toMatchObject({
      externalId: '1',
      activityCode: '465911',
      name: 'Tienda de Mascotas la Patita',
      categories: [{ slug: 'pet_store', source: 'activity' }],
      address: 'Calle Madero 10, Col. Centro, C.P. 06000',
      city: 'Cuauhtémoc',
      state: 'Ciudad de México',
      phone: '55 3708 8580',
      website: 'https://www.lapatita.mx',
      registeredOn: '2019-07-01',
    });
  });

  it('adds categories picked from the name', async () => {
    expect(slugs(await placeFromSample('2'))).toEqual(['pet_store:activity', 'boutique:name']);
    expect(slugs(await placeFromSample('4'))).toEqual(['veterinarian:activity', 'groomer:name']);
  });

  it('marks vet hospitals and "24 horas" hints', async () => {
    const hospital = await placeFromSample('3');
    expect(slugs(hospital)).toEqual(['veterinarian:activity', 'vet_hospital:name']);
    expect(hospital.open24hHint).toBe(true);
    expect((await placeFromSample('1')).open24hHint).toBe(false);
  });

  it('lists public vet services, including animal control centers', async () => {
    expect(slugs(await placeFromSample('5'))).toEqual(['public_vet_service:activity']);
  });

  it('imports grooming and boarding from 812990 only by name', async () => {
    expect(slugs(await placeFromSample('6'))).toEqual(['groomer:name']);
    expect(slugs(await placeFromSample('7'))).toEqual(['boarding:name']);
    expect(slugs(await placeFromSample('21'))).toEqual(['groomer:name']);
    // Beauty salons for people: a grooming word but no animal.
    expect(await mapSample('8')).toBeNull();
    expect(await mapSample('9')).toBeNull();
  });

  it('imports pet crematoriums and funeral homes by name, never ones for people', async () => {
    expect(slugs(await placeFromSample('22'))).toEqual(['pet_funeral:name']);
    expect(slugs(await placeFromSample('23'))).toEqual(['pet_funeral:name']);
    expect(await mapSample('24')).toBeNull();
  });

  it('imports feed stores, including names that only look like cruelty', async () => {
    expect(slugs(await placeFromSample('10'))).toEqual(['feed_store:activity']);
    expect(slugs(await placeFromSample('14'))).toEqual(['feed_store:activity']);
  });

  it('excludes names linked to animal cruelty', async () => {
    for (const id of ['11', '12', '13']) {
      expect(await mapSample(id)).toMatchObject({ kind: 'excluded', externalId: id });
    }
  });

  it('skips other classes, chain offices and rows without coordinates', async () => {
    expect(await mapSample('18')).toBeNull();
    expect(await mapSample('15')).toBeNull();
    expect(await mapSample('19')).toBeNull();
  });

  it('falls back to the legal name and recognizes chains', async () => {
    expect((await placeFromSample('20')).name).toBe('Mascotas Felices Sa de Cv');
    expect((await placeFromSample('16')).chain).toBe('Petco');
  });

  it('merges a chain branch registered twice, keeping the entry with a phone', async () => {
    const twins = [await placeFromSample('16'), await placeFromSample('17')];
    const independent = await placeFromSample('1');
    const kept = dedupeChainBranches([...twins, independent]);
    expect(kept.map((p) => p.externalId).sort()).toEqual(['1', '17']);
  });
});

describe('categorize', () => {
  it('ignores classes outside the pet business', () => {
    expect(categorize('467111', 'ESTETICA CANINA')).toEqual([]);
  });

  it('does not take shelters for boarding', () => {
    expect(
      categorize('541942', 'HOTEL PARA PERROS Y GATOS ABANDONADOS').map((c) => c.slug),
    ).toEqual(['public_vet_service']);
  });

  it('reads accents and mixed case', () => {
    expect(categorize('812990', 'Peluquería para Mascotas').map((c) => c.slug)).toEqual([
      'groomer',
    ]);
  });
});

describe('isCrueltyLinked', () => {
  it.each([
    'VENTA DE GALLOS DE COMBATE',
    'PALENQUE DE GALLOS EL REY',
    'CRIADERO DE PERROS',
    'CRIANZA DE GALLOS',
    'CARNICERÍA DON PEPE',
    'RASTRO MUNICIPAL',
    'NAVAJAS',
    'JAULAS PARA GALLOS',
    'VENTA DE ACCESORIOS PARA GALLOS HIRAM',
    'VETERINARIA LA CASA DEL GALLERO',
    'FINCA Y GALLOS EL INFIERNO',
  ])('excludes %s', (name) => {
    expect(isCrueltyLinked(name)).toBe(true);
  });

  it.each([
    'VETERINARIA PALENQUE',
    'FORRAJERA LA CRIANZA',
    'PRODUCTOS DE CRIANZA PARA AVES DE CORRAL',
    'BODEGA EL RASTRO FERTILIZANTES',
    'FORRAJERIA EL GALLO DE ORO',
    'VETERINARIA EL TORO',
    'FORRAJES LOS DOS GALLOS',
    'VETERINARIA ESPUELA DE ORO',
  ])('keeps %s', (name) => {
    expect(isCrueltyLinked(name)).toBe(false);
  });
});

describe('helpers', () => {
  it('title-cases names, keeping small words lower case', () => {
    expect(titleCase('VETERINARIA LA ESPERANZA DEL SUR')).toBe('Veterinaria la Esperanza del Sur');
  });

  it('formats phones and rejects webmail websites', () => {
    expect(formatPhone('2222345678')).toBe('222 234 5678');
    expect(formatPhone('123')).toBeNull();
    expect(normalizeWebsite('veterinaria.lapatita1gmail.com')).toBeNull();
    expect(normalizeWebsite('HTTP://Vet.MX')).toBe('http://vet.mx');
  });

  it('builds an address without a street', () => {
    expect(buildAddress({ nomb_asent: 'ROMA NORTE', cod_postal: '06700' })).toBe(
      'Col. Roma Norte, C.P. 06700',
    );
  });

  it('reads the edition date from the data dictionary', () => {
    expect(parseEditionDate('DICCIONARIO DE DATOS DENUE (20/05/2026),,,,')).toBe('2026-05-20');
  });
});
