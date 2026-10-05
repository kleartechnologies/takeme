"use client";
import Image from "next/image";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./auth-provider";
import { AuthShell } from "./auth-shell";
import { PolicyCheckboxes } from "./policy-checkboxes";
import { ProfileAvatar } from "@/components/profile/profile-ui";
import { auth, db } from "@/lib/firebase/client";
import { createProfileIfMissing } from "@/lib/firebase/profile-bootstrap";
import { PROFILE_NAME_FALLBACK, validateSignupDisplayName } from "@/lib/firebase/profile-name";
import { friendlyAuthError } from "@/lib/firebase/auth-errors";
import { logout } from "@/lib/firebase/auth";
import { safeAuthNext, setupDestination, welcomeDestinations, type SetupStep } from "@/lib/auth-routing";
import { acceptWebPolicies, completeFirstTimeProfile, finishAccountWelcome, isLocalAccountSetup, accountPolicyAvailable, accountReleasePolicy } from "@/lib/services/account-setup";
import { getUserProfile, updatePublicProfile } from "@/lib/services/users";
import { MALAYSIAN_STATES, formatPublicLocation, makePublicLocation, parseLegacyGeneralLocation } from "@/lib/general-location";
import styles from "./auth.module.css";

export function AccountOnboarding({ step }: { step: Exclude<SetupStep, "ready" | "deletion"> }) {
  const { user } = useAuth();
  return <AccountOnboardingForm key={user?.uid ?? "signed-out"} step={step} />;
}

function AccountOnboardingForm({ step }: { step: Exclude<SetupStep, "ready" | "deletion"> }) {
  const { user, loading, setup, setupError, refreshSetup } = useAuth();
  const policy = accountReleasePolicy(), local = isLocalAccountSetup();
  const available = accountPolicyAvailable() && setup?.policyAvailable !== false;
  const router = useRouter(), nextPath = safeAuthNext(useSearchParams().get("next"));
  const welcome = welcomeDestinations(nextPath);
  const [age, setAge] = useState(false), [agreed, setAgreed] = useState(false);
  const [name, setName] = useState(""), [city, setCity] = useState(""), [state, setState] = useState("");
  const [photo, setPhoto] = useState<File | null>(null), [photoURL, setPhotoURL] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null), fileInput = useRef<HTMLInputElement>(null), submitting = useRef(false);
  const welcomeDestination = useRef<string | null>(null);
  function validationError(message: string) { setError(message); requestAnimationFrame(() => errorRef.current?.focus()); }
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    else if (!busy && setup && setup.step !== step) router.replace(setupDestination(setup.step, welcomeDestination.current ?? nextPath));
  }, [loading, user, setup, step, nextPath, router, busy]);
  useEffect(() => {
    if (step !== "profile" || !user || setup?.step !== "profile" || !db) return;
    let active = true;
    async function load() {
      await createProfileIfMissing(db!, user!);
      const profile = await getUserProfile(user!.uid);
      if (!active) return;
      if (!profile) throw new Error("Profile unavailable");
      const area = parseLegacyGeneralLocation(profile.location);
      setName(profile.displayName === PROFILE_NAME_FALLBACK ? "" : profile.displayName);
      setCity(area?.districtOrCity ?? ""); setState(area?.state ?? ""); setPhotoURL(profile.photoURL);
      setProfileReady(true); setError("");
    }
    void load().catch(() => { if (active) setError("Your profile could not be loaded. Please try again."); });
    return () => { active = false; };
  }, [user, setup?.step, step, revision]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return; setError("");
    const destination = step === "welcome"
      ? safeAuthNext((event.nativeEvent as SubmitEvent).submitter?.getAttribute("value"))
      : nextPath;
    if (step === "acceptance" && (!age || !agreed)) return validationError("Confirm that you are at least 18 and agree to both policies to continue.");
    if (step === "profile") {
      try { validateSignupDisplayName(name); } catch { return validationError("Display name must be 2–80 characters."); }
      if ((city.trim() || state) && !makePublicLocation(city, state)) return validationError("Choose a district or city and Malaysian state. Please leave out street addresses.");
      if (photo && (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 8 * 1024 * 1024)) return validationError("Choose a JPG, PNG or WebP photo under 8 MB.");
    }
    submitting.current = true; setBusy(true);
    try {
      const expectedUid = user?.uid;
      const assertSameAccount = () => {
        if (!expectedUid || auth?.currentUser?.uid !== expectedUid) throw Object.assign(new Error("The signed-in account changed."), { details: { reason: "account-setup-changed" } });
      };
      assertSameAccount();
      if (step === "acceptance") await acceptWebPolicies(age, agreed);
      if (step === "profile") {
        const area = makePublicLocation(city, state);
        await updatePublicProfile({ displayName: name.trim(), location: area ? formatPublicLocation(area) : "", photo });
        assertSameAccount();
        await completeFirstTimeProfile();
      }
      if (step === "welcome") {
        welcomeDestination.current = destination;
        await finishAccountWelcome();
      }
      assertSameAccount();
      const status = await refreshSetup();
      if (status) router.replace(setupDestination(status.step, destination));
    } catch (caught) { setError(friendlyAuthError(caught)); }
    finally { submitting.current = false; setBusy(false); }
  }
  if (user && setup && !available) return <AuthShell><h1 className={styles.heading}>Account setup is awaiting approval</h1><p className={styles.intro}>TAKEME’s final policies are not yet available. Protected marketplace actions will remain unavailable until publication is approved. You can still browse the marketplace.</p><button className={styles.primary} onClick={() => void refreshSetup().catch(() => {})}>Check again</button><Link href="/explore" className={styles.textButton}>Browse Explore</Link><Link href="/account-deletion" className={styles.textButton}>Account deletion</Link><button className={styles.textButton} onClick={() => void logout()}>Sign out</button></AuthShell>;
  if (!user || !setup || setup.step !== step) return <AuthShell><h1 className={styles.heading}>One moment…</h1><p role={setupError ? "alert" : "status"} className={styles.intro}>{setupError ? "Your account status could not be checked. Please try again." : "Checking your TAKEME account."}</p>{setupError && <><button className={styles.primary} onClick={() => void refreshSetup().catch(() => {})}>Retry</button><button className={styles.textButton} onClick={() => void logout()}>Sign out</button></>}<Link href="/account-deletion" className={styles.textButton}>Account deletion</Link></AuthShell>;
  return <AuthShell><div className={step === "welcome" ? styles.welcome : undefined}>
    {step === "welcome" && <Image className={styles.mascot} src="/brand/mascot-3d-happy.png" alt="Happy TAKEME mascot" width={168} height={168} priority />}
    <p className={styles.eyebrow}>{step === "acceptance" ? "A good start, together" : step === "profile" ? "Make yourself at home" : "You’re all set"}</p>
    <h1 className={styles.heading}>{step === "acceptance" ? "Before we begin" : step === "profile" ? "Your TAKEME profile" : "Welcome to TAKEME"}</h1>
    <p className={styles.intro}>{step === "acceptance" ? "TAKEME is for adults aged 18 and over. Please read and agree to our policies to continue." : step === "profile" ? "Choose the name people will see. A photo and general area are optional." : "Buy, sell and discover something worth taking home."}</p>
    <form onSubmit={event => void submit(event)} noValidate className={styles.form} aria-busy={busy}>
      {step === "acceptance" && <PolicyCheckboxes age={age} agreed={agreed} setAge={setAge} setAgreed={setAgreed} disabled={busy} />}
      {step === "profile" && <>
        <div className={styles.photo}><ProfileAvatar photo={photoURL} size={64} /><div><button disabled={busy || !profileReady} className={styles.textButton} type="button" onClick={() => fileInput.current?.click()}>Add profile photo</button><p>{photo ? "Photo selected" : "Optional · JPG, PNG or WebP, up to 8 MB"}</p><input type="file" ref={fileInput} className="sr-only" tabIndex={-1} aria-label="Choose profile photo" accept="image/jpeg,image/png,image/webp" onChange={event => setPhoto(event.target.files?.[0] ?? null)} />{photo && <button className={styles.textButton} type="button" disabled={busy} onClick={() => { setPhoto(null); if (fileInput.current) fileInput.current.value = ""; }}>Skip photo for now</button>}</div></div>
        <label className={styles.field} htmlFor="setup-name">What should we call you?<input id="setup-name" autoComplete="nickname" placeholder="Your display name" value={name} disabled={busy || !profileReady} onChange={event => setName(event.target.value)} maxLength={80} required aria-describedby="name-help" /><span className={styles.helper} id="name-help">Your public marketplace name · 2–80 characters</span></label>
        <div className={styles.sectionLabel}><span>Your area <span className={styles.helper}>(optional)</span></span><button type="button" className={styles.textButton} disabled={busy} onClick={() => { setCity(""); setState(""); }}>Skip for now</button></div>
        <div className={styles.location}><label className={styles.field} htmlFor="setup-city">District / City<input id="setup-city" autoComplete="address-level2" maxLength={60} value={city} disabled={busy || !profileReady} onChange={event => setCity(event.target.value)} placeholder="e.g. Jitra" /></label><label className={styles.field} htmlFor="setup-state">State<select id="setup-state" value={state} disabled={busy || !profileReady} onChange={event => setState(event.target.value)}><option value="">Select state</option>{MALAYSIAN_STATES.map(item => <option key={item}>{item}</option>)}</select></label></div><p className={styles.helper}>Your area is public and helps people understand where you’re based. No street address or precise location.</p>
      </>}
      {step === "welcome" && <div className={styles.chips}>{["New", "Branded", "Preloved", "Auctions"].map(item => <span key={item}>{item}</span>)}</div>}
      {error && <div className={styles.error} ref={errorRef} tabIndex={-1} role="alert">{error}</div>}
      {step === "profile" && !profileReady && error ? <button className={styles.primary} type="button" onClick={() => setRevision(value => value + 1)}>Retry</button> : <button className={styles.primary} disabled={busy || (step === "profile" && !profileReady)} type="submit" value={step === "welcome" ? welcome.explore : undefined}>{busy && <LoaderCircle size={18} className="animate-spin" />}{busy ? "Saving…" : step === "acceptance" ? "Agree & continue" : step === "profile" ? "Continue" : "Start Exploring"}</button>}
      {step === "welcome" && <button className={styles.textButton} type="submit" value={welcome.secondary.destination} disabled={busy}>{welcome.secondary.label}</button>}
    </form>
    {step === "acceptance" && <p className={styles.draft}>{local ? `Local preview · Terms ${policy.termsVersion} / Privacy ${policy.privacyVersion}. Acceptance is recorded for this demo account only. These policies are not published or final.` : `Terms ${policy.termsVersion} / Privacy ${policy.privacyVersion}.`}</p>}
    {step !== "welcome" && <p className={styles.switch}><button className={styles.textButton} disabled={busy} onClick={() => void logout()}>Sign out</button> · <Link href="/account-deletion">Account deletion</Link></p>}
  </div></AuthShell>;
}
