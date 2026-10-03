import { httpsCallable, type Functions } from "firebase/functions";
import { auth } from "@/lib/firebase/client";
import { ACCOUNT_ELIGIBILITY_EVENT, eligibilityMessage } from "@/lib/account-eligibility";

// Recheck server-owned eligibility after a stale-session rejection. Routing preserves
// the current URL; it never retries the rejected marketplace action automatically.
export async function withEligibilityHandling<T>(action: () => Promise<T>): Promise<T> {
  const uid = auth?.currentUser?.uid;
  try { return await action(); }
  catch (error) {
    const message = eligibilityMessage(error);
    const ruleDenied = !!error && typeof error === "object" && "code" in error && ["permission-denied", "storage/unauthorized"].includes(String(error.code));
    if ((message || ruleDenied) && uid && auth?.currentUser?.uid === uid && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ACCOUNT_ELIGIBILITY_EVENT, { detail: { uid } }));
    }
    if (message) throw new Error(message);
    if (ruleDenied) throw new Error("This action could not be authorised. Please check your account status before trying again.");
    throw error;
  }
}
export function marketplaceCallable<Request, Response>(service: Functions, name: string) {
  const invoke = httpsCallable<Request, Response>(service, name);
  return (data: Request) => withEligibilityHandling(() => invoke(data));
}
