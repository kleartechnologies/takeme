"use client";

import { Bell, CircleHelp, FileText, LockKeyhole, LogOut, MapPin, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { logout } from "@/lib/firebase/auth";
import { getUserProfile } from "@/lib/services/users";
import type { UserProfile } from "@/types/marketplace";
import { ProfileAvatar } from "./profile-ui";
import { SettingsRow } from "@/components/settings/settings-shell";
import styles from "@/components/settings/settings.module.css";

export function AccountSettings() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    let active = true;
    getUserProfile(user.uid).then(value => { if (active) setProfile(value); }).catch(() => { if (active) setError("Profile could not be loaded."); });
    return () => { active = false; };
  }, [user]);
  async function signOut() {
    setBusy(true); setError("");
    try { await logout(); router.replace("/login"); }
    catch { setError("Could not log out. Please try again."); setBusy(false); }
  }
  return <>
    {profile && profile.uid === user?.uid && <div className={styles.identity}><ProfileAvatar photo={profile.photoURL} size={48} /><div><strong>{profile.displayName}</strong><p>Your account, your preferences.</p></div></div>}
    {error && <p role="alert" className={`${styles.status} ${styles.error}`}>{error}</p>}
    <section className={styles.group}><h2 className={styles.groupTitle}>Account</h2><div className={styles.rows}><SettingsRow href="/profile/settings/edit" icon={<UserRound />}>Edit profile</SettingsRow><SettingsRow href="/profile/locations" icon={<MapPin />}>Addresses &amp; meet-up locations</SettingsRow></div></section>
    <section className={styles.group}><h2 className={styles.groupTitle}>Preferences</h2><div className={styles.rows}><SettingsRow href="/notification-preferences" icon={<Bell />}>Notifications</SettingsRow></div></section>
    <section className={styles.group}><h2 className={styles.groupTitle}>Privacy &amp; safety</h2><div className={styles.rows}><SettingsRow href="/profile/settings/privacy" icon={<LockKeyhole />}>Privacy</SettingsRow><SettingsRow href="/profile/settings/security" icon={<ShieldCheck />}>Security</SettingsRow><SettingsRow href="/profile/settings/safety" icon={<ShieldCheck />}>Safety</SettingsRow></div></section>
    <section className={styles.group}><h2 className={styles.groupTitle}>Support</h2><div className={styles.rows}><SettingsRow href="/profile/settings/help" icon={<CircleHelp />}>Help Centre</SettingsRow></div></section>
    <section className={styles.group}><h2 className={styles.groupTitle}>Legal · policies not yet published</h2><div className={styles.rows}><SettingsRow href="/terms" icon={<FileText />}>Terms of Service status</SettingsRow><SettingsRow href="/privacy-policy" icon={<FileText />}>Privacy Policy status</SettingsRow></div></section>
    <section className={styles.group}><h2 className={styles.groupTitle}>Account actions</h2><div className={styles.rows}><SettingsRow href="/account-deletion" icon={<Trash2 />} danger>Delete account</SettingsRow><button disabled={busy} onClick={() => void signOut()} className={styles.row}><LogOut size={19} aria-hidden="true" /><span>{busy ? "Logging out…" : "Logout"}</span></button></div></section>
  </>;
}
