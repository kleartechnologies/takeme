"use client";

import { Eye, EyeOff, LoaderCircle, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Logo } from "@/components/layout/logo";
import { loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword } from "@/lib/firebase/auth";
import { isFirebaseConfigured } from "@/lib/firebase/client";

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

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(""); setError("");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (mode !== "forgot" && password.length < 8) return setError("Password must be at least 8 characters.");
    if (mode === "register" && displayName.trim().length < 2) return setError("Enter your name.");
    setBusy(true);
    try {
      if (mode === "register") { await registerWithEmail(email, password, displayName.trim()); router.push("/profile"); }
      else if (mode === "login") { await loginWithEmail(email, password); router.push("/profile"); }
      else { await resetPassword(email); setMessage("Password reset email sent. Check your inbox."); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn’t complete that request."); }
    finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setError("");
    try { await loginWithGoogle(); router.push("/profile"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Google sign-in failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-[var(--takeme-shadow-md)] sm:p-8">
      <div className="mb-7"><div className="mb-5"><Logo /></div><p className="eyebrow">Welcome to TAKEME</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">{mode === "login" ? "Good to see you" : mode === "register" ? "Create your account" : "Reset your password"}</h1><p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">{mode === "login" ? "Log in to save finds and manage your marketplace profile." : mode === "register" ? "Start discovering and preparing listings in a few steps." : "We’ll send a reset link to your email address."}</p></div>
      {!isFirebaseConfigured && <div className="mb-5 rounded-xl border border-[var(--takeme-green)]/25 bg-[var(--takeme-light-green)] p-3 text-xs leading-5 text-[var(--takeme-dark-green)]"><strong>Firebase setup needed.</strong> Add the environment variables in <code>.env.local</code> to enable authentication.</div>}
      <form onSubmit={submit} className="grid gap-4">
        {mode === "register" && <label className="form-field"><span>Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" placeholder="Your name" /></label>}
        <label className="form-field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" /></label>
        {mode !== "forgot" && <label className="form-field"><span className="flex items-center justify-between">Password {mode === "login" && <Link href="/forgot-password" className="text-xs font-semibold text-[var(--takeme-dark-green)]">Forgot password?</Link>}</span><span className="relative"><input className="w-full rounded-xl border border-gray-300 px-3 py-3 pr-11 text-sm outline-none focus:border-[var(--takeme-green)] focus:ring-3 focus:ring-[rgb(0_200_83_/_0.12)]" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="At least 8 characters" /><button type="button" className="absolute right-1 top-1 grid size-10 place-items-center text-[var(--takeme-gray)]" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
        {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-medium leading-5 text-red-700" role="alert">{error}</p>}{message && <p className="rounded-xl bg-[var(--takeme-light-green)] p-3 text-xs font-medium leading-5 text-[var(--takeme-dark-green)]" role="status">{message}</p>}
        <button disabled={busy} className="button-primary mt-1 h-12" type="submit">{busy && <LoaderCircle size={17} className="animate-spin" />}{mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Send reset link"}</button>
      </form>
      {mode !== "forgot" && <><div className="my-5 flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div><button disabled={busy} onClick={() => void google()} className="button-secondary h-12 w-full"><Mail size={17} /> Continue with Google</button></>}
      <p className="mt-6 text-center text-sm text-[var(--takeme-gray)]">{mode === "login" ? <>New here? <Link href="/register" className="font-semibold text-[var(--takeme-dark-green)]">Create an account</Link></> : mode === "register" ? <>Already registered? <Link href="/login" className="font-semibold text-[var(--takeme-dark-green)]">Log in</Link></> : <Link href="/login" className="font-semibold text-[var(--takeme-dark-green)]">Back to login</Link>}</p>
    </div>
  );
}
