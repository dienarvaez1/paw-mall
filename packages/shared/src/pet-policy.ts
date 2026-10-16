import { z } from 'zod';

/**
 * Dog sizes for the pet profile and venue limits (owner's choice, 2026-10-10): pequeño up to
 * 10 kg, mediano 10–25 kg, grande over 25 kg.
 */
export const DOG_SIZES = ['small', 'medium', 'large'] as const;
export type DogSize = (typeof DOG_SIZES)[number];

/** Upper weight of each size band; large has none. */
export const DOG_SIZE_MAX_KG: Record<Exclude<DogSize, 'large'>, number> = { small: 10, medium: 25 };

/**
 * The largest size a weight limit lets in: a 15 kg limit takes some medium dogs, a 35 kg limit
 * some large ones. The card shows the exact limit, so the user can tell.
 */
export function dogSizeForWeightLimit(maxWeightKg: number): DogSize {
  if (maxWeightKg > DOG_SIZE_MAX_KG.medium) return 'large';
  if (maxWeightKg > DOG_SIZE_MAX_KG.small) return 'medium';
  return 'small';
}

/** Whether a venue's largest allowed size takes a dog of `size`. */
export function allowsDogSize(maxDogSize: DogSize | null, size: DogSize): boolean {
  return maxDogSize !== null && DOG_SIZES.indexOf(maxDogSize) >= DOG_SIZES.indexOf(size);
}

/** Where pets may go: inside, on a terrace, or only outdoors (a patio or garden). */
export const PET_AREAS = ['indoor', 'terrace', 'outdoor'] as const;
export type PetArea = (typeof PET_AREAS)[number];

export const PET_SPECIES = ['dog', 'cat'] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

/** A pet fee; amount 0 is free. Null on the policy when the source doesn't say. */
export const petFeeSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.enum(['MXN', 'USD']).optional(),
  per: z.enum(['night', 'stay', 'visit']).optional(),
});
export type PetFee = z.infer<typeof petFeeSchema>;

/**
 * What a venue allows, as the owner declares it or a curated source states it. Null means the
 * source doesn't say. Rules are free text in the source's language (data, not i18n).
 */
export const petPolicyInputSchema = z.object({
  dogs: z.boolean().nullable(),
  cats: z.boolean().nullable(),
  otherPets: z.boolean().nullable(),
  /** The largest dog allowed; 'large' with no weight limit means any size. Null: unknown. */
  maxDogSize: z.enum(DOG_SIZES).nullable(),
  maxWeightKg: z.number().positive().max(200).nullable(),
  maxPets: z.number().int().min(1).max(10).nullable(),
  fee: petFeeSchema.nullable(),
  areas: z.array(z.enum(PET_AREAS)).max(PET_AREAS.length),
  rules: z.string().trim().max(300).nullable(),
});
export type PetPolicyInput = z.infer<typeof petPolicyInputSchema>;

/**
 * Who stated the policy: the verified owner, the team from a public source (one venue, or a chain's
 * policy for all its branches), the business's own website, OpenStreetMap's contributors, or Pet
 * Helper's users (PET_ANSWERS_TO_PUBLISH phones agreeing).
 */
export const PET_POLICY_SOURCES = [
  'owner',
  'curated',
  'chain',
  'website',
  'osm',
  'community',
] as const;
export type PetPolicySource = (typeof PET_POLICY_SOURCES)[number];

export const petPolicySchema = petPolicyInputSchema.extend({
  source: z.enum(PET_POLICY_SOURCES),
  /** The publication or company behind a curated policy ("Hyatt", "Time Out México"). */
  sourceName: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  /** The latest of: the source check, the owner's approval, a shopper's confirmation. */
  lastConfirmedOn: z.string(),
  /** Phones that confirmed or disputed it in the last POLICY_ANSWER_WINDOW_DAYS days. */
  confirmations: z.number().int().nonnegative(),
  disputes: z.number().int().nonnegative(),
  /** Enough recent disputes: shown with a warning and left out of the filters until reviewed. */
  underReview: z.boolean(),
});
export type PetPolicy = z.infer<typeof petPolicySchema>;

export const POLICY_ANSWER_WINDOW_DAYS = 90;
/** Distinct phones disputing a policy (more than confirm it) that put it under review. */
export const POLICY_DISPUTES_TO_REVIEW = 3;

/**
 * A shopper confirming the policy still holds, or saying it changed. As with reports, clientId
 * is the app's random id, only to count each phone once; nothing else is sent or stored.
 */
export const policyAnswerSchema = z.strictObject({
  answer: z.enum(['confirm', 'dispute']),
  clientId: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
});
export type PolicyAnswer = z.infer<typeof policyAnswerSchema>;

/** Phones that must agree (more of them than disagree) before users' answers make a policy. */
export const PET_ANSWERS_TO_PUBLISH = 2;
/** Users' answers older than this no longer count. */
export const PET_ANSWER_WINDOW_DAYS = 365;

/**
 * "¿Acepta mascotas?" on a pet-friendly venue without a policy from its owner or a source: does it
 * take dogs, and if so the largest dog the user saw allowed (null: doesn't know). Same privacy
 * rule as reports: only the answer and the app's random id.
 */
export const petAnswerSchema = z.strictObject({
  takesDogs: z.boolean(),
  maxDogSize: z.enum(DOG_SIZES).nullable().optional(),
  clientId: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
});
export type PetAnswer = z.infer<typeof petAnswerSchema>;

/**
 * The policy users' answers support, or null while they don't: PET_ANSWERS_TO_PUBLISH phones
 * saying the same, more than say the opposite. The size is the lower median of the sizes given
 * with a yes, so one generous answer can't open it to larger dogs; null when none gave a size.
 */
export function communityPolicy(
  answers: readonly Pick<PetAnswer, 'takesDogs' | 'maxDogSize'>[],
): { dogs: boolean; maxDogSize: DogSize | null } | null {
  const yes = answers.filter((a) => a.takesDogs);
  const no = answers.length - yes.length;
  if (yes.length >= PET_ANSWERS_TO_PUBLISH && yes.length > no) {
    const sizes = yes
      .map((a) => a.maxDogSize)
      .filter((size) => size != null)
      .map((size) => DOG_SIZES.indexOf(size))
      .sort((a, b) => a - b);
    const median = sizes[Math.floor((sizes.length - 1) / 2)];
    return { dogs: true, maxDogSize: median === undefined ? null : DOG_SIZES[median]! };
  }
  if (no >= PET_ANSWERS_TO_PUBLISH && no > yes.length) return { dogs: false, maxDogSize: null };
  return null;
}
