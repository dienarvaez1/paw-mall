import { FALLBACK_LOCATION } from '@paw-mall/shared';
import * as Location from 'expo-location';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useOnWake } from '@/lib/use-on-wake';

export type UserLocation = {
  coords: { lat: number; lng: number };
  /** `fallback` when permission was denied or no fix was available. */
  source: 'device' | 'fallback';
  ready: boolean;
  /** Reads the device's position again (e.g. "my location" on the map); returns the new coords. */
  refresh: () => Promise<UserLocation['coords']>;
};

type LocationState = Omit<UserLocation, 'refresh'>;

const initial: LocationState = { coords: FALLBACK_LOCATION, source: 'fallback', ready: false };
const LocationContext = createContext<UserLocation>({
  ...initial,
  refresh: async () => FALLBACK_LOCATION,
});

/** The device's position; `fresh` skips the last known one (up to 5 minutes old). */
async function readDeviceLocation(fresh = false): Promise<UserLocation['coords'] | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) return null;
  const position =
    (fresh ? null : await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

function located(coords: UserLocation['coords'] | null): LocationState {
  return coords
    ? { coords, source: 'device', ready: true }
    : { coords: FALLBACK_LOCATION, source: 'fallback', ready: true };
}

/**
 * Asks for location at startup, on refresh and whenever the app returns from the background;
 * falls back to central Mexico City.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<LocationState>(initial);

  useEffect(() => {
    let cancelled = false;
    readDeviceLocation()
      .catch(() => null)
      .then((coords) => {
        if (!cancelled) setLocation(located(coords));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = located(await readDeviceLocation(true).catch(() => null));
    setLocation(next);
    return next.coords;
  }, []);

  useOnWake(() => void refresh());

  const value = useMemo(() => ({ ...location, refresh }), [location, refresh]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useUserLocation(): UserLocation {
  return useContext(LocationContext);
}
