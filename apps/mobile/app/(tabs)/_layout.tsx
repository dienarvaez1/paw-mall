import { Image, type ImageSource } from 'expo-image';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View, useColorScheme } from 'react-native';
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
 * dark), then the tab's title beside it. Phones have no hover, so a title with a description shows
 * an ⓘ and opens it as a tooltip under the header when tapped; a tap anywhere closes it.
 */
function TabHeader({ title, description }: { title: string; description?: string }) {
  const { t } = useAppTranslation();
  const { top } = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  return (
    <View
      style={{ paddingTop: top + 4 }}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      className="flex-row items-center gap-6 border-b border-neutral-200 bg-white px-4 pb-2 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <Image
        source={LOGO}
        style={{ width: 151, height: 50 }}
        contentFit="contain"
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('common.appName')}
      />
      <Pressable
        disabled={!description}
        onPress={() => setOpen(true)}
        accessibilityRole={description ? 'button' : 'header'}
        accessibilityHint={description ? t('common.aboutSectionHint') : undefined}
        hitSlop={8}
        className="flex-1 flex-row items-center gap-1.5"
      >
        <OutlinedTitle title={title} />
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
const LOGO_TURQUOISE = '#00c1c0';
const LOGO_ORANGE = '#ff9722';

/** The logo's colors: turquoise letters (#00C1C0) with an orange outline (#FF9722). */
const TITLE_FILL = '#00c1c0';
const TITLE_OUTLINE = '#ff9722';
const OUTLINE_PX = 0.75;
const OUTLINE_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;
const titleStyle = { fontSize: 21, fontWeight: '600', lineHeight: 26 } as const;

/**
 * The tab title in the logo's style. React Native has no text outline, so orange copies offset in
 * eight directions sit behind the turquoise text; only the front copy is read aloud.
 */
function OutlinedTitle({ title }: { title: string }) {
  return (
    <View className="shrink">
      {OUTLINE_OFFSETS.map(([x, y]) => (
        <Text
          key={`${x},${y}`}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          numberOfLines={1}
          style={[
            titleStyle,
            {
              position: 'absolute',
              left: x * OUTLINE_PX,
              top: y * OUTLINE_PX,
              color: TITLE_OUTLINE,
            },
          ]}
        >
          {title}
        </Text>
      ))}
      <Text numberOfLines={1} style={[titleStyle, { color: TITLE_FILL }]}>
        {title}
      </Text>
    </View>
  );
}

/** Explorar, Pet-friendly, Urgencias and Ajustes; Favoritos isn't scheduled yet. */
export default function TabsLayout() {
  const { t } = useAppTranslation();
  const dark = useColorScheme() === 'dark';
  const tabs: {
    name: string;
    title: string;
    icon: TabIconName;
    description?: string;
    /** Selected icon and name in one of the logo's colors instead of the default teal. */
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
    },
    { name: 'settings', title: t('settings.tabTitle'), icon: 'tab-settings' },
  ];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: dark ? '#2dd4bf' : '#0f766e',
        // The selected section sits on a light orange: the logo's #FF9722 with 85% white (dark:
        // orange-950).
        tabBarActiveBackgroundColor: dark ? '#431407' : '#ffefde',
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            header: () => <TabHeader title={tab.title} description={tab.description} />,
            ...(tab.activeTint ? { tabBarActiveTintColor: tab.activeTint } : {}),
            tabBarIcon: ({ color }) => <TabIcon name={tab.icon} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  );
}
