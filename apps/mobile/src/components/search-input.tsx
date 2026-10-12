import { Pressable, Text, TextInput, View } from 'react-native';

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

/** Rounded search field with a clear button. */
export function SearchInput({
  value,
  onChangeText,
  placeholder,
  clearLabel,
  onSubmit,
  disabled = false,
}: Props) {
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
    </View>
  );
}
