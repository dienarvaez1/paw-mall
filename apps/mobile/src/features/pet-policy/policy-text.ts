import type { PetFee, PetPolicy } from '@paw-mall/shared';

import { useSettings } from '@/features/settings/settings-context';
import { formatMoney, formatShortDate, formatWeightKg } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';

type T = ReturnType<typeof useAppTranslation>['t'];
type Language = ReturnType<typeof useLocale>;

/** What the policy says about dogs ("Perros de hasta 15 kg"); null when the source doesn't say. */
export function dogsText(policy: PetPolicy, t: T, language: Language): string | null {
  if (policy.dogs === null) return null;
  if (!policy.dogs) return t('places.pets.dogs.no');
  if (policy.maxWeightKg !== null) {
    return t('places.pets.dogs.upToWeight', {
      weight: formatWeightKg(policy.maxWeightKg, language),
    });
  }
  if (policy.maxDogSize === null) return t('places.pets.dogs.sizeUnknown');
  return t(`places.pets.dogs.upToSize.${policy.maxDogSize}`);
}

/** Cats and other pets, when the source says. */
export function otherPetsTexts(policy: PetPolicy, t: T): string[] {
  return [
    policy.cats === null ? null : t(policy.cats ? 'places.pets.cats.yes' : 'places.pets.cats.no'),
    policy.otherPets === null
      ? null
      : t(policy.otherPets ? 'places.pets.otherPets.yes' : 'places.pets.otherPets.no'),
  ].filter((text) => text !== null);
}

/** "Sin costo extra", or "USD 100 por estancia"; null when the source doesn't say. */
export function feeText(fee: PetFee | null, t: T, language: Language): string | null {
  if (!fee) return null;
  if (fee.amount === 0) return t('places.pets.fee.free');
  const amount = fee.currency ? formatMoney(fee.amount, fee.currency, language) : `${fee.amount}`;
  return fee.per
    ? t(`places.pets.fee.per.${fee.per}`, { amount })
    : t('places.pets.fee.amount', { amount });
}

/** Who said it: the owner, or the curated source's name. */
export function sourceText(policy: PetPolicy, t: T): string {
  return policy.source === 'owner'
    ? t('places.pets.source.owner')
    : t('places.pets.source.curated', { name: policy.sourceName ?? '' });
}

/**
 * One line for lists and map callouts: what pets it takes, who said so and when, e.g. "Perros de
 * cualquier tamaño · Four Seasons, 10 oct 2026".
 */
export function usePolicySummary(policy: PetPolicy | null): string | null {
  const { t } = useAppTranslation();
  const language = useLocale();
  if (!policy) return null;
  const allows = policy.dogs
    ? (dogsText(policy, t, language) ?? t('places.pets.petFriendly'))
    : policy.cats
      ? t('places.pets.cats.yes')
      : policy.otherPets
        ? t('places.pets.otherPets.yes')
        : policy.dogs === false
          ? t('places.pets.dogs.no')
          : t('places.pets.petFriendly');
  const summary = t('places.pets.summary', {
    allows,
    source: policy.source === 'owner' ? t('places.pets.source.ownerShort') : policy.sourceName,
    date: formatShortDate(policy.lastConfirmedOn, language),
  });
  return policy.underReview ? t('places.pets.underReviewShort', { summary }) : summary;
}

/** The pet profile in a few words ("perro grande", "gato"); null when not set. */
export function usePetProfileLabel(): string | null {
  const { t } = useAppTranslation();
  const { petSpecies, dogSize } = useSettings();
  if (petSpecies === 'cat') return t('places.pets.profile.cat');
  if (petSpecies === 'dog') {
    return dogSize ? t(`places.pets.profile.dog_${dogSize}`) : t('places.pets.profile.dog');
  }
  return null;
}
