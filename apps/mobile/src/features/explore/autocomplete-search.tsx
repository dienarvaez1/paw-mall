import { useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { useAppTranslation } from '@/i18n/use-app-translation';

import { type SearchableItem, filterSearchItems } from './search-filter';

/** Most suggestions in the list. */
const MAX_SUGGESTIONS = 6;
/** The list's side margins: the search box's (px-4). */
const SIDE_MARGIN = 16;

/**
 * The search box's autocomplete state: which suggestions match the typed text (every word, in
 * any order; search-filter.ts) and whether the list is open (the box has focus and something
 * matches). Spread `inputProps` on the SearchInput; draw AutocompleteList when `open`.
 */
export function useAutocomplete<T extends SearchableItem>({
  items,
  value,
  suggest,
  onTypingChange,
}: {
  /** Candidates from the API. */
  items: readonly T[];
  value: string;
  /** No suggestions while false (e.g. the text was already picked or answered). */
  suggest: boolean;
  /** The box gained or lost focus: the candidates are only fetched while typing. */
  onTypingChange?: (typing: boolean) => void;
}) {
  const [focused, setFocused] = useState(false);
  const results = useMemo(
    () => (suggest ? filterSearchItems(items, value, MAX_SUGGESTIONS) : []),
    [items, value, suggest],
  );
  const typing = (next: boolean) => {
    setFocused(next);
    onTypingChange?.(next);
  };
  return {
    results,
    open: focused && results.length > 0,
    inputProps: { onFocus: () => typing(true), onBlur: () => typing(false) },
  };
}

/**
 * The autocomplete list under the search box: places and businesses matching the typed words.
 * Drawn as the page's top layer, not inside the box: Android neither sends touches to nor shows
 * accessibility what hangs outside its parent. It reaches from `top` to the bottom of the page
 * inside a KeyboardAvoidingView, so the keyboard shortens the list instead of covering it, on
 * iPhone and Android. The page sits between the header and the tab bar, which already keep it
 * clear of the notch and the home indicator.
 */
export function AutocompleteList<T extends SearchableItem>({
  results,
  top,
  onSelect,
}: {
  results: readonly T[];
  /** Where the list starts: just under the search box, in the page. */
  top: number;
  onSelect: (item: T) => void;
}) {
  const { t } = useAppTranslation();
  const colors = useColorScheme() === 'dark' ? DARK : LIGHT;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      pointerEvents="box-none"
      style={[styles.avoider, { top }]}
    >
      <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <FlatList
          // Its own height, shrinking (and scrolling) when the keyboard leaves less room.
          style={styles.list}
          data={results}
          keyExtractor={(item) => item.id}
          // A tap on a suggestion works with the keyboard up (it closes it after).
          keyboardShouldPersistTaps="handled"
          accessibilityRole="list"
          accessibilityLabel={t('places.suggestions.label')}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
          renderItem={({ item, index }) => (
            <SuggestionRow
              item={item}
              index={index}
              colors={colors}
              hint={t(
                item.kind === 'area'
                  ? 'places.suggestions.hint'
                  : 'places.suggestions.businessHint',
              )}
              onPress={() => {
                Keyboard.dismiss();
                onSelect(item);
              }}
            />
          )}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * One suggestion: its name, and what and where it is. Touch feedback per platform: a ripple on
 * Android, a gray highlight while pressed on iOS. (The pressed state is kept here: NativeWind
 * ignores a Pressable's style given as a function.)
 */
function SuggestionRow({
  item,
  index,
  colors,
  hint,
  onPress,
}: {
  item: SearchableItem;
  index: number;
  colors: typeof LIGHT;
  hint: string;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      testID={`suggestion-${index}`}
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      android_ripple={Platform.select({ android: { color: colors.pressed } })}
      style={[
        styles.row,
        Platform.select({ ios: pressed ? { backgroundColor: colors.pressed } : null }),
      ]}
    >
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[styles.detail, { color: colors.muted }]} numberOfLines={1}>
        {[item.category, [item.neighborhood, item.state].filter(Boolean).join(', ')]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </Pressable>
  );
}

/** neutral-900 / neutral-500 on white; the dark set on neutral-900 (as the rest of the app). */
const LIGHT = {
  card: '#ffffff',
  border: '#e5e5e5',
  text: '#171717',
  muted: '#737373',
  pressed: '#f5f5f5',
};
const DARK = {
  card: '#171717',
  border: '#404040',
  text: '#ffffff',
  muted: '#a3a3a3',
  pressed: '#262626',
};

const styles = StyleSheet.create({
  // Above the buttons and the map, down to the bottom of the page.
  avoider: {
    position: 'absolute',
    left: SIDE_MARGIN,
    right: SIDE_MARGIN,
    bottom: 0,
    zIndex: 30,
    elevation: 30,
  },
  dropdown: {
    flexShrink: 1,
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
    }),
  },
  list: { flexGrow: 0 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 12 },
  row: { paddingHorizontal: 12, paddingVertical: 9 },
  name: { fontSize: 13, fontWeight: '600' },
  detail: { fontSize: 12, marginTop: 1 },
});
