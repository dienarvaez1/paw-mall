import type { Place } from '@paw-mall/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { Marker, type MapMarkerProps } from 'react-native-maps';

import { CATEGORY_ICONS, ICONS } from '@/components/icons';
import { type ChipCategory, pinCategory, pinColor } from '@/lib/categories';

const SIZE = 30;
const ICON = 18;

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
  const slug = pinCategory(place, category);
  return (
    <Marker
      {...marker}
      coordinate={{ latitude: place.location.lat, longitude: place.location.lng }}
      tracksViewChanges={!loaded}
      anchor={{ x: 0.5, y: 0.5 }}
      calloutAnchor={{ x: 0.5, y: 0 }}
    >
      <View
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          borderWidth: 2,
          borderColor: '#ffffff',
          backgroundColor: pinColor(place, category),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={(slug && CATEGORY_ICONS[slug]) || ICONS['tab-pets']}
          style={{ width: ICON, height: ICON }}
          tintColor="#ffffff"
          onLoad={() => setLoaded(true)}
        />
      </View>
    </Marker>
  );
}
