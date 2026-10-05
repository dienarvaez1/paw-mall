import AsyncStorage from '@react-native-async-storage/async-storage';
import { type PlaceReportReason, receivedResponseSchema } from '@paw-mall/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiPost } from '@/api/client';
import { useLocale } from '@/i18n/use-locale';

const CLIENT_ID_KEY = 'device.clientId';
const reportedKey = (reason: PlaceReportReason) => `reports.${reason}.placeIds`;

/**
 * A random hex id; counts this phone's reports once without any personal data. It isn't derived
 * from the device, and nothing else (location, name) is ever sent with a report.
 */
export function randomClientId(random: () => number = Math.random): string {
  return Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16)).join('');
}

async function getClientId(): Promise<string> {
  const saved = await AsyncStorage.getItem(CLIENT_ID_KEY).catch(() => null);
  if (saved) return saved;
  const id = randomClientId();
  await AsyncStorage.setItem(CLIENT_ID_KEY, id).catch(() => {});
  return id;
}

async function readReported(reason: PlaceReportReason): Promise<number[]> {
  const raw = await AsyncStorage.getItem(reportedKey(reason)).catch(() => null);
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is number => Number.isInteger(v)) : [];
  } catch {
    return [];
  }
}

/** Report a place (closed, or animal cruelty) once per phone; remembers it for the thank-you. */
export function useReportPlace(placeId: number, reason: PlaceReportReason) {
  const locale = useLocale();
  const [alreadyReported, setAlreadyReported] = useState(false);

  useEffect(() => {
    readReported(reason)
      .then((ids) => setAlreadyReported(ids.includes(placeId)))
      .catch(() => {});
  }, [placeId, reason]);

  const mutation = useMutation({
    mutationFn: async () =>
      apiPost(
        `/v1/places/${placeId}/reports`,
        { reason, clientId: await getClientId() },
        locale,
        receivedResponseSchema,
      ),
    onSuccess: async () => {
      setAlreadyReported(true);
      const ids = await readReported(reason);
      if (!ids.includes(placeId)) {
        await AsyncStorage.setItem(reportedKey(reason), JSON.stringify([...ids, placeId])).catch(
          () => {},
        );
      }
    },
  });

  return { alreadyReported, report: mutation.mutate, ...mutation };
}
