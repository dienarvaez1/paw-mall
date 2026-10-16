import {
  type DogSize,
  type PetArea,
  type PetPolicyInput,
  dogSizeForWeightLimit,
} from '@pet-helper/shared';

/** The claim form's pet policy fields, as typed. */
export type PetPolicyForm = {
  dogs: boolean;
  cats: boolean;
  otherPets: boolean;
  /** The largest dog size; null: the owner didn't choose. */
  maxDogSize: DogSize | null;
  /** Optional weight limit, as typed ("15", "22.5"). */
  maxWeightKg: string;
  areas: PetArea[];
  rules: string;
};

export const EMPTY_PET_POLICY: PetPolicyForm = {
  dogs: true,
  cats: false,
  otherPets: false,
  maxDogSize: null,
  maxWeightKg: '',
  areas: [],
  rules: '',
};

/**
 * The policy to send, or null when the weight isn't a number. A weight limit sets the size it
 * lets in when the owner chose none; without dogs, size and weight are dropped.
 */
export function buildPetPolicy(form: PetPolicyForm): PetPolicyInput | null {
  const typed = form.maxWeightKg.trim().replace(',', '.');
  const weight = typed ? Number(typed) : null;
  if (weight !== null && !(Number.isFinite(weight) && weight > 0 && weight <= 200)) return null;
  const dogs = form.dogs;
  return {
    dogs,
    cats: form.cats,
    otherPets: form.otherPets,
    maxDogSize: !dogs ? null : (form.maxDogSize ?? (weight ? dogSizeForWeightLimit(weight) : null)),
    maxWeightKg: dogs ? weight : null,
    maxPets: null,
    fee: null,
    areas: form.areas,
    rules: form.rules.trim() || null,
  };
}
