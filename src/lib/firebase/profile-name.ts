export const PROFILE_NAME_MIN_LENGTH = 2;
export const PROFILE_NAME_MAX_LENGTH = 80;
export const PROFILE_NAME_FALLBACK = "TAKEME member";
export const PROFILE_NAME_ERROR = "Display name must be 2–80 characters.";

function characterCount(value: string) {
  return Array.from(value).length;
}

export function validateSignupDisplayName(value: string) {
  const name = value.trim();
  const length = characterCount(name);
  if (length < PROFILE_NAME_MIN_LENGTH || length > PROFILE_NAME_MAX_LENGTH) throw new Error(PROFILE_NAME_ERROR);
  return name;
}

export function normalizeProviderDisplayName(value: string | null | undefined) {
  const name = Array.from((value ?? "").trim()).slice(0, PROFILE_NAME_MAX_LENGTH).join("").trim();
  return characterCount(name) >= PROFILE_NAME_MIN_LENGTH ? name : PROFILE_NAME_FALLBACK;
}

export function newPublicProfileFields(user: { uid: string; displayName: string | null; photoURL: string | null }, chosenName?: string) {
  return {
    uid: user.uid,
    displayName: chosenName === undefined ? normalizeProviderDisplayName(user.displayName) : validateSignupDisplayName(chosenName),
    photoURL: user.photoURL ?? null,
    location: "",
  };
}
