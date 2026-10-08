"use client";
import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, configured } from "@admin/lib/firebase";
import { useAdminSession } from "@admin/components/session";
export default function Login() {
  const { state } = useAdminSession(),
    router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (state === "allowed") router.replace("/");
  }, [state, router]);
  async function submit(google = false) {
    if (!auth || busy) return;
    setBusy(true);
    setError("");
    try {
      if (google) await signInWithPopup(auth, new GoogleAuthProvider());
      else await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("Sign-in did not complete. Check your details or try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-panel">
        <p className="eyebrow">TAKEME Admin</p>
        <h1>Marketplace control room</h1>
        <p>Sign in with your existing administrator account.</p>
        {state === "denied" ? (
          <>
            <p role="alert">
              Administrator access is required. No dashboard data was loaded.
            </p>
            <button onClick={() => void signOut(auth!)}>
              Use another account
            </button>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy || !configured}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              disabled={busy || !configured}
              onClick={() => void submit(true)}
            >
              Continue with Google
            </button>
          </form>
        )}
        {!configured && (
          <p role="alert">The admin environment is not configured.</p>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </main>
  );
}
