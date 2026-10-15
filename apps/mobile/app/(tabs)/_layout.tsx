import { Image, type ImageSource } from 'expo-image';
import { Tabs, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Modal, Pressable, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS } from '@/components/icons';
import { visibleTabs } from '@/features/disclaimer/disclaimer';
import { useDisclaimer } from '@/features/disclaimer/disclaimer-context';
import { ExploreFrameProvider, useExploreFrameHeight } from '@/features/explore/explore-frame';
import { ExploreScreen } from '@/features/explore/explore-screen';
import { ExploreViewProvider } from '@/features/explore/explore-view';
import { useAppTranslation } from '@/i18n/use-app-translation';

type TabIconName =
  'tab-explore' | 'tab-pets' | 'tab-urgent' | 'tab-favorites' | 'tab-settings' | 'tab-notice';

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
/** The two tabs that are one page (SharedExplorePage). */
const SHARED_PAGE_TABS = ['explore', 'pet-friendly'];
const INFO_SIZE = 28;
/** The selected tab's background: the logo's #FF9722 with 85% white (dark: orange-950). */
const ACTIVE_TAB_BG = { light: '#ffefde', dark: '#431407' };
/** The tab bar and unselected tabs: the Lista/Mapa buttons' cream (off-bg / off-bg-dark). */
const TAB_BAR_BG = { light: '#fffbed', dark: '#58311c' };
const LOGO_TURQUOISE = '#00c1c0';
const LOGO_ORANGE = '#ff9722';
/** red-400. */
const LIGHT_RED = '#f87171';

type TabInfo = { title: string; description?: string };

/**
 * Explorar and Pet-friendly are one page (owner's rule): drawn once here, over whichever of the
 * two tabs is open, with that tab's title and places. One map, so its view, zoom, rotation,
 * circle and switches can never differ between the two. Hidden on the other tabs (still there,
 * so it comes back exactly as it was).
 */
function SharedExplorePage({ explore, petFriendly }: { explore: TabInfo; petFriendly: TabInfo }) {
  const segments = useSegments() as string[];
  const tab = segments[0] === '(tabs)' ? segments[1] : undefined;
  // The last tab shown: a page opened on top (a place) keeps it as it was underneath.
  const [shownTab, setShownTab] = useState(tab ?? 'explore');
  if (tab && tab !== shownTab) setShownTab(tab);
  const visible = shownTab === 'explore' || shownTab === 'pet-friendly';
  const height = useExploreFrameHeight();
  useEffect(() => {
    if (!visible) Keyboard.dismiss();
  }, [visible]);
  const shown = visible && height > 0;
  const section = shownTab === 'pet-friendly' ? 'pet_friendly' : 'pet_business';
  const info = section === 'pet_friendly' ? petFriendly : explore;
  return (
    <View
      // Hidden by being see-through and untouchable, not display: none: a map hidden that way
      // loses its circle and pins on iOS when it comes back.
      pointerEvents={shown ? 'box-none' : 'none'}
      accessibilityElementsHidden={!shown}
      importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height, opacity: shown ? 1 : 0 }}
    >
      {/* Only once the room is known: a map first laid out at no height opens on the whole world
          on Android (it can't fit the circle into nothing). */}
      {height > 0 ? (
        <>
          <TabHeader title={info.title} description={info.description} />
          <ExploreScreen section={section} />
        </>
      ) : null}
    </View>
  );
}

/**
 * Explorar, Pet-friendly, Urgencias, Favoritos and Ajustes once the disclaimer is accepted; until
 * then only Urgencias and Aviso, the notice to read and accept (visibleTabs).
 */
export default function TabsLayout() {
  const { t } = useAppTranslation();
  const dark = useColorScheme() === 'dark';
  const { status } = useDisclaimer();
  const shown = visibleTabs(status);
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
    { name: 'notice', title: t('disclaimer.tabTitle'), icon: 'tab-notice' },
  ];

  const tabInfo = (name: string): TabInfo => {
    const tab = tabs.find((item) => item.name === name);
    return { title: tab?.title ?? '', description: tab?.description };
  };
  return (
    <ExploreViewProvider>
      <ExploreFrameProvider>
        <View style={{ flex: 1 }}>
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
                  // Explorar's and Pet-friendly's header is part of their shared page (below).
                  ...(SHARED_PAGE_TABS.includes(tab.name)
                    ? { headerShown: false }
                    : {
                        header: () => <TabHeader title={tab.title} description={tab.description} />,
                      }),
                  ...(tab.activeTint ? { tabBarActiveTintColor: tab.activeTint } : {}),
                  tabBarIcon: ({ color }) => <TabIcon name={tab.icon} color={String(color)} />,
                  // Hidden tabs keep their route but leave the tab bar.
                  ...(shown.includes(tab.name) ? {} : { href: null }),
                }}
              />
            ))}
          </Tabs>
          {status === 'accepted' ? (
            <SharedExplorePage explore={tabInfo('explore')} petFriendly={tabInfo('pet-friendly')} />
          ) : null}
        </View>
      </ExploreFrameProvider>
    </ExploreViewProvider>
  );
}
