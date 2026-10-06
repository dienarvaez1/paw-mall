import { describe, expect, it } from 'vitest';

import { directionsQuery, directionsUrl, mapsAppsFor, phoneUrl } from './links';

const place = {
  name: 'Veterinaria Huellitas',
  address: 'Calle Corregidora 7 B, Col. Centro, C.P. 06060',
  city: 'Cuauhtémoc',
  state: 'Ciudad de México',
  location: { lat: 19.4302, lng: -99.1365 },
};
const query = encodeURIComponent(
  'Veterinaria Huellitas, Calle Corregidora 7 B, Col. Centro, C.P. 06060, Cuauhtémoc, Ciudad de México, México',
);

describe('directionsQuery', () => {
  it('searches by business name and full address', () => {
    expect(directionsQuery(place)).toBe(
      'Veterinaria Huellitas, Calle Corregidora 7 B, Col. Centro, C.P. 06060, Cuauhtémoc, Ciudad de México, México',
    );
  });

  it('spells out Estado de México, which DENUE calls just "México"', () => {
    expect(directionsQuery({ ...place, city: 'Metepec', state: 'México' })).toContain(
      'Metepec, Estado de México, México',
    );
  });

  it('uses the address alone for unnamed places', () => {
    expect(directionsQuery({ ...place, name: null })).toBe(
      'Calle Corregidora 7 B, Col. Centro, C.P. 06060, Cuauhtémoc, Ciudad de México, México',
    );
  });
});

describe('mapsAppsFor', () => {
  it('offers Apple Maps only on Apple devices', () => {
    expect(mapsAppsFor('ios')).toEqual(['apple', 'google', 'waze']);
    expect(mapsAppsFor('android')).toEqual(['google', 'waze']);
  });
});

describe('directionsUrl', () => {
  it('opens Apple Maps directions to the business, searching near the place', () => {
    expect(directionsUrl('apple', place)).toBe(
      `https://maps.apple.com/?daddr=${query}&sll=19.4302,-99.1365&dirflg=d`,
    );
  });

  it("opens Google Maps driving directions to the place's exact point, not a name search", () => {
    // A name search sent "Peluditos" in Metepec to a same-name business in another city.
    expect(directionsUrl('google', place)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=19.4302,-99.1365&travelmode=driving',
    );
  });

  it("navigates with Waze to the place's coordinates", () => {
    expect(directionsUrl('waze', place)).toBe(
      'https://waze.com/ul?ll=19.4302,-99.1365&navigate=yes',
    );
  });
});

describe('phoneUrl', () => {
  it('keeps only digits', () => {
    expect(phoneUrl('55 3398 8168')).toBe('tel:5533988168');
  });
});
