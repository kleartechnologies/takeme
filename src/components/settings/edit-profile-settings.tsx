"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ProfileAvatar } from "@/components/profile/profile-ui";
import { MALAYSIAN_STATES, formatPublicLocation, makePublicLocation, parseLegacyGeneralLocation } from "@/lib/general-location";
import { getUserProfile, updatePublicProfile } from "@/lib/services/users";
import type { UserProfile } from "@/types/marketplace";
import styles from "./settings.module.css";

export function EditProfileSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!user) return;
    let active = true;
    getUserProfile(user.uid).then(value => {
      if (!active) return;
      if (!value) { setError("Your profile is unavailable. Try again before editing."); return; }
      const area = parseLegacyGeneralLocation(value.location);
      setProfile(value); setName(value.displayName); setCity(area?.districtOrCity ?? ""); setState(area?.state ?? ""); setError("");
    }).catch(() => { if (active) setError("Your profile could not be loaded. Please try again."); });
    return () => { active = false; };
  }, [user, revision]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSaved("");
    const area = makePublicLocation(city, state);
    if ((city.trim() || state) && !area) { setError("Choose a district or city and Malaysian state, not a street address."); return; }
    setBusy(true);
    try {
      const next = await updatePublicProfile({ displayName: name, location: area ? formatPublicLocation(area) : "", photo });
      setProfile(next); setPhoto(null); if (fileInput.current) fileInput.current.value = "";
      setSaved("Profile saved. Your photo, display name and marketplace location are public.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Profile could not be saved."); }
    finally { setBusy(false); requestAnimationFrame(() => saveButton.current?.focus()); }
  }
  if (!profile) return <>{error ? <><p role="alert" className={`${styles.status} ${styles.error}`}>{error}</p><button className={styles.textButton} onClick={() => setRevision(value => value + 1)}>Try again</button></> : <p role="status" className={styles.intro}>Loading your profile…</p>}</>;
  return <>
    <p className={styles.intro}>The details other people see on TAKEME.</p>
    {saved && <p role="status" className={styles.status}>{saved}</p>}
    {error && <p role="alert" className={`${styles.status} ${styles.error}`}>{error}</p>}
    <form onSubmit={event => void submit(event)} className={styles.form} aria-busy={busy}>
      <fieldset disabled={busy}>
        <div className={styles.photo}><ProfileAvatar photo={profile.photoURL} size={72} /><div><strong>Profile photo</strong><br /><button type="button" className={styles.textButton} onClick={() => fileInput.current?.click()}>Change photo</button><input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-label="Choose profile photo" accept="image/jpeg,image/png,image/webp" onChange={event => { setPhoto(event.target.files?.[0] ?? null); setSaved(""); }} /><p>{photo ? `Selected: ${photo.name}` : "JPG, PNG or WebP · up to 8 MB"}</p></div></div>
        <label className="form-field"><span>Display name</span><input required minLength={2} maxLength={80} autoComplete="nickname" value={name} onChange={event => { setName(event.target.value); setSaved(""); }} /></label>
        <div><h2 className={styles.sectionTitle}>Marketplace location</h2><p className="mt-2 mb-4 text-xs leading-6 text-[var(--takeme-gray)]">Your general area is public. Leave both fields empty to remove it.</p><div className={styles.twoColumns}><label className="form-field"><span>District / City</span><input maxLength={60} autoComplete="address-level2" placeholder="e.g. Jitra" value={city} onChange={event => { setCity(event.target.value); setSaved(""); }} /></label><label className="form-field"><span>State</span><select value={state} onChange={event => { setState(event.target.value); setSaved(""); }}><option value="">Select state</option>{MALAYSIAN_STATES.map(item => <option key={item}>{item}</option>)}</select></label></div></div>
        <div className={styles.notice}><ShieldCheck size={19} /><span>Use only your district or city and state. Keep your street address in Private address.</span></div>
        <button ref={saveButton} type="submit" className="button-primary min-h-12 px-5">{busy ? "Saving…" : "Save changes"}</button>
      </fieldset>
    </form>
  </>;
}
