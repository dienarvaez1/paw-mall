import { InputAccessoryView, Keyboard, Platform, Pressable, Text, View } from 'react-native';

import { useAppTranslation } from '@/i18n/use-app-translation';

/** Text inputs pass this as inputAccessoryViewID to get the bar above their keyboard (iOS). */
export const KEYBOARD_BAR_ID = 'keyboard-bar';

/**
 * A bar above the keyboard with "Ocultar teclado", for every text input in the app. iOS only:
 * Android's keyboard has its own hide key (and the search key hides it too). Rendered once, at
 * the root.
 */
export function KeyboardBar() {
  const { t } = useAppTranslation();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_BAR_ID}>
      <View className="flex-row justify-end border-t border-neutral-300 bg-neutral-100 px-4 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
        <Pressable
          accessibilityRole="button"
          onPress={() => Keyboard.dismiss()}
          hitSlop={8}
          className="min-h-9 justify-center rounded-lg px-3 active:bg-neutral-200 dark:active:bg-neutral-800"
        >
          <Text className="text-base font-semibold text-teal-800 dark:text-teal-300">
            {t('common.hideKeyboard')}
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
