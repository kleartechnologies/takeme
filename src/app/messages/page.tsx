import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import styles from "@/components/messages/messaging.module.css";
export const metadata: Metadata = { title: "Messages", robots: { index: false, follow: false } };
export default function MessagesPage() { return <div className={styles.empty}><MessageSquare size={36} className="text-[var(--takeme-dark-green)] mb-4" /><h2>A conversation starts with an item</h2><p>Choose a conversation to view messages, offers and deal details.</p></div>; }
