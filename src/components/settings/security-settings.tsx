"use client";

import { Check, LockKeyhole } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { resetPassword } from "@/lib/firebase/auth";
import { friendlyAuthError } from "@/lib/firebase/auth-errors";
import styles from "./settings.module.css";

export function SecuritySettings() {
  const { user } = useAuth();
  const providers = user?.providerData.map(provider => provider.providerId) ?? [];
  const password = providers.includes("password");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const resetButton = useRef<HTMLButtonElement>(null);
  async function reset() {
    if (!user?.email || busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await resetPassword(user.email); setMessage("Password reset requested. Follow the email instructions to choose a new password."); }
    catch (caught) { setError(friendlyAuthError(caught)); }
    finally { setBusy(false); requestAnimationFrame(() => resetButton.current?.focus()); }
  }
  return <>
    <p className={styles.intro}>Manage how you sign in to your account.</p>
    <section className={styles.card}><h2>Sign-in methods</h2>{providers.length ? providers.map(provider => <div key={provider} className={styles.provider}><span>{provider === "password" ? "Email & password" : provider === "google.com" ? "Google" : "Other sign-in provider"}</span><span className={styles.badge}><Check size={12} />Connected</span></div>) : <p>No connected sign-in provider was returned.</p>}</section>
    <section className={styles.card}><h2>Account email</h2><p className="break-words">{user?.email ?? "No email address available"}</p><p>This is private account information.</p></section>
    {password && user?.email ? <section className={styles.card}><h2>Reset password</h2><p>Send reset instructions to your account email. Your password changes only after you follow those instructions.</p><button ref={resetButton} type="button" disabled={busy} onClick={() => void reset()} className="button-secondary mt-4 min-h-11 px-5 text-xs">{busy ? "Requesting…" : "Send password reset email"}</button></section> : providers.includes("google.com") ? <div className={styles.notice}><LockKeyhole size={18} /><span>You sign in with Google. Manage your Google password through your Google account.</span></div> : null}
    {message && <p role="status" className={styles.status}>{message}</p>}{error && <p role="alert" className={`${styles.status} ${styles.error}`}>{error}</p>}
  </>;
}
