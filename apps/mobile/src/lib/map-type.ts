import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { MapType } from 'react-native-maps';

/**
 * Apple Maps' muted style (less color, so the pins stand out); Google Maps on Android has no
 * such type and keeps its standard look.
 */
export const MAP_TYPE: MapType = Platform.OS === 'ios' ? 'mutedStandard' : 'standard';

/**
 * Whether a map can be drawn. An Android development build without Pet Helper's Maps key
 * (GOOGLE_MAPS_ANDROID_KEY, docs/GOOGLE-PLACES.md) crashes on a map, so it shows none instead;
 * iOS (Apple Maps) and Expo Go (its own key) always can.
 */
export const MAPS_AVAILABLE =
  Platform.OS !== 'android' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  // Set in app.config.ts; the key itself isn't readable in release builds.
  Constants.expoConfig?.extra?.mapsKeyConfigured === true;
