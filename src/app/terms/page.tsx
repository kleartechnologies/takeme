import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/settings/settings.module.css";
export const metadata: Metadata = { title: "Terms of Service status", robots: { index: false, follow: false } };
export default function Page() { return <main className={styles.legal}><Link className={styles.link} href="/profile/settings">← Settings</Link><h1>TAKEME Terms of Service</h1><p>The Terms of Service has not yet been published. This page is a placeholder and contains no legal policy or agreement.</p><p className="mt-4">An approved public policy is required before launch.</p><Link className={styles.link} href="/account-deletion">Read account deletion information</Link></main>; }
