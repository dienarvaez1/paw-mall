import type { Place } from '@paw-mall/shared';

import { placeLine } from './place-line';

type SharedPlace = Pick<Place, 'address' | 'city' | 'state' | 'phone' | 'location'>;

/** What tapping the address copies: "Name, street address, city, state". */
export function placeCopyText(name: string, place: SharedPlace): string {
  return [name, place.address, placeLine(place)]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * The share sheet's message: the name, the address on two lines, the phone if any, and a Google
 * Maps link to the place's coordinates (opens in any browser or maps app).
 */
export function placeShareMessage(name: string, place: SharedPlace): string {
  const { lat, lng } = place.location;
  return [
    name,
    place.address,
    placeLine(place),
    place.phone,
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  ]
    .filter((line): line is string => Boolean(line?.trim()))
    .join('\n');
}
