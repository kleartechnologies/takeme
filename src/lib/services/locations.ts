import { withEligibilityHandling } from "@/lib/services/marketplace-call";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { MALAYSIAN_STATES, makePublicLocation } from "@/lib/general-location";

export type PrivateAddress = {
  addressLine1: string; addressLine2: string; postcode: string; city: string; state: string; country: "Malaysia";
};
export type MeetupLocation = { id: string; name: string; area: string; state: string; country: "Malaysia"; isDefault: boolean };

function owner() {
  if (!db || !auth?.currentUser) throw new Error("Sign in to manage your locations.");
  return { database: db, uid: auth.currentUser.uid };
}

export async function getPrivateAddress(): Promise<PrivateAddress | null> {
  const { database, uid } = owner();
  const snapshot = await getDoc(doc(database, "privateUserAddresses", uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return { addressLine1: data.addressLine1 ?? "", addressLine2: data.addressLine2 ?? "", postcode: data.postcode ?? "", city: data.city ?? "", state: data.state ?? "", country: "Malaysia" };
}

export async function savePrivateAddress(input: PrivateAddress) {
  const { database, uid } = owner();
  const addressLine1 = input.addressLine1.trim(), addressLine2 = input.addressLine2.trim();
  const postcode = input.postcode.trim(), city = input.city.trim(), state = input.state.trim();
  if (!addressLine1 || addressLine1.length > 160 || addressLine2.length > 160 || !/^\d{5}$/.test(postcode) || city.length < 2 || city.length > 80 || !MALAYSIAN_STATES.includes(state as (typeof MALAYSIAN_STATES)[number])) throw new Error("Complete a valid Malaysian address before saving.");
  await withEligibilityHandling(() => setDoc(doc(database, "privateUserAddresses", uid), { uid, addressLine1, addressLine2, postcode, city, state, country: "Malaysia", updatedAt: serverTimestamp() }));
}

export async function listMeetupLocations(): Promise<MeetupLocation[]> {
  const { database, uid } = owner();
  const snapshot = await getDocs(query(collection(database, "users", uid, "meetupLocations"), limit(20)));
  return snapshot.docs.map((item) => ({ id: item.id, name: String(item.data().name ?? ""), area: String(item.data().area ?? ""), state: String(item.data().state ?? ""), country: "Malaysia" as const, isDefault: item.data().isDefault === true })).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
}

export async function saveMeetupLocation(input: Omit<MeetupLocation, "id" | "isDefault">, id?: string) {
  const { database, uid } = owner();
  const name = input.name.trim();
  const location = makePublicLocation(input.area, input.state);
  if (name.length < 2 || name.length > 80 || !location) throw new Error("Add a place name, district or city, and Malaysian state.");
  if (!id && (await listMeetupLocations()).length >= 20) throw new Error("You can save up to 20 meet-up locations.");
  const record = { ownerId: uid, name, area: location.districtOrCity, state: location.state, country: "Malaysia" as const, updatedAt: serverTimestamp() };
  if (id) await withEligibilityHandling(() => updateDoc(doc(database, "users", uid, "meetupLocations", id), record));
  else await withEligibilityHandling(() => setDoc(doc(collection(database, "users", uid, "meetupLocations")), { ...record, isDefault: false, createdAt: serverTimestamp() }));
}

export async function deleteMeetupLocation(id: string) {
  const { database, uid } = owner();
  await withEligibilityHandling(() => deleteDoc(doc(database, "users", uid, "meetupLocations", id)));
}

export async function setDefaultMeetupLocation(id: string) {
  const { database, uid } = owner();
  const locations = await listMeetupLocations();
  if (!locations.some((item) => item.id === id)) throw new Error("Meet-up location not found.");
  const batch = writeBatch(database);
  for (const item of locations) batch.update(doc(database, "users", uid, "meetupLocations", item.id), { isDefault: item.id === id, updatedAt: serverTimestamp() });
  await withEligibilityHandling(() => batch.commit());
}
