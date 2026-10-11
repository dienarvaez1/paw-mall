import { describe, expect, it } from 'vitest';

import { EMPTY_PET_POLICY, buildPetPolicy } from './claim-pet-policy';

describe('buildPetPolicy', () => {
  it('sends the owner choices', () => {
    expect(
      buildPetPolicy({
        ...EMPTY_PET_POLICY,
        cats: true,
        maxDogSize: 'large',
        areas: ['terrace'],
        rules: '  Con correa  ',
      }),
    ).toEqual({
      dogs: true,
      cats: true,
      otherPets: false,
      maxDogSize: 'large',
      maxWeightKg: null,
      maxPets: null,
      fee: null,
      areas: ['terrace'],
      rules: 'Con correa',
    });
  });

  it('derives the size from a weight limit, and rejects a weight that is not a number', () => {
    expect(buildPetPolicy({ ...EMPTY_PET_POLICY, maxWeightKg: '15,5' })).toMatchObject({
      maxDogSize: 'medium',
      maxWeightKg: 15.5,
    });
    expect(buildPetPolicy({ ...EMPTY_PET_POLICY, maxWeightKg: 'grande' })).toBeNull();
  });

  it('drops size and weight without dogs', () => {
    expect(
      buildPetPolicy({ ...EMPTY_PET_POLICY, dogs: false, maxDogSize: 'small', maxWeightKg: '8' }),
    ).toMatchObject({ dogs: false, maxDogSize: null, maxWeightKg: null });
  });
});
