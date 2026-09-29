// Explicit-ID, dry-run-first utility. Never infer a city from an arbitrary address.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const projectId = "takeme-52b80";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const approval = args.find((item) => item.startsWith("--approve="))?.slice(10);
const mappings = args.filter((item) => item.startsWith("--map=")).map((item) => item.slice(6).split("|"));
if (!mappings.length || mappings.length > 10 || mappings.some((parts) => parts.length !== 3 || !/^[A-Za-z0-9_-]{1,128}$/.test(parts[0]))) {
  throw new Error("Supply 1–10 explicit --map='listingId|DistrictOrCity|State' arguments.");
}
if (apply && approval !== projectId) throw new Error("Apply requires --approve=takeme-52b80 and separate production authorization.");
const states = new Set(["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah", "Sarawak", "Selangor", "Terengganu", "W.P. Kuala Lumpur", "W.P. Labuan", "W.P. Putrajaya"]);
for (const [, city, state] of mappings) if (!/^[\p{L} .'-]{2,60}$/u.test(city.trim()) || /\b(jalan|jln|lorong|taman|unit|lot|apartment)\b/i.test(city) || !states.has(state.trim())) throw new Error("Every mapping must provide a safe general district/city and Malaysian state.");

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const precise = ["latitude", "longitude", "address", "fullAddress", "street", "unitNumber", "privateAddress", "exactAddress"];
function facets(data, location) {
  const values = [data.categoryId, data.condition, data.listingType, location.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ")];
  return Array.from({ length: 16 }, (_, mask) => values.map((value, index) => mask & (1 << index) ? value : "*").join("|"));
}
for (const [id, rawCity, rawState] of mappings) {
  const city = rawCity.trim(), state = rawState.trim();
  const ref = db.doc(`listings/${id}`);
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!data) { console.log(`${id}: NOT_FOUND`); continue; }
  if (data.status !== "draft") { console.log(`${id}: SKIP_NOT_DRAFT`); continue; }
  const location = `${city}, ${state}`;
  const alreadySafe = data.privacyVersion === 2 && data.location === location
    && data.publicLocation?.districtOrCity === city && data.publicLocation?.state === state
    && data.publicLocation?.country === "Malaysia" && !precise.some((field) => field in data);
  if (alreadySafe) { console.log(`${id}: ALREADY_SAFE`); continue; }
  if (typeof data.location !== "string" || !data.location.trim()) { console.log(`${id}: NEEDS_SELLER_CORRECTION`); continue; }
  if (!data.location.toLowerCase().includes(city.toLowerCase()) || !data.location.toLowerCase().includes(state.toLowerCase())) { console.log(`${id}: MAPPING_NOT_VERIFIED`); continue; }
  console.log(`${id}: ${apply ? "APPLY" : "DRY_RUN"} legacy location [redacted] -> ${location}; remove ${precise.filter((field) => field in data).join(",") || "no precise fields"}`);
  if (!apply) continue;
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data();
    if (!current || current.status !== "draft" || current.location !== data.location) throw new Error(`${id}: changed since dry-run; stopped`);
    tx.update(ref, {
      publicLocation: { districtOrCity: city, state, country: "Malaysia" }, location,
      privacyVersion: 2, locationKey: location.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " "),
      facetKeys: facets(current, location), meetupLocationId: null, meetupLocation: null,
      ...Object.fromEntries(precise.filter((field) => field in current).map((field) => [field, FieldValue.delete()])),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
