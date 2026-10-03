"use client";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-provider";
import { AuthShell } from "./auth-shell";
import { PolicyCheckboxes } from "./policy-checkboxes";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";
import { checkSignupPassword, loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword } from "@/lib/firebase/auth";
import { friendlyAuthError } from "@/lib/firebase/auth-errors";
import { passwordPolicyHelp } from "@/lib/firebase/password-policy";
import { safeAuthNext, setupDestination } from "@/lib/auth-routing";
import { acceptWebPolicies, isLocalAccountSetup, accountPolicyAvailable, accountReleasePolicy } from "@/lib/services/account-setup";
import styles from "./auth.module.css";

type Mode = "login" | "register" | "forgot";
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter(), { user, loading, refreshSetup } = useAuth();
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false), [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [age, setAge] = useState(false), [agreed, setAgreed] = useState(false);
  const [sent, setSent] = useState(false), [error, setError] = useState("");
  const [recoverSetup, setRecoverSetup] = useState(false);
  const [policyHelp, setPolicyHelp] = useState("Password requirements are checked securely when you create your account.");
  const errorRef = useRef<HTMLDivElement>(null), submitting = useRef(false);
  const nextPath = safeAuthNext(useSearchParams().get("next"));
  const local = isLocalAccountSetup(), available = accountPolicyAvailable(), policy = accountReleasePolicy();
  useEffect(() => {
    if (mode !== "register" || !available) return;
    let active = true;
    checkSignupPassword("").then(status => { if (active) setPolicyHelp(passwordPolicyHelp(status.passwordPolicy)); }).catch(() => {});
    return () => { active = false; };
  }, [mode, available]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const href = (path: string) => `${path}?next=${encodeURIComponent(nextPath)}`;
  function validationError(message: string) {
    setError(message);
    // Repeated identical validation errors must still move focus back to the error.
    requestAnimationFrame(() => errorRef.current?.focus());
  }
  async function resume() {
    const setup = await refreshSetup();
    if (!setup) throw new Error("Account status could not be checked.");
    router.replace(setupDestination(setup.step, nextPath));
  }
  async function retrySetup() {
    if (submitting.current) return;
    submitting.current = true; setBusy("email"); setError("");
    try {
      if (mode === "register" && age && agreed) await acceptWebPolicies(age, agreed);
      await resume();
    } catch (caught) { setError(friendlyAuthError(caught)); }
    finally { submitting.current = false; setBusy(null); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting.current) return; setError("");
    if (recoverSetup && auth?.currentUser) { await retrySetup(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return validationError("Enter a valid email address.");
    if (mode !== "forgot" && !password) return validationError("Enter your password.");
    if (mode === "register" && (!age || !agreed)) return validationError("Confirm that you are at least 18 and agree to the Terms of Service and Privacy Policy.");
    if (mode === "register" && !available) return validationError("Account creation will be available after TAKEME’s policies are finalised.");
    const beforeUid = auth?.currentUser?.uid;
    submitting.current = true; setBusy("email");
    try {
      if (mode === "forgot") { await resetPassword(email.trim()); setSent(true); return; }
      if (mode === "register") {
        const status = await checkSignupPassword(password); setPolicyHelp(passwordPolicyHelp(status.passwordPolicy));
        if (!status.isValid) { setError(passwordPolicyHelp(status.passwordPolicy)); return; }
        await registerWithEmail(email.trim(), password); await acceptWebPolicies(age, agreed);
      } else await loginWithEmail(email.trim(), password);
      await resume();
    } catch (caught) {
      const signedIn = mode !== "forgot" && !!auth?.currentUser && (recoverSetup || auth.currentUser.uid !== beforeUid);
      if (signedIn) setRecoverSetup(true);
      setError(signedIn ? "You’re signed in, but account setup could not finish. Retry to continue without creating another account." : friendlyAuthError(caught));
    }
    finally { submitting.current = false; setBusy(null); }
  }
  async function google() {
    if (submitting.current) return;
    const beforeUid = auth?.currentUser?.uid;
    submitting.current = true; setError(""); setBusy("google");
    try { await loginWithGoogle(); await resume(); }
    catch (caught) {
      if (auth?.currentUser && auth.currentUser.uid !== beforeUid) { setRecoverSetup(true); setError("You’re signed in with Google. Continue with your signed-in account below to retry setup."); }
      else setError(friendlyAuthError(caught));
    }
    finally { submitting.current = false; setBusy(null); }
  }
  return <AuthShell>
    <p className={styles.eyebrow}>{mode === "forgot" ? "A little help getting back in" : "Welcome to TAKEME"}</p>
    <h1 className={styles.heading}>{mode === "login" ? "Welcome back" : mode === "register" ? "Find your next great thing" : "Forgot password?"}</h1>
    <p className={styles.intro}>{mode === "login" ? "Log in to pick up where you left off." : mode === "register" ? "Create your account. Your marketplace profile comes next." : "Enter your email and we’ll send you a password-reset link."}</p>
    {mode !== "forgot" && <><button className={styles.google} type="button" disabled={!!busy || loading || !isFirebaseConfigured || (mode === "register" && !available)} onClick={() => void google()}>{busy === "google" ? <LoaderCircle size={20} className="animate-spin" /> : <Image src="/brand/google-g.png" alt="" width={20} height={20} />}<span>{busy === "google" ? "Connecting…" : "Continue with Google"}</span></button><div className={styles.divider}>or use your email</div></>}
    <form className={styles.form} onSubmit={event => void submit(event)} noValidate aria-busy={!!busy}>
      {sent && <div className={styles.success} role="status"><strong>Check your email</strong>If an account exists for that address, you’ll receive reset instructions.</div>}
      <label className={styles.field} htmlFor="auth-email">Email<input id="auth-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" required disabled={!!busy || loading} value={email} onChange={event => { setEmail(event.target.value); setSent(false); }} placeholder="you@example.com" /></label>
      {mode !== "forgot" && <div className={styles.field}><label htmlFor="auth-password">Password</label><div className={styles.password}><input id="auth-password" required disabled={!!busy || loading} type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} aria-describedby={mode === "register" ? "password-help" : undefined} /><button disabled={!!busy || loading} type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>{mode === "register" && <p id="password-help" className={styles.helper}>{policyHelp}</p>}</div>}
      {mode === "login" && <div className={styles.forgot}><Link href={href("/forgot-password")} className={styles.textButton}>Forgot password?</Link></div>}
      {mode === "register" && <PolicyCheckboxes age={age} agreed={agreed} setAge={setAge} setAgreed={setAgreed} disabled={!!busy || loading} />}
      {error && <div ref={errorRef} tabIndex={-1} className={styles.error} role="alert">{error}</div>}
      {!isFirebaseConfigured && <p className={styles.error} role="status">Sign-in is temporarily unavailable. Please try again later.</p>}
      <button className={styles.primary} type="submit" disabled={!!busy || loading || !isFirebaseConfigured || (mode === "register" && !available)}>{busy === "email" && <LoaderCircle className="animate-spin" size={18} />}{busy === "email" ? (mode === "login" ? "Signing in…" : mode === "register" ? "Creating account…" : "Sending…") : recoverSetup || (error && /connect|connection/i.test(error)) ? "Retry" : mode === "login" ? "Log in" : mode === "register" ? "Create account" : sent ? "Send another link" : "Send reset link"}</button>
    </form>
    {mode === "register" && <p className={styles.draft}>{local ? `Local preview · Terms ${policy.termsVersion} / Privacy ${policy.privacyVersion}. Acceptance is for demo accounts only.` : available ? `Terms ${policy.termsVersion} / Privacy ${policy.privacyVersion}.` : "Account creation is awaiting final policy publication and launch approval."}</p>}
    <p className={styles.switch}>{mode === "login" ? <>New to TAKEME? <Link href={href("/register")}>Create account</Link></> : mode === "register" ? <>Already have an account? <Link href={href("/login")}>Log in</Link></> : <Link href={href("/login")}>Back to log in</Link>}</p>
    {user && <p className={styles.switch}><button className={styles.textButton} disabled={!!busy || loading} onClick={() => void retrySetup()}>Continue with your signed-in account</button></p>}
  </AuthShell>;
}
