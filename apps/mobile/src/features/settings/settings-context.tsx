import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_RADIUS_KM,
  DOG_SIZES,
  type DogSize,
  PET_SPECIES,
  type PetSpecies,
} from '@paw-mall/shared';
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  closestRadiusKm,
  isRadiusOption,
  startRadiusKm,
  type DistanceUnit,
  UNIT_OPTIONS,
} from './radius';
import { useOnWake } from '@/lib/use-on-wake';

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
  /** The pet profile: which pet the user goes out with (null: not set). */
  petSpecies: PetSpecies | null;
  /** The dog's size, for dogs; null when not set. */
  dogSize: DogSize | null;
  /** Pet-friendly shows only places confirmed to take pets; off, also unanswered venues. */
  onlyConfirmedPetPlaces: boolean;
};
type SettingsContextValue = Settings & {
  setRadiusKm: (radiusKm: number) => void;
  setUnits: (units: DistanceUnit) => void;
  setOnlyWithPhone: (onlyWithPhone: boolean) => void;
  setOnlyWithWebsite: (onlyWithWebsite: boolean) => void;
  setOnlyWithSocial: (onlyWithSocial: boolean) => void;
  setHideUnnamed: (hideUnnamed: boolean) => void;
  setOnlyOpenNow: (onlyOpenNow: boolean) => void;
  setPetSpecies: (petSpecies: PetSpecies | null) => void;
  setDogSize: (dogSize: DogSize | null) => void;
  setOnlyConfirmedPetPlaces: (onlyConfirmedPetPlaces: boolean) => void;
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
  petSpecies: null,
  dogSize: null,
  onlyConfirmedPetPlaces: true,
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
      petSpecies: (PET_SPECIES as readonly unknown[]).includes(value.petSpecies)
        ? (value.petSpecies as PetSpecies)
        : null,
      dogSize: (DOG_SIZES as readonly unknown[]).includes(value.dogSize)
        ? (value.dogSize as DogSize)
        : null,
      onlyConfirmedPetPlaces: value.onlyConfirmedPetPlaces !== false,
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
  setPetSpecies: () => {},
  setDogSize: () => {},
  setOnlyConfirmedPetPlaces: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  // Every launch, and every return from the background, starts at the 3-mile radius.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const stored = parseSettings(raw);
        setSettings({ ...stored, radiusKm: startRadiusKm(stored.units) });
      })
      .catch(() => {});
  }, []);
  useOnWake(() =>
    setSettings((current) => ({ ...current, radiusKm: startRadiusKm(current.units) })),
  );

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
      setPetSpecies: (petSpecies) => update({ petSpecies }),
      setDogSize: (dogSize) => update({ dogSize }),
      setOnlyConfirmedPetPlaces: (onlyConfirmedPetPlaces) => update({ onlyConfirmedPetPlaces }),
    };
  }, [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

/**
 * The place filters chosen in Settings, as API parameters (only the ones that are on) — the same
 * object is part of each query key, so changing a switch refetches. With `petFriendly` (the
 * Explorar toggle, or a pet-friendly category chip), only places whose policy takes pets, and the
 * pet profile narrows them: a cat, or a dog of that size.
 */
export function usePlaceFilters(petFriendly = false, withUnconfirmed = false) {
  const {
    onlyWithPhone,
    onlyWithWebsite,
    onlyWithSocial,
    hideUnnamed,
    onlyOpenNow,
    petSpecies,
    dogSize,
  } = useSettings();
  return useMemo(
    () => ({
      withPhone: onlyWithPhone || undefined,
      withWebsite: onlyWithWebsite || undefined,
      withSocial: onlyWithSocial || undefined,
      named: hideUnnamed || undefined,
      openNow: onlyOpenNow || undefined,
      ...petProfileFilters(petFriendly, petSpecies, dogSize, withUnconfirmed),
    }),
    [
      onlyWithPhone,
      onlyWithWebsite,
      onlyWithSocial,
      hideUnnamed,
      onlyOpenNow,
      petFriendly,
      withUnconfirmed,
      petSpecies,
      dogSize,
    ],
  );
}

/**
 * The pet-friendly API parameters; the dog size counts only for dogs. `withUnconfirmed` adds
 * venues without a policy yet.
 */
export function petProfileFilters(
  petFriendly: boolean,
  petSpecies: PetSpecies | null,
  dogSize: DogSize | null,
  withUnconfirmed = false,
): {
  petFriendly?: true;
  withUnconfirmed?: true;
  petSpecies?: PetSpecies;
  dogSize?: DogSize;
} {
  if (!petFriendly) return {};
  return {
    petFriendly: true,
    ...(withUnconfirmed ? { withUnconfirmed: true as const } : {}),
    ...(petSpecies ? { petSpecies } : {}),
    ...(petSpecies === 'dog' && dogSize ? { dogSize } : {}),
  };
}
