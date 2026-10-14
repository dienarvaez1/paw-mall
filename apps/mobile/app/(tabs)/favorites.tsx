import { useQueries } from '@tanstack/react-query';
import { FlatList, View } from 'react-native';

import { placeQuery } from '@/api/hooks';
import { PlaceRow } from '@/components/place-row';
import { EmptyState, SkeletonList } from '@/components/states';
import { useFavorites } from '@/features/favorites/favorites-context';
import { useLocale } from '@/i18n/use-locale';
import { useAppTranslation } from '@/i18n/use-app-translation';

/**
 * Favoritos: the places saved with the heart on their page, newest first, in Explorar's cards.
 * Each is read fresh (hours, open now); one that can't be read any more (closed, hidden) is
 * left out.
 */
export default function FavoritesTab() {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { favorites } = useFavorites();
  // The same query as the place page, so an opened place is already loaded.
  const places = useQueries({ queries: favorites.map(({ id }) => placeQuery(id, locale)) });

  if (favorites.length === 0) {
    return (
      <View className="flex-1 bg-off-bg dark:bg-neutral-950">
        <EmptyState title={t('favorites.empty')} hint={t('favorites.emptyHint')} />
      </View>
    );
  }
  if (places.every((place) => place.isPending)) return <SkeletonList rows={favorites.length} />;

  const items = places.flatMap((place) => (place.data ? [place.data] : []));
  return (
    <FlatList
      className="flex-1 bg-off-bg dark:bg-neutral-950"
      data={items}
      keyExtractor={(place) => String(place.id)}
      renderItem={({ item }) => <PlaceRow place={item} selected={null} away={false} />}
      ItemSeparatorComponent={() => <View className="h-3" />}
      contentContainerClassName="p-4"
    />
  );
}
