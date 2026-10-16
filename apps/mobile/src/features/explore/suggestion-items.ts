import type { AreaSuggestResponse, Place } from '@pet-helper/shared';
import { useMemo } from 'react';

import { useAppTranslation } from '@/i18n/use-app-translation';

import type { SearchableItem } from './search-filter';

type AreaSuggestion = AreaSuggestResponse['suggestions'][number];

/** A search box suggestion: a place name (searched around) or a business (its page opens). */
export type SuggestionItem =
  | (SearchableItem & { kind: 'area'; area: AreaSuggestion })
  | (SearchableItem & { kind: 'business'; placeId: number });

/**
 * The autocomplete's candidates: the API's place names first (cities, colonias, landmarks), then
 * the businesses nearby, in the shape the search filter matches (name, category, neighborhood,
 * state).
 */
export function useSuggestionItems(
  areas: readonly AreaSuggestion[] | undefined,
  businesses: readonly Place[] | undefined,
): SuggestionItem[] {
  const { t } = useAppTranslation();
  return useMemo(
    () => [
      ...(areas ?? []).map((area): SuggestionItem => ({
        id: `area:${area.name}|${area.municipality ?? ''}|${area.state}`,
        kind: 'area',
        name: area.name,
        category: t(`places.suggestions.kind.${area.kind}`),
        neighborhood: area.municipality,
        state: area.state,
        area,
      })),
      // Unnamed businesses have nothing to complete the typed words with.
      ...(businesses ?? []).flatMap((place): SuggestionItem[] =>
        place.name === null
          ? []
          : [
              {
                id: `business:${place.id}`,
                kind: 'business',
                name: place.name,
                category: place.categories.map((category) => category.name).join(' · ') || null,
                neighborhood: place.city,
                state: place.state,
                placeId: place.id,
              },
            ],
      ),
    ],
    [areas, businesses, t],
  );
}
