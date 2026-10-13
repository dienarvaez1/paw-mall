import { describe, expect, it } from 'vitest';

import { placeCopyText, placeShareMessage } from './share-text';

const place = {
  address: 'Av. Insurgentes Sur 123, Col. Roma Norte',
  city: 'Cuauhtémoc',
  state: 'Ciudad de México',
  phone: '55 1234 5678',
  location: { lat: 19.4195, lng: -99.1626 },
};

describe('placeCopyText', () => {
  it('joins the name and full address on one line', () => {
    expect(placeCopyText('Vet Roma', place)).toBe(
      'Vet Roma, Av. Insurgentes Sur 123, Col. Roma Norte, Cuauhtémoc, Ciudad de México',
    );
  });
});

describe('placeShareMessage', () => {
  it('lists name, address, phone and a maps link', () => {
    expect(placeShareMessage('Vet Roma', place)).toBe(
      [
        'Vet Roma',
        'Av. Insurgentes Sur 123, Col. Roma Norte',
        'Cuauhtémoc, Ciudad de México',
        '55 1234 5678',
        'https://www.google.com/maps/search/?api=1&query=19.4195,-99.1626',
      ].join('\n'),
    );
  });

  it('leaves out a missing phone', () => {
    expect(placeShareMessage('Vet Roma', { ...place, phone: null })).not.toContain('null');
  });
});
