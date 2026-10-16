import AsyncStorage from '@react-native-async-storage/async-storage';
import { type DogSize, type PetAnswer, receivedResponseSchema } from '@pet-helper/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiPost } from '@/api/client';
import { getClientId } from '@/features/reports/place-reports';
import { useLocale } from '@/i18n/use-locale';

export type PetAnswerChoice = { takesDogs: boolean; maxDogSize: DogSize | null };
const ANSWERS_KEY = 'petAnswers.byPlace';
const SIZES = new Set(['small', 'medium', 'large']);

/** This phone's "¿Acepta mascotas?" answers by place id; anything unreadable counts as none. */
export function parsePetAnswers(raw: string | null): Record<string, PetAnswerChoice> {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, PetAnswerChoice] =>
          typeof entry[1]?.takesDogs === 'boolean' &&
          (entry[1].maxDogSize === null || SIZES.has(entry[1].maxDogSize)),
      ),
    );
  } catch {
    return {};
  }
}

async function readAnswers(): Promise<Record<string, PetAnswerChoice>> {
  return parsePetAnswers(await AsyncStorage.getItem(ANSWERS_KEY).catch(() => null));
}

/**
 * Answer "¿Acepta mascotas?" for a venue. Sends only the answer and the app's random id; remembers
 * this phone's answer to thank it (it can change it later).
 */
export function usePetAnswer(placeId: number) {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [answered, setAnswered] = useState<PetAnswerChoice | null>(null);

  useEffect(() => {
    readAnswers()
      .then((answers) => setAnswered(answers[placeId] ?? null))
      .catch(() => {});
  }, [placeId]);

  const mutation = useMutation({
    mutationFn: async (choice: PetAnswerChoice) => {
      const body: PetAnswer = { ...choice, clientId: await getClientId() };
      return apiPost(`/v1/places/${placeId}/pet-answers`, body, locale, receivedResponseSchema);
    },
    onSuccess: async (_, choice) => {
      setAnswered(choice);
      const answers = await readAnswers();
      await AsyncStorage.setItem(
        ANSWERS_KEY,
        JSON.stringify({ ...answers, [placeId]: choice }),
      ).catch(() => {});
      // A second matching answer publishes the policy: the page and the lists show it.
      await queryClient.invalidateQueries({ queryKey: ['place'] });
      await queryClient.invalidateQueries({ queryKey: ['places'] });
      await queryClient.invalidateQueries({ queryKey: ['places-map'] });
    },
  });

  return { answered, answer: mutation.mutate, ...mutation };
}
