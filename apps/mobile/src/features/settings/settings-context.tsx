import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_RADIUS_KM } from '@paw-mall/shared';
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

import { type DistanceUnit, UNIT_OPTIONS, closestRadiusKm, isRadiusOption } from './radius';

export { type DistanceUnit, UNIT_OPTIONS } from './radius';

type Settings = {
  radiusKm: number;
  units: DistanceUnit;
  /** Show only places that have a phone number. */
  onlyWithPhone: boolean;
  /** Show only places that have a working website. */
  onlyWithWebsite: boolean;
  /** Show only places that have a social-media page. */
  onlyWithSocial: boolean;
  /** Hide places without a real name (none, or "… sin nombre"). */
  hideUnnamed: boolean;
  /** Show only places open right now by confirmed hours. */
  onlyOpenNow: boolean;
};
type SettingsContextValue = Settings & {
  setRadiusKm: (radiusKm: number) => void;
  setUnits: (units: DistanceUnit) => void;
  setOnlyWithPhone: (onlyWithPhone: boolean) => void;
  setOnlyWithWebsite: (onlyWithWebsite: boolean) => void;
  setOnlyWithSocial: (onlyWithSocial: boolean) => void;
  setHideUnnamed: (hideUnnamed: boolean) => void;
  setOnlyOpenNow: (onlyOpenNow: boolean) => void;
};

const STORAGE_KEY = 'settings.preferences';
const DEFAULTS: Settings = {
  radiusKm: DEFAULT_RADIUS_KM,
  units: 'km',
  onlyWithPhone: false,
  onlyWithWebsite: false,
  onlyWithSocial: false,
  hideUnnamed: false,
  onlyOpenNow: false,
};

/**
 * Keeps only known values, so an old or corrupted stored value falls back to defaults. The radius
 * is always one of the selected unit's choices (radiusKm holds it converted to km).
 */
export function parseSettings(raw: string | null): Settings {
  try {
    const value = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    const units = (UNIT_OPTIONS as readonly string[]).includes(value.units ?? '')
      ? (value.units as DistanceUnit)
      : DEFAULTS.units;
    const stored = typeof value.radiusKm === 'number' ? value.radiusKm : DEFAULTS.radiusKm;
    return {
      units,
      radiusKm: isRadiusOption(stored, units) ? stored : closestRadiusKm(stored, units),
      onlyWithPhone: value.onlyWithPhone === true,
      onlyWithWebsite: value.onlyWithWebsite === true,
      onlyWithSocial: value.onlyWithSocial === true,
      hideUnnamed: value.hideUnnamed === true,
      onlyOpenNow: value.onlyOpenNow === true,
    };
  } catch {
    return DEFAULTS;
  }
}

const SettingsContext = createContext<SettingsContextValue>({
  ...DEFAULTS,
  setRadiusKm: () => {},
  setUnits: () => {},
  setOnlyWithPhone: () => {},
  setOnlyWithWebsite: () => {},
  setOnlyWithSocial: () => {},
  setHideUnnamed: () => {},
  setOnlyOpenNow: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setSettings(parseSettings(raw)))
      .catch(() => {});
  }, []);

  const value = useMemo<SettingsContextValue>(() => {
    const update = (patch: Partial<Settings>) =>
      setSettings((current) => {
        const next = { ...current, ...patch };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    return {
      ...settings,
      setRadiusKm: (radiusKm) => update({ radiusKm }),
      // Switching units moves the radius to the closest choice in the new unit.
      setUnits: (units) => update({ units, radiusKm: closestRadiusKm(settings.radiusKm, units) }),
      setOnlyWithPhone: (onlyWithPhone) => update({ onlyWithPhone }),
      setOnlyWithWebsite: (onlyWithWebsite) => update({ onlyWithWebsite }),
      setOnlyWithSocial: (onlyWithSocial) => update({ onlyWithSocial }),
      setHideUnnamed: (hideUnnamed) => update({ hideUnnamed }),
      setOnlyOpenNow: (onlyOpenNow) => update({ onlyOpenNow }),
    };
  }, [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

/**
 * The place filters chosen in Settings, as API parameters (only the ones that are on) — the same
 * object is part of each query key, so changing a switch refetches.
 */
export function usePlaceFilters() {
  const { onlyWithPhone, onlyWithWebsite, onlyWithSocial, hideUnnamed, onlyOpenNow } =
    useSettings();
  return useMemo(
    () => ({
      withPhone: onlyWithPhone || undefined,
      withWebsite: onlyWithWebsite || undefined,
      withSocial: onlyWithSocial || undefined,
      named: hideUnnamed || undefined,
      openNow: onlyOpenNow || undefined,
    }),
    [onlyWithPhone, onlyWithWebsite, onlyWithSocial, hideUnnamed, onlyOpenNow],
  );
}
