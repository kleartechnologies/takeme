import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { requireProtectedWritesAvailable } from "@/lib/protected-write-maintenance";

/** Public read-only status; the server still enforces the control at every write boundary. */
export async function assertProtectedWritesAvailable() {
  await requireProtectedWritesAvailable(async () => {
    if (!functions) throw new Error("Write status is unavailable.");
    return (await httpsCallable<Record<string, never>, unknown>(functions, "getProtectedWriteStatus", { timeout: 15_000 })({})).data;
  });
}
