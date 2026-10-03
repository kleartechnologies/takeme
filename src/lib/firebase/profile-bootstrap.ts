import { doc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import { newPublicProfileFields } from "./profile-name.ts";

type ProfileIdentity = { uid: string; displayName: string | null; photoURL: string | null };

export async function createProfileIfMissing(database: Firestore, user: ProfileIdentity, chosenName?: string) {
  const fields = newPublicProfileFields(user, chosenName);
  const profileRef = doc(database, "users", user.uid);
  return runTransaction(database, async (transaction) => {
    const lifecycle = await transaction.get(doc(database, "accountLifecycles", user.uid));
    if (lifecycle.exists()) return false;
    if ((await transaction.get(profileRef)).exists()) return false;
    transaction.set(profileRef, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return true;
  });
}
