"use client";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { MessagesInbox } from "./messages-inbox";
import styles from "./messaging.module.css";

export function MessagingShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user } = useAuth();
  return <main key={user?.uid ?? "anonymous"} className={`${styles.shell} ${path === "/messages" ? styles.inboxRoute : styles.chatRoute}`}><aside className={styles.inboxPanel} aria-label="Your conversations"><MessagesInbox activeId={path.split("/")[2]} /></aside><div className={styles.chatPanel}>{children}</div></main>;
}
