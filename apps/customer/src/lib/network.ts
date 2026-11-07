import { useNetworkState } from 'expo-network';

/** True unless the device reports no connection. Unknown counts as online; requests decide. */
export function useOnline() {
  const state = useNetworkState();
  return state.isConnected !== false && state.isInternetReachable !== false;
}
