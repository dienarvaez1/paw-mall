import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@/lib/use-on-wake', () => ({ useOnWake: () => {} }));

const { parseSettings, petProfileFilters } = await import('./settings-context');

describe('parseSettings', () => {
  it('reads stored values', () => {
    expect(
      parseSettings(
        '{"radiusKm":25,"units":"km","onlyWithPhone":true,"onlyWithWebsite":true,"onlyWithSocial":true,"hideUnnamed":true,"onlyOpenNow":true,"petSpecies":"dog","dogSize":"large","onlyConfirmedPetPlaces":false}',
      ),
    ).toEqual({
      radiusKm: 25,
      units: 'km',
      onlyWithPhone: true,
      onlyWithWebsite: true,
      onlyWithSocial: true,
      hideUnnamed: true,
      onlyOpenNow: true,
      petSpecies: 'dog',
      dogSize: 'large',
      onlyConfirmedPetPlaces: false,
    });
    const miles = parseSettings(`{"radiusKm":${10 * 1.609344},"units":"mi"}`);
    expect(miles.units).toBe('mi');
    expect(miles.radiusKm).toBeCloseTo(16.09344, 5);
  });

  it('moves a radius that is not a choice for the unit to the closest one', () => {
    // 25 km saved with miles selected (from an older version) becomes 15 mi.
    expect(parseSettings('{"radiusKm":25,"units":"mi"}').radiusKm).toBeCloseTo(15 * 1.609344, 5);
    expect(parseSettings('{"radiusKm":7,"units":"km"}').radiusKm).toBe(5);
  });

  it('falls back to defaults for missing, unknown or broken values', () => {
    const defaults = {
      radiusKm: 5,
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
    expect(parseSettings(null)).toEqual(defaults);
    expect(
      parseSettings('{"units":"ft","onlyWithPhone":"yes","petSpecies":"fish","dogSize":"huge"}'),
    ).toEqual(defaults);
    expect(parseSettings('not json')).toEqual(defaults);
  });
});

describe('petProfileFilters', () => {
  it('sends the profile only with the pet-friendly filter on', () => {
    expect(petProfileFilters(false, 'dog', 'large')).toEqual({});
    expect(petProfileFilters(true, null, null)).toEqual({ petFriendly: true });
    expect(petProfileFilters(true, null, null, true)).toEqual({
      petFriendly: true,
      withUnconfirmed: true,
    });
    expect(petProfileFilters(false, null, null, true)).toEqual({});
    expect(petProfileFilters(true, 'dog', 'large')).toEqual({
      petFriendly: true,
      petSpecies: 'dog',
      dogSize: 'large',
    });
  });

  it('ignores a dog size kept from before the profile changed to a cat', () => {
    expect(petProfileFilters(true, 'cat', 'large')).toEqual({
      petFriendly: true,
      petSpecies: 'cat',
    });
  });
});
