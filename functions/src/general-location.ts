export type PublicLocation = { districtOrCity: string; state: string; country: "Malaysia" };

const states = new Set([
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis",
  "Pulau Pinang", "Sabah", "Sarawak", "Selangor", "Terengganu", "W.P. Kuala Lumpur",
  "W.P. Labuan", "W.P. Putrajaya",
]);
const streetWords = /\b(?:jalan|jln|lorong|lrg|taman|tmn|persiaran|kampung|kg|no\.?|lot|unit|blok|block|apartment|condominium|condo|residensi|residence)\b/i;

export function validatePublicLocation(value: unknown): PublicLocation | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "country,districtOrCity,state" || input.country !== "Malaysia") return null;
  if (typeof input.districtOrCity !== "string" || typeof input.state !== "string") return null;
  const districtOrCity = input.districtOrCity.trim().replace(/\s+/g, " ");
  const state = input.state.trim();
  if (districtOrCity.length < 2 || districtOrCity.length > 60 || !/^[\p{L} .'-]+$/u.test(districtOrCity) || streetWords.test(districtOrCity) || !states.has(state)) return null;
  return { districtOrCity, state, country: "Malaysia" };
}

export function displayPublicLocation(location: PublicLocation) {
  return `${location.districtOrCity}, ${location.state}`;
}

export function publishableLocation(data: Record<string, unknown>): PublicLocation | null {
  const location = validatePublicLocation(data.publicLocation);
  if (!location || data.location !== displayPublicLocation(location)) return null;
  if (["latitude", "longitude", "coordinates", "gps", "geohash", "address", "addressLine1", "addressLine2", "fullAddress", "street", "streetAddress", "unitNumber", "houseNumber", "postcode", "postalCode", "privateAddress", "exactAddress", "preciseLocation"].some((key) => key in data)) return null;
  return location;
}

export function isPublicListingSafe(data: Record<string, unknown>): boolean {
  return data.privacyVersion === 2 && Boolean(publishableLocation(data));
}
