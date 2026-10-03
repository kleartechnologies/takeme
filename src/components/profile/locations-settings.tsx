"use client";

import { LockKeyhole, MapPin, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { MALAYSIAN_STATES } from "@/lib/general-location";
import { deleteMeetupLocation, getPrivateAddress, listMeetupLocations, saveMeetupLocation, savePrivateAddress, setDefaultMeetupLocation, type MeetupLocation, type PrivateAddress } from "@/lib/services/locations";
import styles from "@/components/settings/settings.module.css";

const emptyAddress: PrivateAddress = { addressLine1: "", addressLine2: "", postcode: "", city: "", state: "", country: "Malaysia" };
type MeetupForm = { name: string; area: string; state: string };
const emptyMeetup: MeetupForm = { name: "", area: "", state: "" };

export function LocationsSettings() {
  const { user, loading, configured } = useAuth();
  const [address, setAddress] = useState<PrivateAddress>(emptyAddress);
  const [meetups, setMeetups] = useState<MeetupLocation[]>([]);
  const [form, setForm] = useState<MeetupForm>(emptyMeetup);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [addressOpen, setAddressOpen] = useState(false);
  const [meetupOpen, setMeetupOpen] = useState(false);
  const [savedAddress, setSavedAddress] = useState<PrivateAddress | null>(null);
  const addressButton = useRef<HTMLButtonElement>(null);
  const meetupButton = useRef<HTMLButtonElement>(null);
  const addressHeading = useRef<HTMLHeadingElement>(null);
  const meetupHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getPrivateAddress(), listMeetupLocations()]).then(([savedAddress, savedMeetups]) => {
      if (active) { setAddress(savedAddress ?? emptyAddress); setSavedAddress(savedAddress); setMeetups(savedMeetups); setLoaded(true); setError(""); }
    }).catch(() => { if (active) setError("Locations could not be loaded. Try again before editing."); });
    return () => { active = false; };
  }, [user, revision]);
  useEffect(() => { if (addressOpen) addressHeading.current?.focus(); }, [addressOpen]);
  useEffect(() => { if (meetupOpen) meetupHeading.current?.focus(); }, [meetupOpen, editingId]);

  if (!configured) return <FirebaseSetupState />;
  if (loading) return <div className="min-h-64 animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <SignInRequired message="Sign in to manage your private address and meet-up locations." next="/profile/locations" />;

  async function saveAddress(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try { await savePrivateAddress(address); setSavedAddress(await getPrivateAddress()); setAddressOpen(false); setMessage("Private address saved. It is never copied into listings."); requestAnimationFrame(() => addressButton.current?.focus()); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save your address."); }
    finally { setBusy(false); }
  }
  async function saveMeetup(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      await saveMeetupLocation({ ...form, country: "Malaysia" }, editingId ?? undefined);
      setMeetups(await listMeetupLocations()); setForm(emptyMeetup); setEditingId(null); setMeetupOpen(false); setMessage("Meet-up location saved."); requestAnimationFrame(() => meetupButton.current?.focus());
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save this meet-up location."); }
    finally { setBusy(false); }
  }
  async function changeMeetup(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(""); setError("");
    try { await action(); setMeetups(await listMeetupLocations()); setMessage(success); requestAnimationFrame(() => meetupButton.current?.focus()); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not update meet-up locations."); }
    finally { setBusy(false); }
  }

  if (!loaded) return <>{error ? <><p role="alert" className={`${styles.status} ${styles.error}`}>{error}</p><button className={styles.textButton} onClick={() => setRevision(value => value + 1)}>Try again</button></> : <p role="status" className={styles.intro}>Loading your locations…</p>}</>;
  return <div>
    <p className={styles.intro}>Keep your private address separate from places you choose to show buyers.</p>
    {message && <p role="status" className={styles.status}>{message}</p>}
    {error && <p role="alert" className={`${styles.status} ${styles.error}`}>{error}</p>}
    <section className={styles.card}>
      <div className={styles.addressTop}><LockKeyhole size={19} /><div><h2>Private address</h2><p>{savedAddress ? `${savedAddress.city}, ${savedAddress.state}` : "No private address saved"}</p><span className={styles.badge}>Account-only</span></div><button ref={addressButton} className={styles.textButton} disabled={busy} aria-expanded={addressOpen} aria-controls="private-address-form" onClick={() => { setAddress(savedAddress ?? emptyAddress); setAddressOpen(!addressOpen); }}>{savedAddress ? "Edit" : "Add"}</button></div>
      <p>Your full address is never shown on listings or copied to meet-up locations.</p>
    {addressOpen && <form id="private-address-form" onSubmit={(event) => void saveAddress(event)} className={`${styles.form} mt-5`}><fieldset disabled={busy}>
      <h3 ref={addressHeading} tabIndex={-1} className={styles.sectionTitle}>Edit private address</h3>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="form-field sm:col-span-2"><span>Address line 1</span><input required autoComplete="address-line1" value={address.addressLine1} maxLength={160} onChange={(event) => setAddress({ ...address, addressLine1: event.target.value })} /></label>
        <label className="form-field sm:col-span-2"><span>Address line 2 (optional)</span><input value={address.addressLine2} maxLength={160} onChange={(event) => setAddress({ ...address, addressLine2: event.target.value })} /></label>
        <label className="form-field"><span>Postcode</span><input required pattern="[0-9]{5}" autoComplete="postal-code" inputMode="numeric" value={address.postcode} maxLength={5} onChange={(event) => setAddress({ ...address, postcode: event.target.value })} /></label>
        <label className="form-field"><span>City</span><input required minLength={2} autoComplete="address-level2" value={address.city} maxLength={80} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label>
        <label className="form-field"><span>State</span><select required autoComplete="address-level1" value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })}><option value="">Select state</option>{MALAYSIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
        <p className="self-end pb-3 text-sm text-[var(--takeme-gray)]">Malaysia</p>
      </div>
      <div className={styles.actions}><button type="submit" className="button-primary min-h-11 px-5">{busy ? "Saving…" : "Save private address"}</button><button type="button" className={styles.textButton} onClick={() => { setAddressOpen(false); requestAnimationFrame(() => addressButton.current?.focus()); }}>Cancel</button></div>
    </fieldset></form>}
    </section>
    <section className={styles.card}>
      <h2>Saved meet-up places</h2>
      <p className="mt-1 text-sm text-[var(--takeme-gray)]">Removing a saved place won’t change existing listings that use it. Edit those listings separately.</p>
      <p className="mt-1 text-sm text-[var(--takeme-gray)]">Only places you explicitly save and select for a listing can be shown to buyers. Your private address is never selected automatically.</p>
      <ul className={`${styles.locationList} mt-5`}>{meetups.map((item) => <li key={item.id}><div className={styles.addressTop}><MapPin size={19} /><div><strong>{item.name}</strong><p>{item.area}, {item.state}</p>{item.isDefault && <span className={styles.badge}>Default saved place</span>}</div></div><div className={styles.actions}><button type="button" disabled={busy} className={styles.textButton} aria-label={`Edit ${item.name}`} onClick={() => { setEditingId(item.id); setForm({ name: item.name, area: item.area, state: item.state }); setMeetupOpen(true); }}>Edit</button>{!item.isDefault && <button type="button" disabled={busy} className={styles.textButton} aria-label={`Set ${item.name} as default`} onClick={() => void changeMeetup(() => setDefaultMeetupLocation(item.id), "Default meet-up place updated. Listing selection remains your choice.")}>Set default</button>}<button type="button" disabled={busy} className={`${styles.textButton} ${styles.danger}`} aria-label={`Remove ${item.name}`} onClick={() => void changeMeetup(() => deleteMeetupLocation(item.id), "Saved place removed. Existing listings are unchanged.")}><Trash2 size={14} /> Remove</button></div></li>)}</ul>
      {!meetups.length && <p className="mt-4 text-sm text-[var(--takeme-gray)]">No meet-up locations saved yet.</p>}
      <button type="button" ref={meetupButton} disabled={busy || meetupOpen} onClick={() => { setEditingId(null); setForm(emptyMeetup); setMeetupOpen(true); }} className={`${styles.textButton} mt-3`}><Plus size={16} />Add meet-up place</button>
      {meetupOpen && <form onSubmit={(event) => void saveMeetup(event)} className={`${styles.form} mt-4 border-t border-gray-100 pt-5`}><fieldset disabled={busy}>
        <h3 ref={meetupHeading} tabIndex={-1} className={styles.sectionTitle}>{editingId ? "Edit meet-up location" : "Add meet-up location"}</h3>
        <label className="form-field"><span>Public place name</span><input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. a café or mall you choose" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="form-field"><span>District / City</span><input required maxLength={60} value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} placeholder="e.g. Jitra" /></label><label className="form-field"><span>State</span><select required value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })}><option value="">Select state</option>{MALAYSIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></label></div>
        <div className={styles.actions}><button type="submit" className="button-primary min-h-11 px-5">{busy ? "Saving…" : editingId ? "Save changes" : "Add location"}</button><button type="button" className={styles.textButton} onClick={() => { setMeetupOpen(false); setEditingId(null); setForm(emptyMeetup); requestAnimationFrame(() => meetupButton.current?.focus()); }}>Cancel</button></div>
      </fieldset></form>}
    </section>
  </div>;
}
