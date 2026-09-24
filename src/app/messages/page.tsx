import type { Metadata } from "next";
import { MessagesInbox } from "@/components/messages/messages-inbox";
export const metadata: Metadata = { title: "Messages", robots: { index: false, follow: false } };
export default function MessagesPage() { return <main className="page-shell py-6 md:py-10"><MessagesInbox /></main>; }
