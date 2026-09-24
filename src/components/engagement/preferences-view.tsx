"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { ErrorState } from "@/components/ui/states";
import { getNotificationPreferences, setNotificationPreference, type Frequency } from "@/lib/services/engagement";

const sections = [
  { title: "Marketplace", items: [["saved_price_drop", "Saved item price drops"], ["saved_unavailable", "Saved item availability"], ["new_matching_listing", "New saved-search matches"]] },
  { title: "Sellers", items: [["followed_seller_listing", "New listings from followed sellers"]] },
  { title: "Auctions", items: [["auction_ending", "Saved auctions ending soon"], ["outbid", "Outbid alerts"], ["auction_lost", "Auction results when you did not win"]] },
  { title: "Messages", items: [["message_received", "New marketplace messages"]] },
] as const;

export function PreferencesView() {
  const { user, loading: authLoading, configured } = useAuth();
  const [preferences, setPreferences] = useState<Record<string, Frequency>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (!user) return; let active = true; getNotificationPreferences().then((data) => { if (active) { setPreferences(data.preferences); setLoading(false); } }).catch(() => { if (active) { setError("Preferences could not be loaded."); setLoading(false); } }); return () => { active = false; }; }, [user]);
  async function change(type: string, frequency: Frequency) { setBusy(type); setError(""); try { await setNotificationPreference(type, frequency); setPreferences((current) => ({ ...current, [type]: frequency })); } catch { setError("Preference could not be saved."); } finally { setBusy(""); } }
  if (!configured) return <FirebaseSetupState />;
  if (authLoading || loading && user) return <div className="h-40 animate-pulse rounded-2xl bg-stone-100" />;
  if (!user) return <SignInRequired message="Log in to manage notification preferences." />;
  return <div><p className="mb-5 text-sm leading-6 text-[var(--takeme-gray)]">In-app alerts are available now. Daily digest delivery, push and email are not configured. Essential transaction and auction-win updates remain on so you can follow your marketplace activity.</p>{error && <div role="alert"><ErrorState message={error} /></div>}{sections.map((section) => <section key={section.title} className="mb-4 rounded-2xl border border-gray-200 bg-white p-4"><h2 className="mb-3 font-bold">{section.title}</h2><div className="grid gap-3">{section.items.map(([type, label]) => <label key={type} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{label}</span><select disabled={busy === type} value={preferences[type] ?? "instant"} onChange={(event) => void change(type, event.target.value as Frequency)} className="min-h-11 rounded-xl border border-gray-300 px-3"><option value="instant">In-app</option><option value="daily" disabled>Daily — not available yet</option><option value="off">Off</option></select></label>)}</div></section>)}<section className="rounded-2xl border border-gray-200 bg-white p-4"><h2 className="font-bold">Essential updates</h2><p className="mt-2 text-sm text-[var(--takeme-gray)]">Offers, transactions, disputes and auction wins appear in Updates and cannot be turned off here.</p></section></div>;
}
