export type SetupStep = "acceptance" | "profile" | "welcome" | "ready" | "deletion";
export const authPaths = ["/login", "/register", "/forgot-password", "/onboarding/acceptance", "/onboarding/profile", "/onboarding/welcome"];
export function isAuthPath(path: string) { return authPaths.includes(path); }

export function safeAuthNext(value: string | null | undefined, fallback = "/explore") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback;
    const url = new URL(value, "https://takeme.invalid");
    const normalized = new URL(decoded, "https://takeme.invalid");
    if (url.origin !== "https://takeme.invalid" || normalized.origin !== url.origin || isAuthPath(normalized.pathname) || normalized.pathname.startsWith("/onboarding/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

export function setupDestination(step: SetupStep, intended: string) {
  if (step === "deletion") return "/account-deletion";
  const next = safeAuthNext(intended);
  return step === "ready" ? next : `/onboarding/${step}?next=${encodeURIComponent(next)}`;
}

// Pending accounts retain only the already approved resolution and deletion surfaces.
export function isPendingResolutionPath(path: string) {
  return path === "/account-deletion" || path === "/transactions" || path.startsWith("/transactions/") || path === "/profile/transactions" || path.startsWith("/profile/transactions/") || path === "/messages" || path.startsWith("/messages/");
}
