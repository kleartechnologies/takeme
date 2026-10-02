import type { Metadata } from "next";
import { MessagingShell } from "@/components/messages/messaging-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <MessagingShell>{children}</MessagingShell>;
}
