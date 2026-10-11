import '../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { OfflineBanner } from '@/components/states';
import { LocationProvider } from '@/features/location/location-context';
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
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <LocationProvider>
            <OfflineBanner />
            <RootStack />
            <StatusBar style="auto" />
          </LocationProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
