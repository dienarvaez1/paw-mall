import type { ExpoConfig } from 'expo/config';

// "Paw Mall" is a working name; the final app name and bundle ID are still open decisions.
const config: ExpoConfig = {
  name: 'Paw Mall',
  slug: 'paw-mall',
  scheme: 'pawmall',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
    },
  },
  android: {
    predictiveBackGestureEnabled: false,
    // Development builds only (`pnpm --filter mobile android:dev`), not a store ID: Google Maps
    // keys are restricted to a package name. Expo Go ignores it.
    package: 'dev.pawmall.app',
    config: {
      // Paw Mall's own Maps SDK for Android key, from apps/mobile/.env.local (never committed);
      // setup in docs/GOOGLE-PLACES.md.
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY },
    },
  },
  web: {
    bundler: 'metro',
  },
  // Native strings (app name, permission prompts) per device language.
  locales: {
    es: './native-locales/es.json',
    en: './native-locales/en.json',
  },
  plugins: [
    'expo-router',
    'expo-localization',
    [
      'expo-location',
      {
        // English default; the Spanish text comes from native-locales/es.json.
        locationWhenInUsePermission:
          'Paw Mall uses your location to show nearby vets, pet stores and pet-friendly places.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Whether the Maps key above is set (never the key itself): release builds drop
    // `android.config` from the config the app can read, so src/lib/map-type.ts checks this.
    mapsKeyConfigured: Boolean(process.env.GOOGLE_MAPS_ANDROID_KEY),
  },
};

export default config;
