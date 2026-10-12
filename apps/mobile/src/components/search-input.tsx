import { Image } from 'expo-image';
import { useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, useColorScheme, View } from 'react-native';

import { useAppTranslation } from '@/i18n/use-app-translation';

import { ICONS } from './icons';
import { KEYBOARD_BAR_ID } from './keyboard-bar';

// A symbol, not text, so it doesn't need translating.
const CLEAR_GLYPH = '✕';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Read by screen readers on the clear button. */
  clearLabel: string;
  onSubmit?: () => void;
  /** Grayed out and not editable (the text stays). */
  disabled?: boolean;
};

/**
 * Rounded search field with a clear button and, while typing, a hide-keyboard button (on Android
 * too, where the bar above the keyboard doesn't exist).
 */
export function SearchInput({
  value,
  onChangeText,
  placeholder,
  clearLabel,
  onSubmit,
  disabled = false,
}: Props) {
  const { t } = useAppTranslation();
  const scheme = useColorScheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      className={`flex-row items-center rounded-xl bg-neutral-100 px-3 dark:bg-neutral-900 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <TextInput
        editable={!disabled}
        accessibilityState={{ disabled }}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        placeholderTextColor="#737373"
        returnKeyType="search"
        inputAccessoryViewID={KEYBOARD_BAR_ID}
        autoCorrect={false}
        className="min-h-12 flex-1 text-base text-neutral-900 dark:text-white"
      />
      {value && !disabled ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          onPress={() => onChangeText('')}
          hitSlop={12}
          className="p-2"
        >
          <Text className="text-base text-neutral-500">{CLEAR_GLYPH}</Text>
        </Pressable>
      ) : null}
      {focused ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.hideKeyboard')}
          onPress={() => Keyboard.dismiss()}
          hitSlop={12}
          className="p-2"
        >
          <Image
            source={ICONS['keyboard-hide']}
            style={{ width: 20, height: 20 }}
            tintColor={scheme === 'dark' ? '#a3a3a3' : '#737373'}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
