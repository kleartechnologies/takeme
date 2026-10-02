import { ConversationView } from "@/components/messages/conversation-view";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Conversation", robots: { index: false, follow: false } };
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConversationView id={id} />;
}
