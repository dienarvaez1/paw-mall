import AsyncStorage from '@react-native-async-storage/async-storage';
import { type PolicyAnswer, receivedResponseSchema } from '@paw-mall/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiPost } from '@/api/client';
import { getClientId } from '@/features/reports/place-reports';
import { useLocale } from '@/i18n/use-locale';

type Answer = PolicyAnswer['answer'];
const ANSWERS_KEY = 'policyAnswers.byPlace';

/** This phone's answers by place id; anything unreadable counts as none. */
export function parseAnswers(raw: string | null): Record<string, Answer> {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, Answer] => entry[1] === 'confirm' || entry[1] === 'dispute',
      ),
    );
  } catch {
    return {};
  }
}

async function readAnswers(): Promise<Record<string, Answer>> {
  return parseAnswers(await AsyncStorage.getItem(ANSWERS_KEY).catch(() => null));
}

/**
 * Confirm a place's pet policy still holds, or say it changed. Sends only the answer and the app's
 * random id; remembers this phone's answer to thank it (it can change it later).
 */
export function usePolicyAnswer(placeId: number) {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [answered, setAnswered] = useState<Answer | null>(null);

  useEffect(() => {
    readAnswers()
      .then((answers) => setAnswered(answers[placeId] ?? null))
      .catch(() => {});
  }, [placeId]);

  const mutation = useMutation({
    mutationFn: async (answer: Answer) =>
      apiPost(
        `/v1/places/${placeId}/policy-answers`,
        { answer, clientId: await getClientId() },
        locale,
        receivedResponseSchema,
      ),
    onSuccess: async (_, answer) => {
      setAnswered(answer);
      const answers = await readAnswers();
      await AsyncStorage.setItem(
        ANSWERS_KEY,
        JSON.stringify({ ...answers, [placeId]: answer }),
      ).catch(() => {});
      // The card shows the new count and "last confirmed".
      await queryClient.invalidateQueries({ queryKey: ['place'] });
    },
  });

  return { answered, answer: mutation.mutate, ...mutation };
}
