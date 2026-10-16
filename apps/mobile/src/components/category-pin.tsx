import type { Place } from '@pet-helper/shared';
import { useState } from 'react';
import { Marker, type MapMarkerProps } from 'react-native-maps';

import { CategoryBadge } from '@/components/category-badge';
import { type ChipCategory, pinCategory, pinColor } from '@/lib/categories';

const SIZE = 30;

/**
 * A map pin with the place's category icon (white, on the category's color in a white ring);
 * places without a known category show a paw. The pin redraws only until its icon has loaded,
 * which keeps panning smooth with many pins.
 */
export function CategoryPin({
  place,
  category,
  ...marker
}: { place: Pick<Place, 'categories' | 'location'>; category: ChipCategory } & Omit<
  MapMarkerProps,
  'coordinate'
>) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Marker
      {...marker}
      coordinate={{ latitude: place.location.lat, longitude: place.location.lng }}
      tracksViewChanges={!loaded}
      anchor={{ x: 0.5, y: 0.5 }}
      calloutAnchor={{ x: 0.5, y: 0 }}
    >
      <CategoryBadge
        slug={pinCategory(place, category)}
        color={pinColor(place, category)}
        size={SIZE}
        onLoad={() => setLoaded(true)}
      />
    </Marker>
  );
}
