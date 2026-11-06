import { type PortalAccess, TOUR_MANAGER_ROLE } from '@citius/backend';

/** How long a device may open the offline trip pack without reaching the server. */
export const OFFLINE_VERIFICATION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export interface StaffIdentity {
  name: string;
  roles: string[];
  staffId: string;
}

export interface VerifiedStaff extends StaffIdentity {
  verifiedAt: number;
}

export interface GateInput {
  /** `getMyPortalAccess` result; undefined while the query is loading. */
  access?: PortalAccess;
  authLoading: boolean;
  /** Better Auth's Expo plugin still holds a session on this device. */
  hasCachedSession: boolean;
  isAuthenticated: boolean;
  /** The verification saved on this device; its staff id says whose data the store holds. */
  lastVerified?: VerifiedStaff | null;
  now: number;
  /** The auth server answered that the session is gone (signed out, expired or revoked). */
  sessionRejected: boolean;
}

export type Gate =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'notStaff' }
  | { kind: 'notTourManager' }
  | { kind: 'staff'; offline: boolean; staff: StaffIdentity };

export const isTourManager = (roles: readonly string[]) => roles.includes(TOUR_MANAGER_ROLE);

/** The Better Auth session state the gate reads (`authClient.useSession()`). */
export interface AuthSessionState {
  data: unknown;
  error: unknown;
  isPending: boolean;
}

/**
 * True only when the server itself said there is no valid session: an empty answer, or 401/403.
 * A network failure, a timeout or a 5xx is not a rejection; the offline window applies then.
 */
export function sessionRejectedByServer(state: AuthSessionState) {
  if (state.isPending || state.data) {
    return false;
  }
  if (!state.error) {
    return true;
  }
  const status = (state.error as { status?: unknown }).status;
  return status === 401 || status === 403;
}

/**
 * Decides what the signed-in shell shows. The server's `getMyPortalAccess` is the only source of
 * staff status, and only tour managers may use the app. The one exception is offline use on
 * tour: a device that verified this tour manager recently and still holds their session may open
 * the saved trip pack whenever the server cannot be reached, unless the server rejected the
 * session outright.
 */
export function resolveGate(input: GateInput): Gate {
  if (input.authLoading) {
    return { kind: 'loading' };
  }
  const verified = input.lastVerified;
  if (input.isAuthenticated) {
    const access = input.access;
    if (!access) {
      return { kind: 'loading' };
    }
    if (!(access.allowed && access.staffId)) {
      return { kind: 'notStaff' };
    }
    if (!isTourManager(access.roles)) {
      return { kind: 'notTourManager' };
    }
    // Until this staff member's verification is saved (after any other user's data is wiped),
    // nothing on the device may be shown.
    if (verified?.staffId !== access.staffId) {
      return { kind: 'loading' };
    }
    return {
      kind: 'staff',
      offline: false,
      staff: { name: access.name, roles: access.roles, staffId: access.staffId },
    };
  }
  if (
    !input.sessionRejected &&
    input.hasCachedSession &&
    verified &&
    input.now - verified.verifiedAt <= OFFLINE_VERIFICATION_WINDOW_MS
  ) {
    if (!isTourManager(verified.roles)) {
      return { kind: 'notTourManager' };
    }
    return {
      kind: 'staff',
      offline: true,
      staff: { name: verified.name, roles: verified.roles, staffId: verified.staffId },
    };
  }
  return { kind: 'signedOut' };
}

export type VerificationStep =
  | { kind: 'none' }
  | { kind: 'revoke' }
  | { kind: 'store'; record: VerifiedStaff; wipeFirst: boolean };

/**
 * What to do with a fresh `getMyPortalAccess` answer. A tour manager's verification is saved
 * every time (roles and time), after wiping the device if it held another staff member's data.
 * A definite "not staff" or "not a tour manager" deletes the cached verification and all data.
 */
export function verificationStep(access: PortalAccess, stored: VerifiedStaff | null | undefined, now: number): VerificationStep {
  if (access.allowed && access.staffId) {
    if (!isTourManager(access.roles)) {
      return { kind: 'revoke' };
    }
    return {
      kind: 'store',
      record: { name: access.name, roles: access.roles, staffId: access.staffId, verifiedAt: now },
      wipeFirst: stored?.staffId !== access.staffId,
    };
  }
  return access.reason === 'UNAUTHENTICATED' ? { kind: 'none' } : { kind: 'revoke' };
}
