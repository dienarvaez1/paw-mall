import type { Verification } from '@pet-helper/shared';
import { Text } from 'react-native';

import { formatLongDate } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';

const TONE = {
  needs_review: 'text-amber-700 dark:text-amber-400',
  confirmed: 'text-emerald-700 dark:text-emerald-400',
  listed: 'text-neutral-500 dark:text-neutral-400',
} as const;

function tone(status: Verification['status']): string {
  if (status === 'needs_review') return TONE.needs_review;
  return status === 'listed' ? TONE.listed : TONE.confirmed;
}

/**
 * How far a place's details are confirmed, with the date they were last checked. The owner's
 * verification has its own line on the place page ("Verificado por el dueño el …").
 */
export function VerificationLine({ verification }: { verification: Verification }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  // "From a public directory; not confirmed" isn't shown (owner's rule, 2026-10-15): only what
  // confirms a place, or that it's under review.
  if (verification.status === 'owner_verified' || verification.status === 'listed') return null;
  const label = t(`places.verification.${verification.status}`);
  return (
    <Text testID="verification" className={`text-xs font-medium ${tone(verification.status)}`}>
      {verification.checkedOn
        ? t('places.verification.checkedOn', {
            label,
            date: formatLongDate(verification.checkedOn, locale),
          })
        : label}
    </Text>
  );
}

/**
 * Urgencias rows: the details aren't the owner's, so say to call first; a reported place says it's
 * under review instead.
 */
/**
 * The call-first notice for a place, an ⓘ by the phone on its page (owner's rules, 2026-10-15):
 * call first unless the owner verified the details, or that users reported it. Null when the owner
 * verified it.
 */
export function useUrgentNote(verification: Verification): string | null {
  const { t } = useAppTranslation();
  if (verification.status === 'owner_verified') return null;
  return verification.status === 'needs_review'
    ? t('places.verification.needs_review')
    : t('places.verification.callFirst');
}
