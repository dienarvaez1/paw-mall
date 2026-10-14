import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, useColorScheme, View } from 'react-native';

import { useAppTranslation } from '@/i18n/use-app-translation';

import { ICONS } from './icons';

/** The tab's size. */
const TAB_WIDTH = 52;
const TAB_HEIGHT = 36;

/**
 * A hide-keyboard button for every text input in the app, on Android and iOS (owner's rule):
 * a tab joined to the keyboard's top edge at the right, in a keyboard gray, so it reads as part
 * of the keyboard (owner's rule, 2026-10-14). The keyboard is the system's own window, drawn over
 * the app, so nothing can go inside it; the tab sits right on its edge. Rendered once, at the
 * root, over every screen, and placed from the keyboard's top edge on screen, so it's right
 * whether or not the window resizes for the keyboard.
 */
export function KeyboardBar() {
  const { t } = useAppTranslation();
  const scheme = useColorScheme();
  const keyboardTop = useKeyboardTop();
  if (keyboardTop === null) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: 8, top: keyboardTop - TAB_HEIGHT }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.hideKeyboard')}
        testID="keyboard-hide"
        onPress={() => Keyboard.dismiss()}
        hitSlop={8}
        style={{ width: TAB_WIDTH, height: TAB_HEIGHT }}
        className="items-center justify-center rounded-t-xl bg-[#ededf6] active:bg-[#dcdce8] dark:bg-neutral-800 dark:active:bg-neutral-700"
      >
        <Image
          source={ICONS['keyboard-hide']}
          style={{ width: 22, height: 22 }}
          tintColor={scheme === 'dark' ? '#5eead4' : '#115e59'}
        />
      </Pressable>
    </View>
  );
}

/** The keyboard's top edge (screen y), or null while it's hidden. */
function useKeyboardTop(): number | null {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    // iOS announces the keyboard before it moves, so the button moves along with it.
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subscriptions = [
      Keyboard.addListener(show, (event) => setTop(event.endCoordinates.screenY)),
      Keyboard.addListener(hide, () => setTop(null)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);
  return top;
}
