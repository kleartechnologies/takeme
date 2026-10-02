import { ConversationView } from "@/components/messages/conversation-view";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Conversation", robots: { index: false, follow: false } };
export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ offer?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  return <ConversationView id={id} makeOffer={query.offer === "1"} />;
}
