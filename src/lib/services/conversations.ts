import { collection, doc, getDoc, limit, orderBy, query, serverTimestamp, setDoc, getDocs, startAfter, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

function requireConversationServices() {
  if (!db || !auth?.currentUser) throw new Error("Sign in to use conversations.");
  return { database: db, uid: auth.currentUser.uid };
}

export async function openListingConversation(listingId: string) {
  const { database, uid } = requireConversationServices();
  const listing = await getDoc(doc(database, "listings", listingId));
  if (!listing.exists() || listing.data().status !== "active") throw new Error("This listing is unavailable.");
  const sellerId = listing.data().sellerId as string;
  if (sellerId === uid) throw new Error("You cannot message yourself about your listing.");
  const id = `${listingId}_${uid}`;
  const reference = doc(database, "conversations", id);
  try { if ((await getDoc(reference)).exists()) return id; }
  catch (error) {
    if (!(typeof error === "object" && error && "code" in error && String(error.code).includes("permission-denied"))) throw error;
    // A missing conversation is not readable yet under participant-only rules.
  }
  await setDoc(reference, { id, listingId, buyerId: uid, sellerId, participants: [uid, sellerId], latestMessage: null, unreadBy: { [uid]: 0, [sellerId]: 0 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return id;
}

export async function sendConversationMessage(conversationId: string, body: string) {
  const { database, uid } = requireConversationServices();
  const text = body.trim();
  if (!text || text.length > 2000) throw new Error("Message must be 1–2000 characters.");
  const reference = doc(collection(database, "conversations", conversationId, "messages"));
  await setDoc(reference, { id: reference.id, senderId: uid, body: text, createdAt: serverTimestamp() });
  return reference.id;
}

export async function getConversationMessages(conversationId: string, cursor?: QueryDocumentSnapshot<DocumentData> | null) {
  const { database } = requireConversationServices();
  const constraints = [orderBy("createdAt", "desc"), ...(cursor ? [startAfter(cursor)] : []), limit(21)];
  const result = await getDocs(query(collection(database, "conversations", conversationId, "messages"), ...constraints));
  return { messages: result.docs.slice(0, 20).map((item) => ({ id: item.id, ...item.data() })), cursor: result.docs[19] ?? null, hasMore: result.size > 20 };
}
