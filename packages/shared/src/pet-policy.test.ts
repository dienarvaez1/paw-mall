import { describe, expect, it } from 'vitest';

import {
  allowsDogSize,
  communityPolicy,
  dogSizeForWeightLimit,
  petAnswerSchema,
  petPolicyInputSchema,
  policyAnswerSchema,
} from './pet-policy';
import { placeClaimSchema } from './trust';

const policy = {
  dogs: true,
  cats: null,
  otherPets: null,
  maxDogSize: 'medium' as const,
  maxWeightKg: 15,
  maxPets: 1,
  fee: { amount: 350, currency: 'MXN' as const, per: 'night' as const },
  areas: ['indoor' as const],
  rules: null,
};

describe('dog sizes', () => {
  it('maps a weight limit to the largest size it lets in', () => {
    expect(dogSizeForWeightLimit(5)).toBe('small');
    expect(dogSizeForWeightLimit(10)).toBe('small');
    expect(dogSizeForWeightLimit(15)).toBe('medium');
    expect(dogSizeForWeightLimit(25)).toBe('medium');
    expect(dogSizeForWeightLimit(35)).toBe('large');
  });

  it('lets smaller dogs in, and nothing when the size is unknown', () => {
    expect(allowsDogSize('large', 'large')).toBe(true);
    expect(allowsDogSize('large', 'small')).toBe(true);
    expect(allowsDogSize('medium', 'large')).toBe(false);
    expect(allowsDogSize('small', 'medium')).toBe(false);
    expect(allowsDogSize(null, 'small')).toBe(false);
  });
});

describe('petPolicyInputSchema', () => {
  it('accepts a full policy and rejects unknown areas', () => {
    expect(petPolicyInputSchema.parse(policy)).toEqual(policy);
    expect(petPolicyInputSchema.safeParse({ ...policy, areas: ['roof'] }).success).toBe(false);
  });

  it('counts as something to publish in an owner claim', () => {
    const contact = { contactName: 'Ana López', contact: 'ana@example.com', consent: true };
    expect(placeClaimSchema.safeParse({ ...contact, petPolicy: policy }).success).toBe(true);
  });
});

describe('policyAnswerSchema', () => {
  it('takes an answer and a random id, and nothing else', () => {
    const clientId = 'a1b2c3d4e5f6a7b8c9d0';
    expect(policyAnswerSchema.parse({ answer: 'confirm', clientId })).toEqual({
      answer: 'confirm',
      clientId,
    });
    expect(policyAnswerSchema.safeParse({ answer: 'dispute', clientId, lat: 19.4 }).success).toBe(
      false,
    );
    expect(policyAnswerSchema.safeParse({ answer: 'maybe', clientId }).success).toBe(false);
  });
});

describe('communityPolicy', () => {
  const yes = (maxDogSize: 'small' | 'medium' | 'large' | null = null) => ({
    takesDogs: true,
    maxDogSize,
  });
  const no = { takesDogs: false, maxDogSize: null };

  it('needs 2 phones agreeing, more than disagree', () => {
    expect(communityPolicy([yes()])).toBeNull();
    expect(communityPolicy([yes(), no])).toBeNull();
    expect(communityPolicy([yes(), yes(), no, no])).toBeNull();
    expect(communityPolicy([yes(), yes(), no])).toEqual({ dogs: true, maxDogSize: null });
    expect(communityPolicy([no, no, yes()])).toEqual({ dogs: false, maxDogSize: null });
  });

  it('takes the lower median of the sizes given', () => {
    expect(communityPolicy([yes('large'), yes('medium')])?.maxDogSize).toBe('medium');
    expect(communityPolicy([yes('large'), yes('large'), yes('small')])?.maxDogSize).toBe('large');
    expect(communityPolicy([yes('large'), yes()])?.maxDogSize).toBe('large');
  });
});

describe('petAnswerSchema', () => {
  it('takes only the answer and the random id', () => {
    const clientId = 'phone-0000000000000001';
    expect(
      petAnswerSchema.safeParse({ takesDogs: true, maxDogSize: 'large', clientId }).success,
    ).toBe(true);
    expect(petAnswerSchema.safeParse({ takesDogs: false, clientId }).success).toBe(true);
    expect(petAnswerSchema.safeParse({ takesDogs: true, clientId, lat: 19.4 }).success).toBe(false);
  });
});
