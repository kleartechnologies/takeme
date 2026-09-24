import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase/client";

export interface ConversationSummary {
  id: string; listingId: string; listingTitle: string; listingImage: string | null;
  buyerId: string; sellerId: string; otherId: string; otherName: string;
  transactionId: string | null; status: string; latestMessage: string | null;
  lastMessageAt: string | null; updatedAt: string | null; unreadCount?: number;
}
export interface ConversationMessage { id: string; senderId: string; body: string; createdAt: string | null }
export interface Page<T> { items: T[]; cursor: string | null; hasMore: boolean }

async function invoke<T>(name: string, data: Record<string, unknown>): Promise<T> {
  if (!functions || !auth?.currentUser) throw new Error("Sign in to use messages.");
  return (await httpsCallable<Record<string, unknown>, T>(functions, name)(data)).data;
}
export const openListingConversation = (listingId: string) => invoke<{ conversationId: string }>("openListingConversation", { listingId }).then((value) => value.conversationId);
export const openTransactionConversation = (transactionId: string) => invoke<{ conversationId: string }>("openTransactionConversation", { transactionId }).then((value) => value.conversationId);
export const getConversation = (conversationId: string) => invoke<{ conversation: ConversationSummary }>("getConversation", { conversationId }).then((value) => value.conversation);
export const getConversations = (cursor?: string | null) => invoke<Page<ConversationSummary>>("getConversations", { cursor });
export const getConversationMessages = (conversationId: string, cursor?: string | null) => invoke<Page<ConversationMessage>>("getConversationMessages", { conversationId, cursor });
export const sendConversationMessage = (conversationId: string, body: string) => invoke<{ messageId: string }>("sendConversationMessage", { conversationId, body });
export const markConversationSeen = (conversationId: string) => invoke<{ seen: boolean }>("markConversationSeen", { conversationId });
