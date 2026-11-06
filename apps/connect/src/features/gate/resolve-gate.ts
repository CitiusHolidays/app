import type { PortalAccess } from '@citius/backend';

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
  lastVerified?: VerifiedStaff | null;
  now: number;
  online: boolean;
}

export type Gate =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'notStaff' }
  | { kind: 'staff'; offline: boolean; staff: StaffIdentity };

/**
 * Decides what the signed-in shell shows. The server's `getMyPortalAccess` is the only source of
 * staff status. The one exception is offline use on tour: a device that verified this staff
 * member recently and still holds their session may open the saved trip pack without a network.
 */
export function resolveGate(input: GateInput): Gate {
  if (input.authLoading) {
    return { kind: 'loading' };
  }
  if (input.isAuthenticated) {
    if (!input.access) {
      return { kind: 'loading' };
    }
    if (!(input.access.allowed && input.access.staffId)) {
      return { kind: 'notStaff' };
    }
    return {
      kind: 'staff',
      offline: false,
      staff: { name: input.access.name, roles: input.access.roles, staffId: input.access.staffId },
    };
  }
  const verified = input.lastVerified;
  if (
    !input.online &&
    input.hasCachedSession &&
    verified &&
    input.now - verified.verifiedAt <= OFFLINE_VERIFICATION_WINDOW_MS
  ) {
    return {
      kind: 'staff',
      offline: true,
      staff: { name: verified.name, roles: verified.roles, staffId: verified.staffId },
    };
  }
  return { kind: 'signedOut' };
}
