import type { Place } from '@paw-mall/shared';

/** "Coyoacán, Ciudad de México", or just the state when the city has the same name. */
export function placeLine(place: Pick<Place, 'city' | 'state'>): string {
  return place.city === place.state ? place.state : `${place.city}, ${place.state}`;
}
