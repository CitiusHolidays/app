import { type PortalAccess, staffApi } from '@citius/backend';
import { useConvexAuth, useQuery } from 'convex/react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAppStore, useStoredValue } from '@/lib/app-store';
import { clearLocalAuthSession } from '@/lib/auth-storage';
import { clients } from '@/lib/clients';
import { useOnline } from '@/lib/network';
import { logEvent } from '@/lib/safe-log';
import { useNow } from '@/lib/use-now';
import { deleteAllReceipts } from '@/features/expenses/receipt-files';

import {
  type AuthSessionState,
  type Gate,
  resolveGate,
  sessionRejectedByServer,
  type VerifiedStaff,
  verificationStep,
} from './resolve-gate';
import { signOutDevice } from './sign-out';

const VERIFIED_KEY = 'session:verifiedStaff';
/** Set when the sign-in screen is shown; cleared once the server has confirmed a tour manager. */
const SERVER_CHECK_KEY = 'session:needsServerCheck';

interface StaffSession {
  gate: Gate;
  online: boolean;
  /** Access was withdrawn: deletes the cached verification and everything saved on this phone. */
  revoke: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<StaffSession | null>(null);

const NO_SESSION: AuthSessionState = { data: null, error: null, isPending: false };
const noSession = () => NO_SESSION;
/** Better Auth's session state; `clients` is fixed at start-up, so the hook choice never changes. */
const useAuthSession: () => AuthSessionState = clients ? clients.auth.useSession : noSession;

function useHasCachedSession(isAuthenticated: boolean, epoch: number) {
  const [cached, setCached] = useState<{ for: string; value: boolean } | null>(null);
  const checkFor = `${isAuthenticated}:${epoch}`;
  useEffect(() => {
    let active = true;
    // Only the Expo plugin stores a session cookie on the device; the web preview has none.
    const auth = Platform.OS === 'web' ? undefined : (clients?.auth as { getCookie?: () => Promise<string> } | undefined);
    (auth?.getCookie?.() ?? Promise.resolve(''))
      .then((cookie) => {
        if (active) setCached({ for: checkFor, value: Boolean(cookie) });
      })
      .catch(() => {
        if (active) setCached({ for: checkFor, value: false });
      });
    return () => {
      active = false;
    };
  }, [checkFor]);
  return cached?.for === checkFor ? cached.value : null;
}

/** How long the gate waits for the server before treating the connection as gone. */
export const SERVER_STALL_MS = 8_000;

/** True once `waiting` has stayed true for SERVER_STALL_MS; resets as soon as it clears. */
function useStalled(waiting: boolean) {
  const [stalledFor, setStalledFor] = useState<boolean | null>(null);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setStalledFor(true), SERVER_STALL_MS);
    return () => {
      clearTimeout(timer);
      setStalledFor(null);
    };
  }, [waiting]);
  return waiting && stalledFor === true;
}

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const { live } = useAppStore();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const authSession = useAuthSession();
  const online = useOnline();
  const access = useQuery(staffApi.getMyPortalAccess.ref, isAuthenticated ? {} : 'skip');
  const [storedVerified, , verifiedLoaded] = useStoredValue<VerifiedStaff | null>(VERIFIED_KEY, null);
  const [needsServerCheck, , checkLoaded] = useStoredValue<boolean>(SERVER_CHECK_KEY, false);
  const [authEpoch, setAuthEpoch] = useState(0);
  const hasCachedSession = useHasCachedSession(isAuthenticated, authEpoch);
  const [signingOut, setSigningOut] = useState(false);
  const now = useNow();
  // Wipes and verification writes run one at a time, in order.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const serially = useCallback((task: () => Promise<void>) => {
    const run = queue.current.then(task, task);
    queue.current = run.catch((error: unknown) => logEvent('session.task-failed', error));
    return run;
  }, []);

  const wipeLocalData = useCallback(async () => {
    await live.wipe();
    deleteAllReceipts();
  }, [live]);

  const latestAccess = useRef(access);
  useEffect(() => {
    latestAccess.current = access;
  }, [access]);

  /** Applies a server answer: save the verification, or wipe if access was withdrawn. */
  const applyAccess = useCallback(
    async (answer: PortalAccess) => {
      const stored = live.snapshot(VERIFIED_KEY)?.value as VerifiedStaff | null | undefined;
      const step = verificationStep(answer, stored, Date.now());
      if (step.kind === 'revoke') {
        logEvent('session.access-revoked');
        await wipeLocalData();
      } else if (step.kind === 'store') {
        if (step.wipeFirst) {
          await wipeLocalData();
        }
        await live.set(VERIFIED_KEY, step.record);
        await live.set(SERVER_CHECK_KEY, false);
      }
    },
    [live, wipeLocalData]
  );

  // Every fresh server answer is a verification.
  useEffect(() => {
    if (access && verifiedLoaded) {
      void serially(() => applyAccess(access));
    }
  }, [access, applyAccess, serially, verifiedLoaded]);

  const revoke = useCallback(
    () =>
      serially(async () => {
        logEvent('session.access-revoked');
        await wipeLocalData();
        // If the server still says this is a tour manager, start again from an empty phone.
        const answer = latestAccess.current;
        if (answer) await applyAccess(answer);
      }),
    [applyAccess, serially, wipeLocalData]
  );

  const signOut = async () => {
    setSigningOut(true);
    try {
      await serially(() =>
        signOutDevice({
          clearSession: clearLocalAuthSession,
          revoke: async () => {
            await clients?.auth.signOut();
          },
          wipeData: wipeLocalData,
        })
      );
    } finally {
      setAuthEpoch((value) => value + 1);
      setSigningOut(false);
    }
  };

  // A hanging connection never errors, so after a while stop waiting and use the offline rules.
  const waiting = isLoading || (isAuthenticated && access === undefined);
  const stalled = useStalled(waiting);

  const gate: Gate = signingOut
    ? { kind: 'loading' }
    : resolveGate({
        access: access ?? undefined,
        authLoading: isLoading || !verifiedLoaded || !checkLoaded || hasCachedSession === null,
        hasCachedSession: Boolean(hasCachedSession),
        isAuthenticated,
        lastVerified: storedVerified,
        needsServerCheck,
        now,
        sessionRejected: sessionRejectedByServer(authSession),
        stalled,
      });

  // Whoever signs in next is confirmed by the server before any saved data opens.
  useEffect(() => {
    if (gate.kind === 'signedOut' && checkLoaded && !needsServerCheck) {
      void serially(() => live.set(SERVER_CHECK_KEY, true));
    }
  }, [checkLoaded, gate.kind, live, needsServerCheck, serially]);

  return <SessionContext.Provider value={{ gate, online, revoke, signOut }}>{children}</SessionContext.Provider>;
}

export function useStaffSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useStaffSession needs StaffSessionProvider');
  }
  return value;
}

/** The signed-in tour manager; only valid inside the staff part of the app. */
export function useStaff() {
  const { gate } = useStaffSession();
  if (gate.kind !== 'staff') {
    throw new Error('useStaff used outside the staff area');
  }
  return gate.staff;
}
