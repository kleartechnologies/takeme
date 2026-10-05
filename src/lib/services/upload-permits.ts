import { functions } from "@/lib/firebase/client";
import { marketplaceCallable } from "@/lib/services/marketplace-call";

/** The server selects the authenticated owner and permits an exact path for a short window. */
export async function photoUploadMetadata(path: string, contentType: string, sizeBytes: number) {
  if (!functions) throw new Error("Photo uploads are unavailable. Please try again shortly.");
  const result = await marketplaceCallable<{ uploads: { path: string; contentType: string; sizeBytes: number }[] },
    { permits: { path: string; permitId: string; expiresAt: string }[] }>(functions, "requestUploadPermits")({ uploads: [{ path, contentType, sizeBytes }] });
  const permit = result.data.permits[0];
  if (!permit || permit.path !== path || !permit.permitId) throw new Error("The photo upload could not be authorised. Please try again.");
  return { contentType, customMetadata: { takemeUploadPermit: permit.permitId } };
}
