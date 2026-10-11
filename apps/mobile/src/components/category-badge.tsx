import type { CategorySlug } from '@paw-mall/shared';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { CATEGORY_ICONS, ICONS } from '@/components/icons';

/**
 * A category's icon, white on the category's color in a white ring: map pins, list rows and
 * category chips. Without a known category it shows a paw.
 */
export function CategoryBadge({
  slug,
  color,
  size,
  onLoad,
}: {
  slug: CategorySlug | null;
  color: string;
  size: number;
  onLoad?: () => void;
}) {
  const ring = size >= 24 ? 2 : 1;
  const icon = Math.round(size * 0.6);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: ring,
        borderColor: '#ffffff',
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image
        source={(slug && CATEGORY_ICONS[slug]) || ICONS['tab-pets']}
        style={{ width: icon, height: icon }}
        tintColor="#ffffff"
        onLoad={onLoad}
      />
    </View>
  );
}
