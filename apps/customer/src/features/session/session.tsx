import { customerApi } from '@citius/backend/customer';
import { useConvexAuth, useMutation } from 'convex/react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { LANGUAGE_KEY } from '@/i18n/i18n';
import { useAppStore } from '@/lib/app-store';
import { clearLocalAuthSession } from '@/lib/auth-storage';
import { clients } from '@/lib/clients';
import { useOnline } from '@/lib/network';
import { logEvent } from '@/lib/safe-log';

import { type AuthSessionState, type Gate, resolveGate, sessionRejectedByServer } from './gate';
import { signOutDevice } from './sign-out';

/** An invite link that arrived before sign-in; accepted right after. */
export const PENDING_INVITE_KEY = 'session:pendingInvite';
/** Where to return after an email link signs the traveller in again (account deletion). */
export const RETURN_TO_KEY = 'session:returnTo';

interface CustomerSession {
  gate: Gate;
  online: boolean;
  /** Ends the session here and on the server, and deletes everything saved on this phone. */
  signOut: () => Promise<void>;
  /** Deletes saved data and the local session after the account itself was deleted. */
  forget: () => Promise<void>;
}

const SessionContext = createContext<CustomerSession | null>(null);

const NO_SESSION: AuthSessionState = { data: null, error: null, isPending: false };
const noSession = () => NO_SESSION;
/** Better Auth's session state; `clients` is fixed at start-up, so the hook choice never changes. */
const useAuthSession: () => AuthSessionState = clients ? clients.auth.useSession : noSession;

function useHasCachedSession(isAuthenticated: boolean, epoch: number) {
  const [cached, setCached] = useState<{ for: string; value: boolean } | null>(null);
  const checkFor = `${isAuthenticated}:${epoch}`;
  useEffect(() => {
    let active = true;
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

/** How long the gate waits for the server before opening saved trips. */
export const SERVER_STALL_MS = 8_000;

function useStalled(waiting: boolean) {
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setStalled(true), SERVER_STALL_MS);
    return () => {
      clearTimeout(timer);
      setStalled(false);
    };
  }, [waiting]);
  return waiting && stalled;
}

export function CustomerSessionProvider({ children }: { children: ReactNode }) {
  const { live } = useAppStore();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const authSession = useAuthSession();
  const online = useOnline();
  const [epoch, setEpoch] = useState(0);
  const hasCachedSession = useHasCachedSession(isAuthenticated, epoch);
  const [signingOut, setSigningOut] = useState(false);
  const ensureProfile = useMutation(customerApi.ensureMyProfile.ref);
  const profileLinked = useRef(false);

  // Links the canonical identity and creates the profile once per start, as the website does.
  useEffect(() => {
    if (!isAuthenticated || profileLinked.current) return;
    profileLinked.current = true;
    ensureProfile({}).catch((error: unknown) => {
      profileLinked.current = false;
      logEvent('session.profile-link-failed', error);
    });
  }, [ensureProfile, isAuthenticated]);

  const wipeLocalData = useCallback(async () => {
    const language = live.snapshot(LANGUAGE_KEY)?.value ?? null;
    await live.wipe();
    if (language) await live.set(LANGUAGE_KEY, language);
  }, [live]);

  const end = useCallback(
    async (revoke: boolean) => {
      setSigningOut(true);
      try {
        await signOutDevice({
          clearSession: clearLocalAuthSession,
          revoke: async () => {
            if (revoke) await clients?.auth.signOut();
          },
          wipeData: wipeLocalData,
        });
      } finally {
        profileLinked.current = false;
        setEpoch((value) => value + 1);
        setSigningOut(false);
      }
    },
    [wipeLocalData]
  );

  const waiting = isLoading || (Boolean(hasCachedSession) && !isAuthenticated);
  const stalled = useStalled(waiting);
  const gate: Gate = signingOut
    ? { kind: 'loading' }
    : resolveGate({
        hasCachedSession,
        isAuthenticated,
        isLoading,
        online,
        sessionRejected: sessionRejectedByServer(authSession),
        stalled,
      });

  return (
    <SessionContext.Provider value={{ forget: () => end(false), gate, online, signOut: () => end(true) }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useCustomerSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useCustomerSession needs CustomerSessionProvider');
  }
  return value;
}
