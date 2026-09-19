"use client";

import { LoaderCircle, Pencil } from "lucide-react";
import { type FormEvent, useState } from "react";
import { updatePublicProfile } from "@/lib/services/users";
import type { UserProfile } from "@/types/marketplace";

export function EditProfile({ profile, onSaved }: { profile: UserProfile; onSaved: (profile: UserProfile) => void }) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [location, setLocation] = useState(profile.location);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await updatePublicProfile({ displayName, location, photo }); onSaved(result); setPhoto(null); setEditing(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Profile could not be saved."); }
    finally { setBusy(false); }
  }

  if (!editing) return <button type="button" onClick={() => setEditing(true)} className="button-secondary mt-5 min-h-11 px-4"><Pencil size={16} /> Edit public profile</button>;
  return <form onSubmit={(event) => void submit(event)} className="mt-5 max-w-xl space-y-4 rounded-2xl border border-gray-200 bg-stone-50 p-4"><h2 className="font-bold">Edit public profile</h2><label className="block text-sm font-semibold">Display name<input required minLength={2} maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 font-normal" /></label><label className="block text-sm font-semibold">General location<input maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Kuala Lumpur" className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 font-normal" /></label><label className="block text-sm font-semibold">Profile photo (JPG, PNG or WebP, max 8 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm font-normal file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-white file:px-3" /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex gap-2"><button type="submit" disabled={busy} className="button-primary min-h-11 px-5">{busy && <LoaderCircle size={17} className="animate-spin" />} Save profile</button><button type="button" disabled={busy} onClick={() => { setEditing(false); setError(""); }} className="button-secondary min-h-11 px-5">Cancel</button></div></form>;
}
