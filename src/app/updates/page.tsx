import type { Metadata } from "next";
import { NotificationsCenter } from "@/components/updates/notifications-center";
import styles from "@/components/updates/updates.module.css";

export const metadata: Metadata = { title: "Updates", description: "Your marketplace messages, offers, auctions and activity.", robots: { index: false, follow: false } };

export default function UpdatesPage() {
  return <main className={styles.page}><NotificationsCenter /></main>;
}
