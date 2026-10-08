export type SetupStep = "acceptance" | "profile" | "welcome" | "ready" | "deletion";
export const MARKETPLACE_HOME = "/explore";
export const authPaths = ["/login", "/register", "/forgot-password", "/onboarding/acceptance", "/onboarding/profile", "/onboarding/welcome"];
export function isAuthPath(path: string) { return authPaths.includes(path); }

/** Browsing never establishes consent. Only these page-level write flows require setup. */
export function isProtectedMarketplaceRoute(path: string) {
  return path === "/sell" || /^\/listings\/[^/]+\/(edit|promote)$/.test(path);
}

export interface MarketplaceSetupState { step: SetupStep; policyAvailable?: boolean }

/** A user must tap again after the returned checkpoint; this helper stores no pending action. */
export function protectedActionDestination(signedIn: boolean, setup: MarketplaceSetupState | null, intended?: string | null) {
  const next = safeAuthNext(intended);
  if (!signedIn) return `/login?next=${encodeURIComponent(next)}&intent=write`;
  if (!setup) return setupDestination("acceptance", next);
  if (setup.step === "deletion") return setupDestination("deletion", next);
  if (setup.policyAvailable !== true) return setupDestination("acceptance", next);
  return setup.step === "ready" ? null : setupDestination(setup.step, next);
}

/** Deletion restrictions still apply globally; policy acceptance gates write pages only. */
export function accountRouteRequiresSetup(path: string, setup: MarketplaceSetupState | null) {
  if (setup?.step === "deletion") return !isPendingResolutionPath(path);
  return isProtectedMarketplaceRoute(path) && (!setup || setup.step !== "ready" || setup.policyAvailable !== true);
}

/** Only explicit actions carry this marker; it changes routing, never authorization. */
export function hasProtectedAuthIntent(value: string | null | undefined) {
  return value === "write" || value === "sell" || value === "chat" || value === "offer"
    || value === "bid" || value === "save" || value === "follow" || value === "upload";
}

export function authenticationDestination(setup: MarketplaceSetupState, intended?: string | null, freshAccount = false, protectedIntent = false) {
  const next = safeAuthNext(intended);
  if (setup.step === "deletion") return setupDestination("deletion", next);
  if (!freshAccount && !protectedIntent && !isProtectedMarketplaceRoute(new URL(next, "https://takeme.invalid").pathname)) return next;
  return protectedActionDestination(true, setup, next) ?? next;
}

export function safeAuthNext(value: string | null | undefined, fallback = MARKETPLACE_HOME) {
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

export function setupDestination(step: SetupStep, intended?: string | null) {
  if (step === "deletion") return "/account-deletion";
  const next = safeAuthNext(intended);
  return step === "ready" ? next : `/onboarding/${step}?next=${encodeURIComponent(next)}`;
}

export function welcomeDestinations(intended?: string | null) {
  const next = safeAuthNext(intended);
  return {
    explore: MARKETPLACE_HOME,
    secondary: next === MARKETPLACE_HOME
      ? { label: "Sell Something", destination: "/sell" }
      : { label: "Continue where you left off", destination: next },
  };
}

// Pending accounts retain only the already approved resolution and deletion surfaces.
export function isPendingResolutionPath(path: string) {
  return path === "/account-deletion" || path === "/transactions" || path.startsWith("/transactions/") || path === "/profile/transactions" || path.startsWith("/profile/transactions/") || path === "/messages" || path.startsWith("/messages/");
}

/** Exact read-only surfaces. Unknown routes never acquire a public exemption. */
export function isPublicMarketplaceRoute(path: string) {
  return ["/", "/explore", "/categories", "/for-you"].includes(path)
    || /^\/listings\/[^/]+$/.test(path) || /^\/sellers\/[^/]+$/.test(path)
    || path === "/help/tiers";
}

export function accountGateState(path: string, loading: boolean, signedIn: boolean, setup: MarketplaceSetupState | null, error: boolean) {
  if (isAuthPath(path)) return "render";
  // A known lifecycle restriction wins over every public browsing exemption.
  if (signedIn && setup && accountRouteRequiresSetup(path, setup)) return "redirect";
  if (isPublicMarketplaceRoute(path)) return "render";
  if (loading) return "checking";
  if (!signedIn) return "render"; // Private page's existing login guard takes over.
  if (error) return "error";
  return setup ? "render" : "checking";
}
