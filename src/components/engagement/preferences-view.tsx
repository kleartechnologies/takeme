"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { getNotificationPreferences, setNotificationPreference, type Frequency } from "@/lib/services/engagement";
import styles from "@/components/settings/settings.module.css";

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
  const controls = useRef<Record<string, HTMLSelectElement | null>>({});
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => { if (!user) return; let active = true; getNotificationPreferences().then((data) => { if (active) { setPreferences(data.preferences); setLoaded(true); setError(""); setLoading(false); } }).catch(() => { if (active) { setError("Preferences could not be loaded. Try again before making changes."); setLoading(false); } }); return () => { active = false; }; }, [user, revision]);
  async function change(type: string, frequency: Frequency) { setBusy(type); setError(""); setMessage(""); try { await setNotificationPreference(type, frequency); setPreferences((current) => ({ ...current, [type]: frequency })); setMessage("Notification preference saved."); } catch { setError("Could not confirm this preference was saved. Refresh to check its current setting."); } finally { setBusy(""); requestAnimationFrame(() => controls.current[type]?.focus()); } }
  if (!configured) return <FirebaseSetupState />;
  if (authLoading || loading && user) return <div className="h-40 animate-pulse rounded-2xl bg-stone-100" />;
  if (!user) return <SignInRequired message="Log in to manage notification preferences." next="/notification-preferences" />;
  return <div><p className={styles.intro}>Choose which optional alerts appear in Updates. Preferences save as you change them.</p>{message && <p role="status" className={styles.status}>{message}</p>}{error && <p role="alert" className={`${styles.status} ${styles.error}`}>{error}</p>}{!loaded && <button className={styles.textButton} onClick={() => setRevision(value => value + 1)}>Try again</button>}{sections.map((section) => <section key={section.title} className={styles.card}><h2>{section.title}</h2>{section.items.map(([type, label]) => <label key={type} className={styles.preferenceRow}><span>{label}</span><select ref={element => { controls.current[type] = element; }} disabled={Boolean(busy) || !loaded} value={preferences[type] ?? "instant"} onChange={(event) => void change(type, event.target.value as Frequency)}><option value="instant">In-app</option>{preferences[type] === "daily" && <option value="daily" disabled>Daily unavailable</option>}<option value="off">Off</option></select></label>)}</section>)}<section className={styles.card}><h2>Essential updates stay on</h2><p>Offers, transactions, disputes and auction wins appear in Updates and cannot be turned off here.</p><p>Push, email, SMS and daily digest delivery are not available.</p></section></div>;
}
