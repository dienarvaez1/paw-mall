import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  type WikidataLandmark,
  adminIds,
  landmarkNames,
  parseLandmarks,
  wikidataLandmarkAreas,
} from './wikidata.ts';

const uri = (id: string) => ({ value: `http://www.wikidata.org/entity/${id}` });
const row = (id: string, name: string, type: string, admins: string[], aliases: string[] = []) => ({
  item: uri(id),
  itemLabel: { value: name },
  typeLabel: { value: type },
  coord: { value: 'Point(-99.1414 19.4353)' },
  admins: { value: admins.map((a) => uri(a).value).join('|') },
  aliases: { value: aliases.join('|') },
});

const landmark = (over: Partial<WikidataLandmark>): WikidataLandmark => ({
  id: 'Q1',
  name: 'Palacio de Bellas Artes',
  aliases: [],
  types: ['sala de conciertos'],
  state: 'Ciudad de México',
  lat: 19.4353,
  lng: -99.1414,
  ...over,
});

describe('parseLandmarks', () => {
  const rows = [
    row('Q1139081', 'Palacio de Bellas Artes', 'sala de conciertos', ['Q100'], ['Bellas Artes']),
    row('Q1139081', 'Palacio de Bellas Artes', 'museo', ['Q100']),
    row('Q5758353', 'Catedral de Colima', 'catedral', ['Q200']),
    row('Q6940502', 'Q6940502', 'museo', ['Q100']),
  ];
  const stateOf = new Map([['Q100', 'Ciudad de México']]);

  it('merges types per item and keeps only the nine states and Spanish names', () => {
    expect(adminIds(rows)).toEqual(['Q100', 'Q200']);
    expect(parseLandmarks(rows, stateOf)).toEqual([
      {
        id: 'Q1139081',
        name: 'Palacio de Bellas Artes',
        aliases: ['Bellas Artes'],
        types: ['sala de conciertos', 'museo'],
        state: 'Ciudad de México',
        lat: 19.4353,
        lng: -99.1414,
      },
    ]);
  });
});

describe('landmarkNames', () => {
  it('answers to its name and aliases, once each', () => {
    expect(
      landmarkNames(landmark({ aliases: ['Bellas Artes', 'Palacio de Bellas Artes'] })),
    ).toEqual(['Palacio de Bellas Artes', 'Bellas Artes']);
  });

  it('names stations only as "Metro X" or "Estación X"', () => {
    const station = landmark({
      name: 'Hidalgo',
      aliases: ['Metro Hidalgo', 'Hidalgo (Metro)'],
      types: ['estación de metro'],
    });
    expect(landmarkNames(station)).toEqual(['Metro Hidalgo', 'Estación Hidalgo']);
  });

  it('skips generic one-word names and category keywords', () => {
    expect(
      landmarkNames(landmark({ name: 'Catedral', aliases: ['Hospital', 'Catedral de Puebla'] })),
    ).toEqual(['Catedral de Puebla']);
  });
});

describe('wikidataLandmarkAreas', () => {
  it('leaves names to the curated landmarks', () => {
    const areas = wikidataLandmarkAreas(
      [landmark({ aliases: ['Bellas Artes'] })],
      new Set(['bellas artes']),
    );
    expect(areas.map((a) => a.nameKey)).toEqual(['palacio de bellas artes']);
  });

  it('has a valid committed snapshot (data/landmarks-wikidata.json)', () => {
    const list = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../data/landmarks-wikidata.json'), 'utf8'),
    ) as WikidataLandmark[];
    expect(list.length).toBeGreaterThan(500);
    for (const l of list) {
      expect(l.lat).toBeGreaterThan(16.3);
      expect(l.lat).toBeLessThan(21.7);
      expect(l.name).not.toMatch(/^Q\d+$/);
    }
  });
});
