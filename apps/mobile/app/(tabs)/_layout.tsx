import { Image, type ImageSource } from 'expo-image';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS } from '@/components/icons';
import { ExploreViewProvider } from '@/features/explore/explore-view';
import { useAppTranslation } from '@/i18n/use-app-translation';

type TabIconName = 'tab-explore' | 'tab-pets' | 'tab-urgent' | 'tab-favorites' | 'tab-settings';

function TabIcon({ name, color }: { name: TabIconName; color: string }) {
  return <Image source={ICONS[name]} style={{ width: 26, height: 26 }} tintColor={color} />;
}

const LOGO = require('../../assets/images/logo.png') as ImageSource;

/**
 * Every tab's header: the Paw-Mall logo centered (3:1, transparent, readable in light and dark),
 * and, for a tab with a description, an ⓘ at the right. Phones have no hover, so tapping it opens
 * the description as a tooltip under the header; a tap anywhere closes it. The tab's name stays
 * on the tab bar and is read aloud as the header.
 */
function TabHeader({ title, description }: { title: string; description?: string }) {
  const { t } = useAppTranslation();
  const { top } = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const dark = useColorScheme() === 'dark';
  return (
    <View
      // The tab bar's cream (an unselected tab) all around the logo (owner's choice).
      style={{
        paddingTop: top + 4,
        backgroundColor: dark ? TAB_BAR_BG.dark : TAB_BAR_BG.light,
      }}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      className="flex-row items-center border-b border-neutral-200 px-4 pb-2 dark:border-neutral-800"
    >
      {/* As wide as the ⓘ side, so the logo sits in the middle. */}
      <View style={{ width: INFO_SIZE }} />
      <View className="flex-1 items-center">
        <Image
          source={LOGO}
          style={{ width: 181, height: 60 }}
          contentFit="contain"
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${t('common.appName')}, ${title}`}
        />
      </View>
      <Pressable
        disabled={!description}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={t('common.aboutSectionHint')}
        accessibilityElementsHidden={!description}
        importantForAccessibility={description ? 'auto' : 'no-hide-descendants'}
        hitSlop={8}
        style={{ width: INFO_SIZE }}
        className="items-end"
      >
        {description ? (
          <Text className="text-base text-teal-700 dark:text-teal-300">{INFO_GLYPH}</Text>
        ) : null}
      </Pressable>
      {description ? (
        <Modal
          transparent
          visible={open}
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={() => setOpen(false)}
            style={{ flex: 1, paddingTop: height }}
          >
            <View className="mx-4 mt-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
              <Text className="pb-1 text-base font-semibold text-neutral-900 dark:text-white">
                {title}
              </Text>
              <Text className="text-sm leading-5 text-neutral-700 dark:text-neutral-300">
                {description}
              </Text>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const INFO_GLYPH = '\u24D8';
const INFO_SIZE = 28;
/** The selected tab's background: the logo's #FF9722 with 85% white (dark: orange-950). */
const ACTIVE_TAB_BG = { light: '#ffefde', dark: '#431407' };
/** The tab bar and unselected tabs: the Lista/Mapa buttons' cream (off-bg / off-bg-dark). */
const TAB_BAR_BG = { light: '#fffbed', dark: '#58311c' };
const LOGO_TURQUOISE = '#00c1c0';
const LOGO_ORANGE = '#ff9722';
/** red-400. */
const LIGHT_RED = '#f87171';

/** Explorar, Pet-friendly, Urgencias, Favoritos and Ajustes. */
export default function TabsLayout() {
  const { t } = useAppTranslation();
  const dark = useColorScheme() === 'dark';
  const tabs: {
    name: string;
    title: string;
    icon: TabIconName;
    description?: string;
    /** Selected icon and name in the section's own color instead of the default teal. */
    activeTint?: string;
  }[] = [
    {
      name: 'explore',
      title: t('places.tabTitle'),
      icon: 'tab-explore',
      description: t('places.introExplore'),
      activeTint: LOGO_TURQUOISE,
    },
    {
      name: 'pet-friendly',
      title: t('places.petFriendly.tabTitle'),
      icon: 'tab-pets',
      description: t('places.introPetFriendly'),
      activeTint: LOGO_ORANGE,
    },
    {
      name: 'urgent',
      title: t('urgent.tabTitle'),
      icon: 'tab-urgent',
      description: t('urgent.intro'),
      activeTint: LIGHT_RED,
    },
    {
      name: 'favorites',
      title: t('favorites.tabTitle'),
      icon: 'tab-favorites',
      description: t('favorites.intro'),
    },
    { name: 'settings', title: t('settings.tabTitle'), icon: 'tab-settings' },
  ];

  return (
    <ExploreViewProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: dark ? '#2dd4bf' : '#0f766e',
          // The selected section sits on a light orange: the logo's #FF9722 with 85% white (dark:
          // orange-950).
          tabBarActiveBackgroundColor: dark ? ACTIVE_TAB_BG.dark : ACTIVE_TAB_BG.light,
          // The bar itself: the unselected Lista/Mapa buttons' cream (off-bg, dark: off-bg-dark).
          tabBarStyle: { backgroundColor: dark ? TAB_BAR_BG.dark : TAB_BAR_BG.light },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              // Stable handles for the Maestro flows (.maestro/), in any language.
              tabBarButtonTestID: `tab-${tab.name}`,
              header: () => <TabHeader title={tab.title} description={tab.description} />,
              ...(tab.activeTint ? { tabBarActiveTintColor: tab.activeTint } : {}),
              tabBarIcon: ({ color }) => <TabIcon name={tab.icon} color={String(color)} />,
            }}
          />
        ))}
      </Tabs>
    </ExploreViewProvider>
  );
}
