"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Logo } from "@/components/layout/logo";
import { loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword } from "@/lib/firebase/auth";
import { friendlyAuthError } from "@/lib/firebase/auth-errors";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { PROFILE_NAME_ERROR, validateSignupDisplayName } from "@/lib/firebase/profile-name";

type Mode = "login" | "register" | "forgot";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const requested = useSearchParams().get("next");
  const nextPath = requested?.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") ? requested : "/profile";

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(""); setError("");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (mode !== "forgot" && password.length < 8) return setError("Password must be at least 8 characters.");
    if (mode === "register") {
      try { validateSignupDisplayName(displayName); }
      catch { return setError(PROFILE_NAME_ERROR); }
    }
    setBusy(true);
    try {
      if (mode === "register") { await registerWithEmail(email, password, displayName.trim()); router.push(nextPath); }
      else if (mode === "login") { await loginWithEmail(email, password); router.push(nextPath); }
      else { await resetPassword(email); setMessage("Password reset email sent. Check your inbox."); }
    } catch (caught) { setError(friendlyAuthError(caught)); }
    finally { setBusy(false); }
  }

  async function continueWithGoogle() {
    setMessage(""); setError(""); setBusy(true);
    try { await loginWithGoogle(); router.push(nextPath); }
    catch (caught) { setError(friendlyAuthError(caught)); }
    finally { setBusy(false); }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-[var(--takeme-shadow-md)] sm:p-8">
      <div className="mb-7"><div className="mb-5"><Logo /></div><p className="eyebrow">Welcome to TAKEME</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">{mode === "login" ? "Good to see you" : mode === "register" ? "Create your account" : "Reset your password"}</h1><p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">{mode === "login" ? "Log in to place bids and manage your listings. Browsing is open to everyone." : mode === "register" ? "Create an account to publish listings or place auction bids." : "We’ll send a reset link to your email address."}</p></div>
      {!isFirebaseConfigured && <div className="mb-5 rounded-xl border border-[var(--takeme-green)]/25 bg-[var(--takeme-light-green)] p-3 text-xs leading-5 text-[var(--takeme-dark-green)]">Sign-in is temporarily unavailable. Please try again later.</div>}
      <form onSubmit={submit} className="grid gap-4">
        {mode === "register" && <label className="form-field"><span>Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" placeholder="Your name" /></label>}
        <label className="form-field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" /></label>
        {mode !== "forgot" && <label className="form-field"><span className="flex items-center justify-between">Password {mode === "login" && <Link href="/forgot-password" className="text-xs font-semibold text-[var(--takeme-dark-green)]">Forgot password?</Link>}</span><span className="relative"><input className="w-full rounded-xl border border-gray-300 px-3 py-3 pr-11 text-sm outline-none focus:border-[var(--takeme-green)] focus:ring-3 focus:ring-[rgb(0_200_83_/_0.12)]" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="At least 8 characters" /><button type="button" className="absolute right-1 top-1 grid size-10 place-items-center text-[var(--takeme-gray)]" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
        {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-medium leading-5 text-red-700" role="alert">{error}</p>}{message && <p className="rounded-xl bg-[var(--takeme-light-green)] p-3 text-xs font-medium leading-5 text-[var(--takeme-dark-green)]" role="status">{message}</p>}
        <button disabled={busy} className="button-primary mt-1 h-12" type="submit">{busy && <LoaderCircle size={17} className="animate-spin" />}{mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Send reset link"}</button>
      </form>
      {mode !== "forgot" && <div className="mt-5">
        <div className="flex items-center gap-3 text-xs text-[var(--takeme-gray)]"><span className="h-px flex-1 bg-gray-200" />or<span className="h-px flex-1 bg-gray-200" /></div>
        <button type="button" disabled={busy || !isFirebaseConfigured} onClick={() => void continueWithGoogle()} className="mt-4 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[var(--takeme-charcoal)] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
          <span aria-hidden="true" className="bg-gradient-to-br from-blue-500 via-red-500 to-green-500 bg-clip-text text-lg font-bold leading-none text-transparent">G</span>
          Continue with Google
        </button>
      </div>}
      <p className="mt-6 text-center text-sm text-[var(--takeme-gray)]">{mode === "login" ? <>New here? <Link href={nextPath === "/profile" ? "/register" : `/register?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[var(--takeme-dark-green)]">Create an account</Link></> : mode === "register" ? <>Already registered? <Link href={nextPath === "/profile" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[var(--takeme-dark-green)]">Log in</Link></> : <Link href="/login" className="font-semibold text-[var(--takeme-dark-green)]">Back to login</Link>}</p>
    </div>
  );
}
