import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AreaCollector, type Landmark, landmarkAreas, nameKey } from './build.ts';

const row = (colonia: string, lat: number, lng: number, extra: Record<string, string> = {}) => ({
  entidad: 'Ciudad de México',
  municipio: 'Cuauhtémoc',
  localidad: 'Cuauhtémoc                    ',
  nomb_asent: colonia,
  latitud: String(lat),
  longitud: String(lng),
  ...extra,
});

describe('nameKey', () => {
  it('drops accents, punctuation, case and settlement prefixes', () => {
    expect(nameKey('Col. Roma Norte')).toBe('roma norte');
    expect(nameKey('ZÓCALO')).toBe('zocalo');
    expect(nameKey('Plaza de la Constitución')).toBe('plaza de la constitucion');
    expect(nameKey('Barrio San Lucas')).toBe('san lucas');
  });
});

describe('AreaCollector', () => {
  it('centers each colonia on the median business, ignoring a far-off outlier', () => {
    const collector = new AreaCollector();
    for (const [lat, lng] of [
      [19.41, -99.16],
      [19.42, -99.17],
      [19.43, -99.15],
      [19.415, -99.165],
      [25, -80], // a mistyped coordinate
    ]) {
      collector.add(row('ROMA NORTE', lat as number, lng as number));
    }
    const roma = collector.areas().find((a) => a.kind === 'colonia');
    expect(roma).toMatchObject({
      name: 'Roma Norte',
      nameKey: 'roma norte',
      municipality: 'Cuauhtémoc',
      lat: 19.42,
      lng: -99.16,
      businessCount: 5,
    });
  });

  it('keeps municipalities, skips towns named like their municipality and tiny colonias', () => {
    const collector = new AreaCollector();
    collector.add(row('JUAREZ', 19.42, -99.16));
    collector.add(row('NINGUNO', 19.42, -99.16));
    const kinds = collector.areas().map((a) => `${a.kind}:${a.name}`);
    expect(kinds).toEqual(['municipality:Cuauhtémoc']);
  });

  it('adds towns that differ from their municipality once they have enough businesses', () => {
    const collector = new AreaCollector();
    for (let i = 0; i < 20; i++) {
      collector.add(
        row('CENTRO', 19.29, -99.66, {
          entidad: 'México',
          municipio: 'Toluca',
          localidad: 'Toluca de Lerdo',
        }),
      );
    }
    expect(collector.areas().map((a) => `${a.kind}:${a.name}`)).toEqual([
      'municipality:Toluca',
      'town:Toluca de Lerdo',
      'colonia:Centro',
    ]);
  });
});

describe('landmarks', () => {
  it('gives every name and alias its own key at the same point', () => {
    const areas = landmarkAreas([
      { name: 'Zócalo', aliases: ['Plaza de la Constitución'], lat: 19.4326, lng: -99.1332 },
    ]);
    expect(areas.map((a) => [a.name, a.nameKey, a.lat])).toEqual([
      ['Zócalo', 'zocalo', 19.4326],
      ['Zócalo', 'plaza de la constitucion', 19.4326],
    ]);
  });

  it('has a valid curated list (data/landmarks.json)', () => {
    const list = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../data/landmarks.json'), 'utf8'),
    ) as Landmark[];
    expect(list.length).toBeGreaterThan(0);
    for (const l of list) {
      expect(l.name.length).toBeGreaterThan(1);
      // Inside the nine states' box.
      expect(l.lat).toBeGreaterThan(16.3);
      expect(l.lat).toBeLessThan(21.7);
      expect(l.lng).toBeGreaterThan(-103.8);
      expect(l.lng).toBeLessThan(-96.7);
    }
  });
});
