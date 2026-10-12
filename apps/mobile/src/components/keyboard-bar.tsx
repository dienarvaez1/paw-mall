import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, useColorScheme, View } from 'react-native';

import { useAppTranslation } from '@/i18n/use-app-translation';

import { ICONS } from './icons';

/** The button's size and its gap above the keyboard. */
const BUTTON_SIZE = 40;
const GAP = 8;

/**
 * A hide-keyboard button resting on top of the keyboard, at the right, for every text input in
 * the app, on Android and iOS (owner's rule). Rendered once, at the root, over every screen.
 * Placed from the keyboard's top edge on screen, so it's right whether or not the window resizes
 * for the keyboard.
 */
export function KeyboardBar() {
  const { t } = useAppTranslation();
  const scheme = useColorScheme();
  const keyboardTop = useKeyboardTop();
  if (keyboardTop === null) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: 12, top: keyboardTop - BUTTON_SIZE - GAP }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.hideKeyboard')}
        onPress={() => Keyboard.dismiss()}
        hitSlop={8}
        style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
        className="items-center justify-center rounded-full border border-neutral-300 bg-white shadow active:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:active:bg-neutral-800"
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
