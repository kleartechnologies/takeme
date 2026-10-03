"use client";

import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  configured: isFirebaseConfigured,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [pendingAccount, setPendingAccount] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // Keep the first server and browser render identical. Firebase is only
  // initialised in the browser, so deriving this value from `auth` would
  // otherwise create a hydration mismatch on authenticated screens.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(doc(db, "accountLifecycles", user.uid), (snapshot) => setPendingAccount(snapshot.data()?.state === "deletion_pending" ? user.uid : null), () => {});
  }, [user]);

  const value = useMemo(() => ({ user, loading: isFirebaseConfigured ? loading : false, configured: isFirebaseConfigured }), [user, loading]);
  return <AuthContext.Provider value={value}>{user && pendingAccount === user.uid && <div role="status" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm">TAKEME account deletion is pending. Normal marketplace activity is blocked. <Link className="font-semibold underline" href="/account-deletion">View deletion progress</Link></div>}{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
