import { publicListingEndpoint } from "./public-listing-server.ts";

type PublicReadName = "getPublicListingPage" | "getPublicSellerSummaries";

/** Only existing anonymous read contracts. Auth helpers must not delay public data.
 * Protected writes and private reads continue through the authenticated SDK. */
export async function anonymousPublicRead<T>(name: PublicReadName, data: object): Promise<T> {
  const endpoint = publicListingEndpoint();
  if (!endpoint) throw new Error("Public marketplace data is unavailable.");
  const response = await fetch(endpoint.replace(/getPublicListingDetail$/, name), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }),
    credentials: "omit", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Public marketplace data could not be loaded. Please try again.");
  const payload = await response.json() as { result?: T };
  if (!payload || !("result" in payload)) throw new Error("Public marketplace data is unavailable.");
  return payload.result as T;
}
