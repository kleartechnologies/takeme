"use client";

import { MapPin, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { MALAYSIAN_STATES } from "@/lib/general-location";
import { deleteMeetupLocation, getPrivateAddress, listMeetupLocations, saveMeetupLocation, savePrivateAddress, setDefaultMeetupLocation, type MeetupLocation, type PrivateAddress } from "@/lib/services/locations";

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

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getPrivateAddress(), listMeetupLocations()]).then(([savedAddress, savedMeetups]) => {
      if (active) { setAddress(savedAddress ?? emptyAddress); setMeetups(savedMeetups); }
    }).catch(() => { if (active) setMessage("Locations could not be loaded. Try refreshing this page."); });
    return () => { active = false; };
  }, [user]);

  if (!configured) return <FirebaseSetupState />;
  if (loading) return <div className="min-h-64 animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <SignInRequired message="Sign in to manage your private address and meet-up locations." next="/profile/locations" />;

  async function saveAddress(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await savePrivateAddress(address); setMessage("Private address saved. It is never copied into listings."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save your address."); }
    finally { setBusy(false); }
  }
  async function saveMeetup(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await saveMeetupLocation({ ...form, country: "Malaysia" }, editingId ?? undefined);
      setMeetups(await listMeetupLocations()); setForm(emptyMeetup); setEditingId(null); setMessage("Meet-up location saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this meet-up location."); }
    finally { setBusy(false); }
  }
  async function changeMeetup(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); setMeetups(await listMeetupLocations()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update meet-up locations."); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-2xl space-y-7 pb-24">
    <Link href="/profile" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--takeme-dark-green)]">← Back to profile</Link>
    <div><h1 className="page-title">Addresses &amp; Meetup Locations</h1><p className="mt-2 text-sm text-[var(--takeme-gray)]">Keep your private address separate from places you choose to show buyers.</p></div>
    {message && <p role="status" className="rounded-xl bg-stone-100 p-3 text-sm">{message}</p>}
    <form onSubmit={(event) => void saveAddress(event)} className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-bold">Private address</h2>
      <p className="mt-1 text-sm text-[var(--takeme-gray)]">For private account information only. Your full address is never shown on listings or copied to meet-up locations.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="form-field sm:col-span-2"><span>Address line 1</span><input autoComplete="street-address" value={address.addressLine1} maxLength={160} onChange={(event) => setAddress({ ...address, addressLine1: event.target.value })} /></label>
        <label className="form-field sm:col-span-2"><span>Address line 2 (optional)</span><input value={address.addressLine2} maxLength={160} onChange={(event) => setAddress({ ...address, addressLine2: event.target.value })} /></label>
        <label className="form-field"><span>Postcode</span><input inputMode="numeric" value={address.postcode} maxLength={5} onChange={(event) => setAddress({ ...address, postcode: event.target.value })} /></label>
        <label className="form-field"><span>City</span><input value={address.city} maxLength={80} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label>
        <label className="form-field"><span>State</span><select value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })}><option value="">Select state</option>{MALAYSIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
        <p className="self-end pb-3 text-sm text-[var(--takeme-gray)]">Malaysia</p>
      </div>
      <button type="submit" disabled={busy} className="button-secondary mt-5 min-h-11 px-5">Save private address</button>
    </form>
    <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-bold">Meet-up locations</h2>
      <p className="mt-1 text-sm text-[var(--takeme-gray)]">Removing a saved place won’t change existing listings that use it. Edit those listings separately.</p>
      <p className="mt-1 text-sm text-[var(--takeme-gray)]">Only places you explicitly save and select for a listing can be shown to buyers. Your private address is never selected automatically.</p>
      <ul className="mt-5 space-y-3">{meetups.map((item) => <li key={item.id} className="rounded-2xl border border-gray-200 p-4"><div className="flex items-start gap-3"><MapPin size={19} className="mt-1 shrink-0 text-[var(--takeme-dark-green)]" /><div className="min-w-0 flex-1"><p className="font-semibold">{item.name} {item.isDefault && <span className="text-xs font-normal text-[var(--takeme-dark-green)]">· Default</span>}</p><p className="text-sm text-[var(--takeme-gray)]">{item.area}, {item.state}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} className="button-secondary min-h-11 px-3 text-xs" onClick={() => { setEditingId(item.id); setForm({ name: item.name, area: item.area, state: item.state }); }}>Edit</button>{!item.isDefault && <button type="button" disabled={busy} className="button-secondary min-h-11 px-3 text-xs" onClick={() => void changeMeetup(() => setDefaultMeetupLocation(item.id))}>Set default</button>}<button type="button" disabled={busy} className="button-secondary min-h-11 px-3 text-xs" onClick={() => void changeMeetup(() => deleteMeetupLocation(item.id))}><Trash2 size={15} /> Remove</button></div></li>)}</ul>
      {!meetups.length && <p className="mt-4 text-sm text-[var(--takeme-gray)]">No meet-up locations saved yet.</p>}
      <form onSubmit={(event) => void saveMeetup(event)} className="mt-6 space-y-3 border-t border-gray-100 pt-5">
        <h3 className="flex items-center gap-2 font-bold"><Plus size={18} /> {editingId ? "Edit meet-up location" : "Add meet-up location"}</h3>
        <label className="form-field"><span>Public place name</span><input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. a café or mall you choose" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="form-field"><span>District / City</span><input required maxLength={60} value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} placeholder="e.g. Jitra" /></label><label className="form-field"><span>State</span><select required value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })}><option value="">Select state</option>{MALAYSIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></label></div>
        <div className="flex gap-2"><button type="submit" disabled={busy} className="button-primary min-h-11 px-5">{editingId ? "Save changes" : "Add location"}</button>{editingId && <button type="button" className="button-secondary min-h-11 px-4" onClick={() => { setEditingId(null); setForm(emptyMeetup); }}>Cancel</button>}</div>
      </form>
    </section>
  </div>;
}
