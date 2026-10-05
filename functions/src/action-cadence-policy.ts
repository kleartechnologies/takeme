export const CADENCE_MESSAGE = "Too many attempts. Please try again shortly.";
export const CADENCE_POLICIES = {
  message: { limit: 120, windowMs: 60_000 },
  listing: { limit: 10, windowMs: 60_000 },
  offer: { limit: 30, windowMs: 60_000, resourceLimit: 8, resourceWindowMs: 30_000 },
  bid: { limit: 180, windowMs: 60_000 },
  report: { limit: 20, windowMs: 60_000 },
  upload: { limit: 64, windowMs: 60_000 },
} as const;
export type CadenceAction = keyof typeof CADENCE_POLICIES;
export type CadenceEvent = { at: number; resource?: string };

/** Sliding server-clock window. Persisted state is bounded by the action limit. */
export function planActionCadence(action: CadenceAction, previous: CadenceEvent[], now: number,
  options: { amount?: number; resource?: string } = {}) {
  const policy = CADENCE_POLICIES[action];
  const amount = options.amount ?? 1;
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isInteger(amount) || amount < 1 || amount > policy.limit) {
    throw new Error("Invalid cadence input.");
  }
  if (previous.length > policy.limit || previous.some((event) => !Number.isSafeInteger(event.at) || event.at < 0 || event.at > now)) {
    return { allowed: false as const, retryAfterMs: policy.windowMs };
  }
  const events = previous.filter((event) => event.at > now - policy.windowMs).sort((a, b) => a.at - b.at);
  let retryAfterMs = 0;
  if (events.length + amount > policy.limit) {
    retryAfterMs = events[events.length + amount - policy.limit - 1]!.at + policy.windowMs - now;
  }
  if (action === "offer" && options.resource) {
    const resourcePolicy = CADENCE_POLICIES.offer;
    if (amount > resourcePolicy.resourceLimit) return { allowed: false as const, retryAfterMs: resourcePolicy.resourceWindowMs };
    const scoped = events.filter((event) => event.resource === options.resource && event.at > now - resourcePolicy.resourceWindowMs);
    if (scoped.length + amount > resourcePolicy.resourceLimit) {
      retryAfterMs = Math.max(retryAfterMs, scoped[scoped.length + amount - resourcePolicy.resourceLimit - 1]!.at + resourcePolicy.resourceWindowMs - now);
    }
  }
  if (retryAfterMs > 0) return { allowed: false as const, retryAfterMs: Math.max(1, Math.ceil(retryAfterMs)) };
  return { allowed: true as const, events: [...events, ...Array.from({ length: amount }, () => ({ at: now, ...(options.resource ? { resource: options.resource } : {}) }))], expiresAt: now + policy.windowMs };
}
