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
};

export default config;
