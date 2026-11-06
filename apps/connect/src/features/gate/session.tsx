import { staffApi, TOUR_MANAGER_ROLE } from '@citius/backend';
import { useConvexAuth, useQuery } from 'convex/react';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { useAppStore, useStoredValue } from '@/lib/app-store';
import { clients } from '@/lib/clients';
import { useOnline } from '@/lib/network';
import { logEvent } from '@/lib/safe-log';
import { useNow } from '@/lib/use-now';
import { deleteAllReceipts } from '@/features/expenses/receipt-files';

import { type Gate, resolveGate, type VerifiedStaff } from './resolve-gate';

const VERIFIED_KEY = 'session:verifiedStaff';

interface StaffSession {
  gate: Gate;
  isTourManager: boolean;
  online: boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<StaffSession | null>(null);

function useHasCachedSession(isAuthenticated: boolean) {
  const [cached, setCached] = useState<{ for: boolean; value: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    // Only the Expo plugin stores a session cookie on the device; the web preview has none.
    const auth = Platform.OS === 'web' ? undefined : (clients?.auth as { getCookie?: () => Promise<string> } | undefined);
    (auth?.getCookie?.() ?? Promise.resolve(''))
      .then((cookie) => {
        if (active) setCached({ for: isAuthenticated, value: Boolean(cookie) });
      })
      .catch(() => {
        if (active) setCached({ for: isAuthenticated, value: false });
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);
  return cached?.for === isAuthenticated ? cached.value : null;
}

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const { live, store } = useAppStore();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const online = useOnline();
  const access = useQuery(staffApi.getMyPortalAccess.ref, isAuthenticated ? {} : 'skip');
  const [storedVerified, , verifiedLoaded] = useStoredValue<VerifiedStaff | null>(VERIFIED_KEY, null);
  const hasCachedSession = useHasCachedSession(isAuthenticated);
  const now = useNow();
  const [sessionVerified, setSessionVerified] = useState<VerifiedStaff | null>(null);

  const verifiedNow = access?.allowed && access.staffId ? access : null;
  if (verifiedNow && sessionVerified?.staffId !== verifiedNow.staffId) {
    setSessionVerified({ name: verifiedNow.name, roles: verifiedNow.roles, staffId: verifiedNow.staffId ?? '', verifiedAt: now });
  }

  useEffect(() => {
    if (sessionVerified) {
      live.set(VERIFIED_KEY, sessionVerified);
    }
  }, [live, sessionVerified]);

  const gate = resolveGate({
    access: access ?? undefined,
    authLoading: isLoading || !verifiedLoaded || hasCachedSession === null,
    hasCachedSession: Boolean(hasCachedSession),
    isAuthenticated,
    lastVerified: sessionVerified ?? storedVerified,
    now,
    online,
  });

  const signOut = async () => {
    try {
      await clients?.auth.signOut();
    } catch (error) {
      logEvent('session.sign-out-failed', error);
    }
    setSessionVerified(null);
    try {
      await store.clear();
    } catch (error) {
      logEvent('session.clear-failed', error);
    }
    live.reset();
    deleteAllReceipts();
  };

  const isTourManager = gate.kind === 'staff' && gate.staff.roles.includes(TOUR_MANAGER_ROLE);
  return (
    <SessionContext.Provider value={{ gate, isTourManager, online, signOut }}>{children}</SessionContext.Provider>
  );
}

export function useStaffSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useStaffSession needs StaffSessionProvider');
  }
  return value;
}

/** The signed-in staff member; only valid inside the staff part of the app. */
export function useStaff() {
  const { gate } = useStaffSession();
  if (gate.kind !== 'staff') {
    throw new Error('useStaff used outside the staff area');
  }
  return gate.staff;
}
