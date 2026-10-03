"use client";

import { ArrowLeft, Bell, ChevronRight, CircleHelp, FileText, Home, LockKeyhole, MapPin, ShieldCheck, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/components/auth/auth-provider";
import { db } from "@/lib/firebase/client";
import styles from "./settings.module.css";

const navigation = [
  { label: "Overview", href: "/profile/settings", icon: Home, group: "Account" },
  { label: "Edit profile", href: "/profile/settings/edit", icon: UserRound },
  { label: "Addresses & meet-up", href: "/profile/locations", icon: MapPin },
  { label: "Notifications", href: "/notification-preferences", icon: Bell, group: "Preferences" },
  { label: "Privacy", href: "/profile/settings/privacy", icon: LockKeyhole, group: "Privacy & safety" },
  { label: "Security", href: "/profile/settings/security", icon: ShieldCheck },
  { label: "Safety", href: "/profile/settings/safety", icon: ShieldCheck },
  { label: "Help Centre", href: "/profile/settings/help", icon: CircleHelp, group: "Support" },
  { label: "Terms draft", href: "/terms", icon: FileText, group: "Legal · drafts" },
  { label: "Privacy Policy draft", href: "/privacy", icon: FileText },
  { label: "Delete account", href: "/account-deletion", icon: Trash2, group: "Account actions" },
];

export function SettingsRow({ href, icon, children, danger = false }: { href: string; icon: ReactNode; children: ReactNode; danger?: boolean }) {
  return <Link href={href} className={`${styles.row} ${danger ? styles.danger : ""}`}>{icon}<span>{children}</span><ChevronRight size={17} aria-hidden="true" /></Link>;
}

export function SettingsShell({ title, children }: { title: string; children: ReactNode }) {
  const { user, loading, configured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [lifecycle, setLifecycle] = useState<{ uid: string; pending: boolean; error: boolean } | null>(null);
  useEffect(() => {
    if (!loading && configured && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, configured, user, pathname, router]);
  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(doc(db, "accountLifecycles", user.uid), snapshot => {
      const pending = snapshot.data()?.state === "deletion_pending";
      setLifecycle({ uid: user.uid, pending, error: false });
      if (pending) router.replace("/account-deletion");
    }, () => setLifecycle({ uid: user.uid, pending: false, error: true }));
  }, [user, router]);
  const ready = user && lifecycle?.uid === user.uid && !lifecycle.pending && !lifecycle.error;
  const overview = pathname === "/profile/settings";
  return <main className={styles.shell}>
    <header className={styles.header}><Link href={overview ? "/profile" : "/profile/settings"} aria-label={overview ? "Back to your profile" : "Back to Settings"} className={styles.back}><ArrowLeft size={21} /></Link><h1>{title}</h1></header>
    {!configured ? <p role="alert">Account settings are temporarily unavailable.</p> : !ready ? <p role={lifecycle?.uid === user?.uid && lifecycle?.error ? "alert" : "status"}>{lifecycle?.uid === user?.uid && lifecycle?.error ? "Account status could not be checked. Refresh to try again." : "Loading your account…"}</p> : <div className={styles.layout}>
      <nav className={styles.sidebar} aria-label="Settings navigation">{navigation.map(({ label, href, icon: Icon, group }) => <div key={href}>{group && <p className={styles.sidebarLabel}>{group}</p>}<Link className={styles.navLink} href={href} aria-current={pathname === href ? "page" : undefined}><Icon size={17} />{label}</Link></div>)}</nav>
      <div className={styles.content} key={user.uid}>{children}</div>
    </div>}
  </main>;
}
