import { z } from 'zod';

import { placeHoursSchema } from './hours';
import { petPolicyInputSchema } from './pet-policy';

/** Why a user reports a place: it closed, or it's linked to animal cruelty. */
export const PLACE_REPORT_REASONS = ['closed', 'cruelty'] as const;
export type PlaceReportReason = (typeof PLACE_REPORT_REASONS)[number];

/**
 * A user's report about a place. clientId is a random id the app keeps on the phone, only to count
 * each phone once; reports carry no location or personal information (CLAUDE.md, "Reporter
 * privacy").
 */
export const placeReportSchema = z.strictObject({
  reason: z.enum(PLACE_REPORT_REASONS),
  clientId: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
});
export type PlaceReport = z.infer<typeof placeReportSchema>;

export const receivedResponseSchema = z.object({ received: z.literal(true) });

/**
 * An owner's claim on a place: the details to publish and a contact for the review. The contact is
 * never published and is deleted after the review. (The SAT certificate check is deferred; see
 * docs/DEPLOYMENT.md, "Pending owner reviews".)
 */
export const placeClaimSchema = z
  .strictObject({
    phone: z
      .string()
      .trim()
      .regex(/^[\d +()-]{7,20}$/)
      .optional(),
    website: z
      .url({ protocol: /^https?$/ })
      .max(200)
      .optional(),
    /** A close at or before the open runs past midnight, as in placeHoursSchema. */
    hours: placeHoursSchema.optional(),
    /** Vets: open 24 hours, every day. */
    open24h: z.boolean().optional(),
    /** Vets: takes emergencies. */
    acceptsEmergencies: z.boolean().optional(),
    /** Pet-friendly venues: the pets they take. */
    petPolicy: petPolicyInputSchema.optional(),
    contactName: z.string().trim().min(2).max(100),
    contact: z.string().trim().min(5).max(120),
    consent: z.literal(true),
  })
  .refine(
    (claim) =>
      claim.phone ||
      claim.website ||
      claim.hours ||
      claim.open24h ||
      claim.acceptsEmergencies ||
      claim.petPolicy,
    { message: 'Give at least a phone, a website, opening hours, a vet detail or a pet policy' },
  );
export type PlaceClaim = z.infer<typeof placeClaimSchema>;
