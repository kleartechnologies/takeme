import type { SellValues } from "./sell-flow.ts";
import type { PendingMessageSend } from "./message-send-request.ts";

export const RECOVERY_TTL_MS = 30 * 60_000;
const PREFIX = "takeme:recovery:v1:";
const ACCOUNT = PREFIX + "account";
const MAX_RECORDS = 8;
const MAX_BYTES = 16_384;
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
export type RecoveryDraft =
  | { kind: "sell"; values: SellValues; step: number; photoCount: number }
  | { kind: "offer"; listingId: string; amount: string; method: string; sheet: "make" | "counter"; offerId: string | null }
  | { kind: "message"; body: string; request: PendingMessageSend | null };
type RecordValue = { owner: string | null; scope: string; expiresAt: number; draft: RecoveryDraft };
const memory = new Map<string, string>();
const fallback: StorageLike = { get length() { return memory.size; }, key: i => [...memory.keys()][i] ?? null,
  getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: key => { memory.delete(key); } };
let files: { scope: string; owner: string; expiresAt: number; value: File[] } | null = null;
function browserStorage(): StorageLike {
  try { return typeof window === "undefined" ? fallback : window.sessionStorage; } catch { return fallback; }
}
const keyFor = (scope: string) => PREFIX + encodeURIComponent(scope);
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
function exact(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).length === keys.length && keys.every(key => key in value); }

/** Explicit field allowlists: credentials, tokens, arbitrary objects and bids have no storage path. */
export function validRecoveryDraft(value: unknown): value is RecoveryDraft {
  if (!isObject(value)) return false;
  if (value.kind === "message") {
    if (!exact(value, ["kind", "body", "request"]) || !text(value.body, 2000)) return false;
    const request = value.request;
    return request === null || isObject(request) && exact(request, ["senderId", "conversationId", "body", "idempotencyKey"])
      && text(request.senderId, 128) && text(request.conversationId, 256) && text(request.body, 2000)
      && typeof request.idempotencyKey === "string" && /^[0-9a-f-]{36}$/i.test(request.idempotencyKey);
  }
  if (value.kind === "offer") return exact(value, ["kind", "listingId", "amount", "method", "sheet", "offerId"])
    && text(value.listingId, 128) && typeof value.amount === "string" && /^\d{0,10}(\.\d{0,2})?$/.test(value.amount)
    && ["cod", "bank_transfer", "external", "other"].includes(String(value.method))
    && ["make", "counter"].includes(String(value.sheet)) && (value.offerId === null || text(value.offerId, 128));
  if (value.kind !== "sell" || !exact(value, ["kind", "values", "step", "photoCount"]) || !isObject(value.values)
    || !Number.isInteger(value.step) || Number(value.step) < 0 || Number(value.step) > 7
    || !Number.isInteger(value.photoCount) || Number(value.photoCount) < 0 || Number(value.photoCount) > 8) return false;
  const limits = { title: 80, categoryId: 128, condition: 20, description: 1200, price: 24, districtOrCity: 80, state: 80,
    meetupLocationId: 128, listingType: 16, startingBid: 24, minimumBidIncrement: 24, auctionStartAt: 32, auctionEndAt: 32, startMode: 16 };
  return exact(value.values, [...Object.keys(limits), "saveLocationToProfile"])
    && Object.entries(limits).every(([key, max]) => text(value.values && (value.values as Record<string, unknown>)[key], max))
    && value.values.saveLocationToProfile === false
    && ["buy_now", "auction"].includes(String(value.values.listingType)) && ["now", "scheduled"].includes(String(value.values.startMode));
}
function parse(raw: string | null, now: number): RecordValue | null {
  try {
    if (!raw || raw.length > MAX_BYTES) return null;
    const value: unknown = JSON.parse(raw);
    return isObject(value) && exact(value, ["owner", "scope", "expiresAt", "draft"])
      && (value.owner === null || text(value.owner, 128)) && text(value.scope, 384)
      && typeof value.expiresAt === "number" && value.expiresAt > now && value.expiresAt <= now + RECOVERY_TTL_MS
      && validRecoveryDraft(value.draft) ? value as RecordValue : null;
  } catch { return null; }
}
function prune(storage: StorageLike, now: number) {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => !!key && key.startsWith(PREFIX) && key !== ACCOUNT);
  const valid = keys.filter(key => { if (parse(storage.getItem(key), now)) return true; storage.removeItem(key); return false; });
  while (valid.length >= MAX_RECORDS) storage.removeItem(valid.shift()!);
  if (files && files.expiresAt <= now) files = null;
}
export function saveRecovery(scope: string, owner: string | null, draft: RecoveryDraft, storage = browserStorage(), now = Date.now()) {
  if (!scope || scope.length > 384 || !validRecoveryDraft(draft)) return false;
  // Guest recovery is limited to offer context. Private messages and Sell entries always have an owner.
  if (!owner && draft.kind !== "offer") return false;
  try { prune(storage, now); storage.setItem(keyFor(scope), JSON.stringify({ owner, scope, expiresAt: now + RECOVERY_TTL_MS, draft })); return true; } catch { return false; }
}
export function readRecovery(scope: string, owner: string | null, storage = browserStorage(), now = Date.now()): RecoveryDraft | null {
  try {
    const value = parse(storage.getItem(keyFor(scope)), now);
    if (!value || value.scope !== scope || value.owner !== owner && !(value.owner === null && owner && value.draft.kind === "offer")) {
      storage.removeItem(keyFor(scope)); return null;
    }
    if (value.owner === null && owner) saveRecovery(scope, owner, value.draft, storage, now);
    return value.draft;
  } catch { return null; }
}
export function clearRecovery(scope?: string, storage = browserStorage()) {
  try {
    if (scope) storage.removeItem(keyFor(scope));
    else for (const key of Array.from({ length: storage.length }, (_, i) => storage.key(i))) if (key?.startsWith(PREFIX)) storage.removeItem(key);
  } catch { /* Recovery must never block logout or a completed action. */ }
  if (!scope || files?.scope === scope) files = null;
}
/** Reauthentication can retain the same owner's draft; switching account destroys it. */
export function syncRecoveryAccount(owner: string | null, storage = browserStorage()) {
  if (!owner) return;
  try { const prior = storage.getItem(ACCOUNT); if (prior && prior !== owner) clearRecovery(undefined, storage); storage.setItem(ACCOUNT, owner); } catch { /* Optional session storage. */ }
}
/** Files stay in memory only. One bounded selection; no bytes/blob URLs in sessionStorage. */
export function rememberRecoveryFiles(scope: string, owner: string, value: File[], now = Date.now()) {
  files = value.length <= 8 && value.every(file => file.type.startsWith("image/") && file.size <= 8 * 1024 * 1024)
    && value.reduce((size, file) => size + file.size, 0) <= 64 * 1024 * 1024
    ? { scope, owner, value: [...value], expiresAt: now + RECOVERY_TTL_MS } : null;
}
export function readRecoveryFiles(scope: string, owner: string, now = Date.now()) {
  if (!files || files.owner !== owner || files.scope !== scope || files.expiresAt <= now) return [];
  return [...files.value];
}
