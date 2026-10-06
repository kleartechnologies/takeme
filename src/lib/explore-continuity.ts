export const EXPLORE_CACHE_TTL_MS = 5 * 60_000;
const MAX_CONTEXTS = 6;
const contexts = new Map<string, { expiresAt: number; scrollY: number; page: unknown }>();
/** Public result snapshots are tab-memory only and bound to one Next history segment/query. */
export function rememberExplorePage<T>(key: string, page: T, scrollY: number, now = Date.now()) {
  for (const [id, value] of contexts) if (value.expiresAt <= now) contexts.delete(id);
  contexts.delete(key);
  while (contexts.size >= MAX_CONTEXTS) contexts.delete(contexts.keys().next().value!);
  contexts.set(key, { expiresAt: now + EXPLORE_CACHE_TTL_MS, scrollY: Math.max(0, Math.min(1_000_000, Number.isFinite(scrollY) ? scrollY : 0)), page });
}
export function recallExplorePage<T>(key: string, now = Date.now()): { scrollY: number; page: T } | null {
  const value = contexts.get(key);
  if (!value || value.expiresAt <= now) { contexts.delete(key); return null; }
  return { scrollY: value.scrollY, page: value.page as T };
}
export function clearExploreContinuity() { contexts.clear(); }
export function mergeExplorePage<T extends { id: string }>(previous: { listings: T[] }, next: { listings: T[]; cursor: string | null; hasMore: boolean }) {
  return { ...next, listings: [...previous.listings, ...next.listings.filter(item => !previous.listings.some(old => old.id === item.id))] };
}
