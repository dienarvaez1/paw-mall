/** Kilometers per degree of latitude. */
const KM_PER_DEGREE = 111.32;
/** Room around the circle so its edge isn't flush with the screen. */
const MARGIN = 1.15;

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/** A map region centered on a point that fits a circle of radiusKm around it. */
export function regionForRadius(center: { lat: number; lng: number }, radiusKm: number): MapRegion {
  const latitudeDelta = (2 * radiusKm * MARGIN) / KM_PER_DEGREE;
  // A degree of longitude shrinks toward the poles.
  const longitudeDelta = latitudeDelta / Math.cos((center.lat * Math.PI) / 180);
  return { latitude: center.lat, longitude: center.lng, latitudeDelta, longitudeDelta };
}

/**
 * The radius of the circle that fits a map view (the reverse of regionForRadius): what the user
 * set by zooming by hand. In km, to 0.1, from 0.1 up to maxKm.
 */
export function radiusForRegion(region: MapRegion, maxKm: number): number {
  const heightKm = region.latitudeDelta * KM_PER_DEGREE;
  const widthKm =
    region.longitudeDelta * KM_PER_DEGREE * Math.cos((region.latitude * Math.PI) / 180);
  const radiusKm = Math.min(heightKm, widthKm) / 2 / MARGIN;
  return Math.min(maxKm, Math.max(0.1, Math.round(radiusKm * 10) / 10));
}

/** Smallest span the map zooms to, so a cluster of places at one address still opens up. */
const MIN_DELTA = 0.004;

/** A map region that fits a box [minLng, minLat, maxLng, maxLat] with a margin. */
export function regionForBounds([minLng, minLat, maxLng, maxLat]: readonly [
  number,
  number,
  number,
  number,
]): MapRegion {
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.3, MIN_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * 1.3, MIN_DELTA),
  };
}
