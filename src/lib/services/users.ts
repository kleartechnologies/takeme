import { Timestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { UserProfile } from "@/types/marketplace";

function toIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) throw new Error("Firebase is not configured. Add the required environment variables first.");
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return { uid: snapshot.id, displayName: data.displayName || "TAKEME member", photoURL: data.photoURL || null, location: data.location || "", createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt) };
}
