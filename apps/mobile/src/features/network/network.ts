import { onlineManager } from '@tanstack/react-query';
import { addNetworkStateListener, useNetworkState } from 'expo-network';

/** Pause queries while offline and refetch when the connection comes back. */
export function connectQueryOnlineState() {
  onlineManager.setEventListener((setOnline) => {
    const subscription = addNetworkStateListener((state) => setOnline(state.isConnected !== false));
    return () => subscription.remove();
  });
}

export function useIsOffline(): boolean {
  const state = useNetworkState();
  return state.isConnected === false || state.isInternetReachable === false;
}
