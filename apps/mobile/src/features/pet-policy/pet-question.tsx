import { DOG_SIZES, type DogSize, PET_ANSWERS_TO_PUBLISH } from '@pet-helper/shared';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BUTTON_HIT_SLOP, Button } from '@/components/button';
import { ErrorState } from '@/components/states';
import { SECTION, SECTION_TITLE } from '@/components/section';
import { useAppTranslation } from '@/i18n/use-app-translation';

import { usePetAnswer } from './pet-answers';

/**
 * "¿Acepta perros?" and, after a yes, "¿Hasta qué tamaño?": users' answers make the venue's policy
 * once PET_ANSWERS_TO_PUBLISH phones agree. Anonymous, once per phone (a new answer replaces it).
 */
export function PetQuestion({ placeId, published }: { placeId: number; published: boolean }) {
  const { t } = useAppTranslation();
  const { answered, answer, isPending, isError, error } = usePetAnswer(placeId);
  const [step, setStep] = useState<'dogs' | 'size'>('dogs');
  const send = (takesDogs: boolean, maxDogSize: DogSize | null = null) => {
    if (!isPending) answer({ takesDogs, maxDogSize });
  };

  if (answered) {
    return (
      <Text className="pt-2 text-sm text-neutral-600 dark:text-neutral-300">
        {published
          ? t('places.pets.ask.thanksCounted')
          : t('places.pets.ask.thanks', { count: PET_ANSWERS_TO_PUBLISH })}
      </Text>
    );
  }
  return (
    <View className="gap-3 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900">
      <Text className="text-base text-neutral-900 dark:text-white">
        {step === 'dogs' ? t('places.pets.ask.question') : t('places.pets.ask.sizeQuestion')}
      </Text>
      {step === 'dogs' ? (
        <View className="flex-row gap-3">
          <Button label={t('places.pets.ask.yes')} onPress={() => setStep('size')} />
          <Button variant="secondary" label={t('places.pets.ask.no')} onPress={() => send(false)} />
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {[...DOG_SIZES, null].map((size) => (
            <Pressable
              key={size ?? 'unknown'}
              accessibilityRole="button"
              onPress={() => send(true, size)}
              hitSlop={BUTTON_HIT_SLOP}
              className="min-h-[35px] justify-center rounded-full border px-3 active:bg-off-pressed border-off-border bg-off-bg dark:bg-off-bg-dark"
            >
              <Text className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                {t(`places.pets.ask.size.${size ?? 'unknown'}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
        {t('places.pets.answer.privacy')}
      </Text>
      {isError ? <ErrorState error={error} /> : null}
    </View>
  );
}

/** A venue without a pet policy yet: say so, and ask. */
export function PetQuestionCard({ placeId }: { placeId: number }) {
  const { t } = useAppTranslation();
  return (
    <View className={SECTION}>
      <Text accessibilityRole="header" className={SECTION_TITLE}>
        {t('places.pets.title')}
      </Text>
      <Text className="text-base text-neutral-700 dark:text-neutral-300">
        {t('places.pets.ask.unknown')}
      </Text>
      <PetQuestion placeId={placeId} published={false} />
    </View>
  );
}
