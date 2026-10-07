/** Only identifiers/checksums enter draft recovery. Never download tokens or image bytes. */
export interface ListingSubmissionCheckpoint {
  type: "buy_now" | "auction";
  id: string | null;
  creationAttempted: boolean;
  publicationAttempted: boolean;
  uploads: { digest: string; path: string }[];
}
export function newListingSubmission(type: ListingSubmissionCheckpoint["type"]): ListingSubmissionCheckpoint {
  return { type, id: null, creationAttempted: false, publicationAttempted: false, uploads: [] };
}
export function validListingSubmission(value: unknown): value is ListingSubmissionCheckpoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).sort().join() === "creationAttempted,id,publicationAttempted,type,uploads"
    && ["buy_now", "auction"].includes(String(v.type))
    && (v.id === null || typeof v.id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(v.id))
    && typeof v.creationAttempted === "boolean" && typeof v.publicationAttempted === "boolean"
    && (!v.publicationAttempted || !!v.id) && (!v.id || v.creationAttempted)
    && Array.isArray(v.uploads) && v.uploads.length <= 24
    && (!v.uploads.length || !!v.id)
    && v.uploads.every(item => item && Object.keys(item).sort().join() === "digest,path"
      && typeof item.digest === "string" && /^[0-9a-f]{64}$/.test(item.digest)
      && typeof item.path === "string" && /^users\/[a-zA-Z0-9_-]{1,128}\/listings\/[a-zA-Z0-9_-]{1,128}\/[a-zA-Z0-9_-]{1,128}\.webp$/.test(item.path));
}
export interface ListingSubmissionAdapter {
  create(): Promise<string>;
  read(id: string): Promise<"draft" | "published" | "unavailable">;
  upload(id: string): Promise<string[]>;
  save(id: string, urls: string[]): Promise<unknown>;
  publish(id: string, urls: string[]): Promise<unknown>;
  checkpoint(): void;
}
function definiteCreationRejection(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 3) return false;
  const value = error as { code?: string; cause?: unknown };
  return ["functions/invalid-argument", "functions/permission-denied", "functions/failed-precondition", "functions/unauthenticated", "functions/resource-exhausted"].includes(value.code ?? "")
    || definiteCreationRejection(value.cause, depth + 1);
}
/** Each invocation is explicit. Recovery never calls this or replays a marketplace action. */
export async function runListingSubmission(state: ListingSubmissionCheckpoint, adapter: ListingSubmissionAdapter, saveDraft = false) {
  if (!validListingSubmission(state)) throw new Error("This saved submission is invalid. Review My Listings before continuing.");
  if (!state.id) {
    if (state.creationAttempted) throw new Error("The draft creation response was interrupted. Check My Listings before starting another listing. Your entries are still here.");
    state.creationAttempted = true; adapter.checkpoint();
    try {
      const id = await adapter.create();
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id ?? "")) throw new Error("The draft creation response could not be verified. Check My Listings.");
      state.id = id; adapter.checkpoint();
    } catch (error) {
      if (definiteCreationRejection(error)) { state.creationAttempted = false; adapter.checkpoint(); }
      throw error;
    }
  }
  const status = await adapter.read(state.id);
  if (status === "published" && state.publicationAttempted) return state.id;
  if (status !== "draft") throw new Error("This draft is no longer available for submission. Check My Listings.");
  const urls = await adapter.upload(state.id);
  await adapter.save(state.id, urls);
  if (!saveDraft) {
    state.publicationAttempted = true; adapter.checkpoint();
    try { await adapter.publish(state.id, urls); }
    catch (error) {
      // A successful publish with a lost response must never create a replacement listing.
      if (await adapter.read(state.id) !== "published") throw error;
    }
  }
  return state.id;
}
