import { Image } from 'expo-image';
import { Pressable } from 'react-native';

import { ICONS } from '@/components/icons';
import { useAppTranslation } from '@/i18n/use-app-translation';

import { useFavorites } from './favorites-context';

/** The logo's orange when saved; neutral-400 otherwise. */
const COLORS = { on: '#ff9722', off: '#a3a3a3' };

/** A small heart that saves the place to Favoritos, or takes it out. */
export function FavoriteButton({ placeId, name }: { placeId: number; name: string }) {
  const { t } = useAppTranslation();
  const { isFavorite, toggle } = useFavorites();
  const saved = isFavorite(placeId);
  return (
    <Pressable
      testID="favorite-button"
      accessibilityRole="button"
      accessibilityLabel={t(saved ? 'favorites.remove' : 'favorites.add', { name })}
      accessibilityState={{ selected: saved }}
      onPress={() => toggle(placeId)}
      hitSlop={10}
      className="p-1"
    >
      <Image
        source={saved ? ICONS['heart-filled'] : ICONS.heart}
        style={{ width: 20, height: 20 }}
        tintColor={saved ? COLORS.on : COLORS.off}
      />
    </Pressable>
  );
}
