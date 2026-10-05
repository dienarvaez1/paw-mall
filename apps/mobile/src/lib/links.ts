export type Platform = 'ios' | 'android' | 'web' | 'windows' | 'macos';

export type DirectionsTarget = {
  name: string | null;
  address: string;
  city: string;
  state: string;
  location: { lat: number; lng: number };
};

/**
 * What the maps app searches for: the business name with its full address, so it finds the actual
 * listing (often with its own hours and phone) instead of a bare pin. Unnamed places use the
 * address alone.
 */
export function directionsQuery(target: DirectionsTarget): string {
  return [target.name, target.address, target.city, target.state, 'México']
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

export type MapsApp = 'apple' | 'google' | 'waze';

/** The maps apps offered for directions: Apple Maps exists only on Apple devices. */
export function mapsAppsFor(platform: Platform): MapsApp[] {
  return platform === 'ios' || platform === 'macos'
    ? ['apple', 'google', 'waze']
    : ['google', 'waze'];
}

/**
 * Driving directions in each app's official link format; these open the app when it's installed
 * and its website otherwise, with no URL schemes to declare.
 * - Apple Maps and Google Maps search for the business by name and address (finding the listing);
 *   Apple's `sll` biases the search to the place's location.
 * - Waze navigates to the place's coordinates, the most reliable form of its links.
 */
export function directionsUrl(app: MapsApp, target: DirectionsTarget): string {
  const query = encodeURIComponent(directionsQuery(target));
  const coords = `${target.location.lat},${target.location.lng}`;
  switch (app) {
    case 'apple':
      return `https://maps.apple.com/?daddr=${query}&sll=${coords}&dirflg=d`;
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`;
    case 'waze':
      return `https://waze.com/ul?ll=${coords}&navigate=yes`;
  }
}

export function phoneUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
