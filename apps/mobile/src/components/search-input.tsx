import { Pressable, Text, TextInput, View } from 'react-native';

import { LanguageToggle } from '@/components/language-toggle';

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
  /** Over the map: white with a shadow, so it stands out from the streets. */
  floating?: boolean;
};

/** Rounded search field with a clear button and, at the far right, the ES / EN switch. */
export function SearchInput({
  value,
  onChangeText,
  placeholder,
  clearLabel,
  onSubmit,
  disabled = false,
  floating = false,
}: Props) {
  return (
    <View
      className={`flex-row items-center rounded-xl px-3 ${
        floating ? 'bg-white shadow dark:bg-neutral-900' : 'bg-neutral-100 dark:bg-neutral-900'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <TextInput
        testID="search-input"
        editable={!disabled}
        accessibilityState={{ disabled }}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        placeholderTextColor="#737373"
        returnKeyType="search"
        autoCorrect={false}
        // No line height: on iOS it pushes the text and placeholder off center in a short box.
        textAlignVertical="center"
        className="min-h-[35px] flex-1 py-0 text-[13px] text-neutral-900 dark:text-white"
      />
      {value && !disabled ? (
        <Pressable
          accessibilityRole="button"
          testID="search-clear"
          accessibilityLabel={clearLabel}
          onPress={() => onChangeText('')}
          hitSlop={12}
          className="px-2 py-1"
        >
          <Text className="text-base text-neutral-500">{CLEAR_GLYPH}</Text>
        </Pressable>
      ) : null}
      <LanguageToggle />
    </View>
  );
}
