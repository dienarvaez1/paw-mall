import { Image, type ImageSource } from 'expo-image';
import { Tabs } from 'expo-router';
import { Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS } from '@/components/icons';
import { useAppTranslation } from '@/i18n/use-app-translation';

type TabIconName = 'tab-explore' | 'tab-pets' | 'tab-urgent' | 'tab-settings';

function TabIcon({ name, color }: { name: TabIconName; color: string }) {
  return <Image source={ICONS[name]} style={{ width: 26, height: 26 }} tintColor={color} />;
}

const LOGO = require('../../assets/images/logo.png') as ImageSource;

/**
 * Every tab's header: the Paw-Mall logo on the left (3:1, transparent, readable in light and
 * dark), then the tab's title beside it.
 */
function TabHeader({ title }: { title: string }) {
  const { t } = useAppTranslation();
  const { top } = useSafeAreaInsets();
  return (
    <View
      style={{ paddingTop: top + 4 }}
      className="flex-row items-center gap-6 border-b border-neutral-200 bg-white px-4 pb-2 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <Image
        source={LOGO}
        style={{ width: 144, height: 48 }}
        contentFit="contain"
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('common.appName')}
      />
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        className="flex-1 text-lg font-semibold text-neutral-900 dark:text-white"
      >
        {title}
      </Text>
    </View>
  );
}

/** Explorar, Pet-friendly, Urgencias and Ajustes; Favoritos isn't scheduled yet. */
export default function TabsLayout() {
  const { t } = useAppTranslation();
  const dark = useColorScheme() === 'dark';
  const tabs: { name: string; title: string; icon: TabIconName }[] = [
    { name: 'explore', title: t('places.tabTitle'), icon: 'tab-explore' },
    { name: 'pet-friendly', title: t('places.petFriendly.tabTitle'), icon: 'tab-pets' },
    { name: 'urgent', title: t('urgent.tabTitle'), icon: 'tab-urgent' },
    { name: 'settings', title: t('settings.tabTitle'), icon: 'tab-settings' },
  ];

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: dark ? '#2dd4bf' : '#0f766e' }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            header: () => <TabHeader title={tab.title} />,
            tabBarIcon: ({ color }) => <TabIcon name={tab.icon} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  );
}
