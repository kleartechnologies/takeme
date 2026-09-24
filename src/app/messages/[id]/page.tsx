import { ConversationView } from "@/components/messages/conversation-view";
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="page-shell py-6 md:py-10"><ConversationView id={id} /></main>;
}
