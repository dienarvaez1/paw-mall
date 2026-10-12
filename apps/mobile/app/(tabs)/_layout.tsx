import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

import { ICONS } from '@/components/icons';
import { useAppTranslation } from '@/i18n/use-app-translation';

type TabIconName = 'tab-explore' | 'tab-pets' | 'tab-urgent' | 'tab-settings';

function TabIcon({ name, color }: { name: TabIconName; color: string }) {
  return <Image source={ICONS[name]} style={{ width: 26, height: 26 }} tintColor={color} />;
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
            tabBarIcon: ({ color }) => <TabIcon name={tab.icon} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  );
}
