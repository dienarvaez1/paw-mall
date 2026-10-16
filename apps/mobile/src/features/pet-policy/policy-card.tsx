import type { PetPolicy } from '@pet-helper/shared';
import { Linking, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorState } from '@/components/states';
import { formatShortDate } from '@/i18n/format';
import { SECTION, SECTION_TITLE } from '@/components/section';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';

import { PetQuestion } from './pet-question';
import { usePolicyAnswer } from './policy-answers';
import { dogsText, feeText, otherPetsTexts, sourceText } from './policy-text';

/**
 * The place's pet policy: what pets it takes, limits, fee, where pets may go and the venue's
 * rules, then who said so, when it was last confirmed, and "¿Sigue siendo así?" for shoppers.
 */
export function PolicyCard({ placeId, policy }: { placeId: number; policy: PetPolicy }) {
  const { t } = useAppTranslation();
  const language = useLocale();
  const lines = [
    dogsText(policy, t, language),
    ...otherPetsTexts(policy, t),
    policy.maxPets === null ? null : t('places.pets.maxPets', { count: policy.maxPets }),
    feeText(policy.fee, t, language),
    policy.areas.length === 0
      ? null
      : t('places.pets.areas.label', {
          areas: policy.areas.map((area) => t(`places.pets.areas.${area}`)).join(', '),
        }),
  ].filter((line) => line !== null);

  return (
    <View className={SECTION}>
      <Text accessibilityRole="header" className={SECTION_TITLE}>
        {t('places.pets.title')}
      </Text>
      {policy.underReview ? (
        <Text className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t('places.pets.underReview')}
        </Text>
      ) : null}
      {lines.map((line) => (
        <Text key={line} className="text-base text-neutral-900 dark:text-white">
          {line}
        </Text>
      ))}
      {policy.rules ? (
        <Text className="text-base italic text-neutral-700 dark:text-neutral-300">
          {policy.rules}
        </Text>
      ) : null}
      <View className="gap-1 pt-1">
        <Text className="text-sm text-neutral-600 dark:text-neutral-300">
          {sourceText(policy, t)}
        </Text>
        <Text className="text-sm text-neutral-600 dark:text-neutral-300">
          {t('places.pets.lastConfirmed', {
            date: formatShortDate(policy.lastConfirmedOn, language),
          })}
          {policy.confirmations > 0
            ? ` · ${t('places.pets.confirmations', { count: policy.confirmations })}`
            : ''}
        </Text>
        {policy.sourceUrl ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(policy.sourceUrl as string)}
            className="min-h-11 justify-center self-start"
          >
            <Text className="text-sm font-semibold text-teal-800 underline dark:text-teal-300">
              {t('places.pets.viewSource')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {/* Users' policies follow users' answers; the others take "¿Sigue siendo así?". */}
      {policy.source === 'community' ? (
        <PetQuestion placeId={placeId} published />
      ) : (
        <PolicyQuestion placeId={placeId} />
      )}
    </View>
  );
}

/** "¿Sigue siendo así?": confirm the policy or say it changed; anonymous, once per phone. */
function PolicyQuestion({ placeId }: { placeId: number }) {
  const { t } = useAppTranslation();
  const { answered, answer, isPending, isError, error } = usePolicyAnswer(placeId);

  if (answered) {
    return (
      <Text className="pt-2 text-sm text-neutral-600 dark:text-neutral-300">
        {t(`places.pets.answer.thanks.${answered}`)}
      </Text>
    );
  }
  return (
    <View className="gap-3 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900">
      <Text className="text-base text-neutral-900 dark:text-white">
        {t('places.pets.answer.question')}
      </Text>
      <View className="flex-row gap-3">
        <Button
          label={t('places.pets.answer.confirm')}
          onPress={() => {
            if (!isPending) answer('confirm');
          }}
        />
        <Button
          variant="secondary"
          label={t('places.pets.answer.dispute')}
          onPress={() => {
            if (!isPending) answer('dispute');
          }}
        />
      </View>
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
        {t('places.pets.answer.privacy')}
      </Text>
      {isError ? <ErrorState error={error} /> : null}
    </View>
  );
}
