import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Keyboard } from 'react-native';

/** Hides the keyboard when the screen loses focus (opening a detail screen, switching tabs). */
export function useDismissKeyboardOnBlur() {
  useFocusEffect(useCallback(() => () => Keyboard.dismiss(), []));
}
