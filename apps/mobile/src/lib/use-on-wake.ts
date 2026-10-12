import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/** The app came back to the screen after being in the background (asleep or switched away). */
export function isWake(previous: AppStateStatus, next: AppStateStatus): boolean {
  return previous === 'background' && next === 'active';
}

/**
 * Runs `onWake` each time the app returns from the background. A brief "inactive" (a call, the
 * notification shade) doesn't count; only a real trip to the background does.
 */
export function useOnWake(onWake: () => void) {
  const latest = useRef(onWake);
  useEffect(() => {
    latest.current = onWake;
  }, [onWake]);
  useEffect(() => {
    let previous: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (isWake(previous, next)) latest.current();
      // Keep "background" through the "inactive" step iOS sends on the way back.
      if (next !== 'inactive') previous = next;
    });
    return () => subscription.remove();
  }, []);
}
