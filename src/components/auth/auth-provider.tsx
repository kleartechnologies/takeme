"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase/client";
import { getAccountSetupStatus, isLocalAccountSetup, type AccountSetupStatus } from "@/lib/services/account-setup";
import { isAuthPath, isPendingResolutionPath, safeAuthNext, setupDestination } from "@/lib/auth-routing";
import { isPublicInformationPath } from "@/lib/public-information";
import { logout } from "@/lib/firebase/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  setup: AccountSetupStatus | null;
  setupError: boolean;
  refreshSetup: () => Promise<AccountSetupStatus | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  configured: isFirebaseConfigured,
  setup: null,
  setupError: false,
  refreshSetup: async () => null,
});

function AccountSetupGate({ children }: { children: React.ReactNode }) {
  const { user, setup, setupError, refreshSetup } = useAuth();
  const path = usePathname(), router = useRouter();
  const exempt = isAuthPath(path) || isPublicInformationPath(path);
  const redirect = !!user && isLocalAccountSetup() && !exempt && !!setup
    && (setup.step === "deletion" ? !isPendingResolutionPath(path) : setup.step !== "ready");
  useEffect(() => {
    if (!redirect || !setup) return;
    const intended = safeAuthNext(`${path}${window.location.search}${window.location.hash}`);
    router.replace(setupDestination(setup.step, intended));
  }, [redirect, path, router, setup]);
  if (!user || !isLocalAccountSetup() || exempt) return children;
  if (setupError) return <main className="page-shell grid min-h-[75vh] place-content-center gap-4 text-center"><h1 className="text-2xl font-bold">Let’s reconnect</h1><p role="alert">Your account status could not be checked. Please try again.</p><button className="button-primary" onClick={() => void refreshSetup().catch(() => {})}>Retry</button><Link className="min-h-11 underline" href="/account-deletion">Account deletion</Link><button className="min-h-11 underline" onClick={() => void logout()}>Sign out</button></main>;
  if (!setup || redirect) return <main className="grid min-h-[75vh] place-content-center" role="status">Checking your TAKEME account…</main>;
  return children;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [pendingAccount, setPendingAccount] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // Keep the first server and browser render identical. Firebase is only
  // initialised in the browser, so deriving this value from `auth` would
  // otherwise create a hydration mismatch on authenticated screens.
  const [loading, setLoading] = useState(true);
  const [setupState, setSetupState] = useState<{ uid: string; status: AccountSetupStatus | null; error: boolean } | null>(null);
  const setupRequest = useRef(0);
  const refreshSetup = useCallback(async () => {
    const current = auth?.currentUser;
    if (!current || !isLocalAccountSetup()) return null;
    const request = ++setupRequest.current;
    try {
      const status = await getAccountSetupStatus();
      if (request === setupRequest.current && auth?.currentUser?.uid === current.uid) setSetupState({ uid: current.uid, status, error: false });
      return status;
    } catch (error) {
      if (request === setupRequest.current && auth?.currentUser?.uid === current.uid) setSetupState({ uid: current.uid, status: null, error: true });
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) void refreshSetup().catch(() => {});
      else { setupRequest.current++; setSetupState(null); }
    });
  }, [refreshSetup]);

  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(doc(db, "accountLifecycles", user.uid), (snapshot) => {
      setPendingAccount(snapshot.data()?.state === "deletion_pending" ? user.uid : null);
      if (snapshot.exists()) { setupRequest.current++; setSetupState({ uid: user.uid, status: { step: "deletion" }, error: false }); }
    }, () => {});
  }, [user]);

  const ownSetup = setupState?.uid === user?.uid ? setupState : null;
  const value = useMemo(() => ({ user, loading: isFirebaseConfigured ? loading : false, configured: isFirebaseConfigured, setup: ownSetup?.status ?? null, setupError: ownSetup?.error ?? false, refreshSetup }), [user, loading, ownSetup, refreshSetup]);
  return <AuthContext.Provider value={value}>{user && pendingAccount === user.uid && <div role="status" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm">TAKEME account deletion is pending. Normal marketplace activity is blocked. <Link className="font-semibold underline" href="/account-deletion">View deletion progress</Link></div>}<AccountSetupGate>{children}</AccountSetupGate></AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
