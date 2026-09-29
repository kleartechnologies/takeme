export const MALAYSIAN_STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis",
  "Pulau Pinang", "Sabah", "Sarawak", "Selangor", "Terengganu", "W.P. Kuala Lumpur",
  "W.P. Labuan", "W.P. Putrajaya",
] as const;

export type PublicLocation = { districtOrCity: string; state: string; country: "Malaysia" };

const streetWords = /\b(?:jalan|jln|lorong|lrg|taman|tmn|persiaran|kampung|kg|no\.?|lot|unit|blok|block|apartment|condominium|condo|residensi|residence)\b/i;

export function makePublicLocation(districtOrCity: string, state: string): PublicLocation | null {
  const city = districtOrCity.trim().replace(/\s+/g, " ");
  const selectedState = state.trim();
  if (city.length < 2 || city.length > 60 || !/^[\p{L} .'-]+$/u.test(city) || streetWords.test(city)) return null;
  if (!MALAYSIAN_STATES.includes(selectedState as (typeof MALAYSIAN_STATES)[number])) return null;
  return { districtOrCity: city, state: selectedState, country: "Malaysia" };
}

export function parsePublicLocation(value: unknown): PublicLocation | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "country,districtOrCity,state" || input.country !== "Malaysia") return null;
  if (typeof input.districtOrCity !== "string" || typeof input.state !== "string") return null;
  return makePublicLocation(input.districtOrCity, input.state);
}

export function formatPublicLocation(location: PublicLocation) {
  return `${location.districtOrCity}, ${location.state}`;
}

export function parseLegacyGeneralLocation(value: unknown): PublicLocation | null {
  if (typeof value !== "string") return null;
  const parts = value.split(",");
  if (parts.length !== 2) return null;
  return makePublicLocation(parts[0] ?? "", parts[1] ?? "");
}
