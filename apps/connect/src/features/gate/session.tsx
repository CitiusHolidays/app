import { type PortalAccess, staffApi } from '@citius/backend';
import { useConvexAuth, useQuery } from 'convex/react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { Platform } from 'react-native';

import { useAppStore, useStoredValue } from '@/lib/app-store';
import { clearLocalAuthSession } from '@/lib/auth-storage';
import { clients } from '@/lib/clients';
import { useOnline } from '@/lib/network';
import { logEvent } from '@/lib/safe-log';
import { useNow } from '@/lib/use-now';
import { deleteAllReceipts } from '@/features/expenses/receipt-files';
import { deleteAllPassportPdfs } from '@/features/passports/passport-pdf-file';

import { gateMachine, initialGateMachine, SERVER_STALL_MS } from './gate-machine';
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
  /** After a stall: wait for the server again and ask it for the session once more. */
  retry: () => void;
  /** Access was withdrawn: deletes the cached verification and everything saved on this phone. */
  revoke: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<StaffSession | null>(null);

/** The empty task queue, shared: a settled promise never changes. */
const SETTLED: Promise<void> = Promise.resolve();

const NO_SESSION: AuthSessionState = { data: null, error: null, isPending: false };
const noSession = () => NO_SESSION;
/** Better Auth's session state; `clients` is fixed at start-up, so the hook choice never changes. */
const useAuthSession: () => AuthSessionState = clients ? clients.auth.useSession : noSession;

/** Only the Expo plugin stores a session cookie on the device; the web preview has none. */
async function holdsSavedSession() {
  const auth = Platform.OS === 'web' ? undefined : (clients?.auth as { getCookie?: () => Promise<string> } | undefined);
  try {
    return Boolean(await auth?.getCookie?.());
  } catch {
    return false;
  }
}

/** Asks Better Auth to fetch the session again; Convex then asks for a new token. */
function refetchSession() {
  (clients?.auth as { $store?: { notify: (signal: '$sessionSignal') => void } } | undefined)?.$store?.notify('$sessionSignal');
}

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const { live } = useAppStore();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const authSession = useAuthSession();
  const online = useOnline();
  const access = useQuery(staffApi.getMyPortalAccess.ref, isAuthenticated ? {} : 'skip');
  const [storedVerified, , verifiedLoaded] = useStoredValue<VerifiedStaff | null>(VERIFIED_KEY, null);
  const [storedServerCheck, , checkLoaded] = useStoredValue<boolean>(SERVER_CHECK_KEY, false);
  const [machine, dispatch] = useReducer(gateMachine, isAuthenticated, initialGateMachine);
  const now = useNow();
  // Wipes and verification writes run one at a time, in order.
  const queue = useRef<Promise<void>>(SETTLED);

  const serially = useCallback((task: () => Promise<void>) => {
    const run = queue.current.then(task, task);
    queue.current = run.catch((error: unknown) => logEvent('session.task-failed', error));
    return run;
  }, []);

  const wipeLocalData = useCallback(async () => {
    await live.wipe();
    deleteAllReceipts();
    deleteAllPassportPdfs();
  }, [live]);

  // A passport PDF's file is deleted when its viewer closes; one left by a crash or a killed app
  // goes at the next start, before anything is shown.
  useEffect(() => {
    deleteAllPassportPdfs();
  }, []);

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
        dispatch({ type: 'verified' });
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
    dispatch({ type: 'signOutStarted' });
    await serially(() =>
      signOutDevice({
        clearSession: clearLocalAuthSession,
        revoke: async () => {
          await clients?.auth.signOut();
        },
        wipeData: wipeLocalData,
      })
    ).finally(() => dispatch({ type: 'signOutFinished' }));
  };

  const retry = () => {
    dispatch({ type: 'retry' });
    refetchSession();
  };

  // The saved session cookie is read again after every sign-in change and every sign-out.
  useEffect(() => {
    dispatch({ isAuthenticated, type: 'authChanged' });
  }, [isAuthenticated]);
  const { read: cookieRead, status: cookieStatus } = machine.cookie;
  useEffect(() => {
    if (cookieStatus !== 'checking') return;
    let active = true;
    void holdsSavedSession().then((held) => {
      if (active) dispatch({ held, read: cookieRead, type: 'cookieRead' });
    });
    return () => {
      active = false;
    };
  }, [cookieRead, cookieStatus]);
  // Until the effect above has run, a read for the previous sign-in state counts as unread.
  const cookie = machine.cookie.forAuth === isAuthenticated ? cookieStatus : 'checking';

  // The stored server-check flag is read once; after that the machine owns it and the store mirrors it.
  useEffect(() => {
    if (checkLoaded) dispatch({ required: storedServerCheck, type: 'serverCheckLoaded' });
  }, [checkLoaded, storedServerCheck]);
  const { serverCheck } = machine;
  useEffect(() => {
    // A wipe clears the stored flag too; writing it back keeps the next sign-in checked.
    if (serverCheck !== 'unread' && checkLoaded && storedServerCheck !== (serverCheck === 'required')) {
      void serially(() => live.set(SERVER_CHECK_KEY, serverCheck === 'required'));
    }
  }, [checkLoaded, live, serially, serverCheck, storedServerCheck]);

  // A hanging connection never errors, so after a while stop waiting: open the saved data offline,
  // or say that the server is not answering.
  const waiting = isLoading || (isAuthenticated && access === undefined);
  useEffect(() => {
    dispatch({ type: 'serverWaiting', waiting });
  }, [machine.kind, waiting]);
  const wait = machine.kind === 'active' ? machine.wait : 'idle';
  useEffect(() => {
    if (wait !== 'waiting') return;
    const timer = setTimeout(() => dispatch({ type: 'stallTimerFired' }), SERVER_STALL_MS);
    return () => clearTimeout(timer);
  }, [wait]);

  const gate: Gate =
    machine.kind === 'signingOut'
      ? { kind: 'loading' }
      : resolveGate({
          access: access ?? undefined,
          authLoading: isLoading || !verifiedLoaded || serverCheck === 'unread' || cookie === 'checking',
          hasCachedSession: cookie === 'held',
          isAuthenticated,
          lastVerified: storedVerified,
          needsServerCheck: serverCheck === 'required',
          now,
          sessionRejected: sessionRejectedByServer(authSession),
          stalled: wait === 'stalled',
        });

  // Whoever signs in next is confirmed by the server before any saved data opens.
  useEffect(() => {
    if (gate.kind === 'signedOut') dispatch({ type: 'signInShown' });
  }, [gate.kind]);

  return <SessionContext.Provider value={{ gate, online, retry, revoke, signOut }}>{children}</SessionContext.Provider>;
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
