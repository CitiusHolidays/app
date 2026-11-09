import type { Gate } from './resolve-gate';
import { useStaffSession } from './session';

/**
 * Whether a request can reach the server now: the phone has a connection and the server has
 * confirmed this tour manager (not a gate opened from the saved verification while offline or
 * while the server is not answering). The one rule for every read, send and "Offline" notice.
 */
export function canReachServer(gate: Gate, online: boolean) {
  return online && gate.kind === 'staff' && !gate.offline;
}

/** `canReachServer` for the signed-in session. */
export function useCanReachServer() {
  const { gate, online } = useStaffSession();
  return canReachServer(gate, online);
}
