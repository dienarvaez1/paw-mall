import type { Place } from '@paw-mall/shared';
import { Text, View } from 'react-native';

import { useAppTranslation } from '@/i18n/use-app-translation';

/**
 * "Abierto ahora", "Cerrado ahora" or "Horario sin confirmar". Only confirmed hours (or an owner's
 * 24-hour answer) count as open; a "24 horas" name hint says so but stays unconfirmed.
 */
export function OpenStatus({ place }: { place: Pick<Place, 'openNow' | 'open24h'> }) {
  const { t } = useAppTranslation();
  if (place.openNow === null) {
    const hint = place.open24h?.value && place.open24h.source === 'name';
    return (
      <View className="self-start rounded-full bg-amber-100 px-2.5 py-0.5 dark:bg-amber-950">
        <Text className="text-xs font-semibold text-amber-900 dark:text-amber-200">
          {hint ? t('places.hours.unconfirmed24h') : t('places.hours.unconfirmed')}
        </Text>
      </View>
    );
  }
  return (
    <View
      className={`self-start rounded-full px-2.5 py-0.5 ${
        place.openNow ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-neutral-200 dark:bg-neutral-800'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          place.openNow
            ? 'text-emerald-800 dark:text-emerald-300'
            : 'text-neutral-700 dark:text-neutral-300'
        }`}
      >
        {place.openNow ? t('places.hours.openNow') : t('places.hours.closedNow')}
      </Text>
    </View>
  );
}
