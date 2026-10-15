import '../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { KeyboardBar } from '@/components/keyboard-bar';
import { OfflineBanner } from '@/components/states';
import { FavoritesProvider } from '@/features/favorites/favorites-context';
import { LocationProvider } from '@/features/location/location-context';
import { DisclaimerProvider } from '@/features/disclaimer/disclaimer-context';
import { connectQueryOnlineState } from '@/features/network/network';
import { SettingsProvider } from '@/features/settings/settings-context';
import { initI18n } from '@/i18n';
import { useAppTranslation } from '@/i18n/use-app-translation';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } },
});
connectQueryOnlineState();

function RootStack() {
  const { t } = useAppTranslation();
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* The disclaimer: answered with its buttons, never swiped away. */}
      <Stack.Screen name="disclaimer" options={{ headerShown: false, gestureEnabled: false }} />
      {/* Just the arrow: the screen behind is the tab group, whose route name isn't a title. */}
      <Stack.Screen
        name="place/[id]"
        options={{ title: t('places.title'), headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="claim/[placeId]"
        options={{ title: t('places.claim.title'), headerBackButtonDisplayMode: 'minimal' }}
      />
    </Stack>
  );
}

/**
 * Light mode: pages and the place and claim headers on the tab bar's cream (off-bg, #FFFBED)
 * instead of white (owner's choice); dark mode keeps the default.
 */
const LIGHT_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#fffbed', card: '#fffbed' },
};

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    initI18n().finally(() => setI18nReady(true));
  }, []);

  if (!i18nReady) {
    return null;
  }

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : LIGHT_THEME}>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <DisclaimerProvider>
            <FavoritesProvider>
              <LocationProvider>
                <OfflineBanner />
                <RootStack />
                <StatusBar style="auto" />
                <KeyboardBar />
              </LocationProvider>
            </FavoritesProvider>
          </DisclaimerProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
