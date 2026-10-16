import { z } from 'zod';

/**
 * How far a place's details are confirmed, strongest doubt first (the first that applies wins):
 * - needs_review: a phone reported it (closed or cruelty) or its pet policy is disputed;
 * - owner_verified: the owner's claim was approved;
 * - community_confirmed: its pet policy comes from Pet Helper users' answers;
 * - website_verified: its own website answered the last check, within WEBSITE_VERIFIED_DAYS;
 * - listed: only a public directory (INEGI, OpenStreetMap, Overture) or a curated list says so.
 */
export const VERIFICATION_STATUSES = [
  'needs_review',
  'owner_verified',
  'community_confirmed',
  'website_verified',
  'listed',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** A website check older than this no longer counts as verification. */
export const WEBSITE_VERIFIED_DAYS = 365;

export const verificationSchema = z.object({
  status: z.enum(VERIFICATION_STATUSES),
  /** When the status's evidence was last checked (YYYY-MM-DD); null when unknown. */
  checkedOn: z.string().nullable(),
});
export type Verification = z.infer<typeof verificationSchema>;
