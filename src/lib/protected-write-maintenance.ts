import { PROTECTED_WRITE_MAINTENANCE_MESSAGE } from "../../functions/src/protected-write-maintenance.ts";

export { PROTECTED_WRITE_MAINTENANCE_MESSAGE };
export const PROTECTED_WRITE_MAINTENANCE_EVENT = "takeme:protected-write-maintenance";

/** Safe, typed refusal only. No internal control state or pending action is retained. */
export class ProtectedWriteMaintenanceError extends Error {
  readonly code = "functions/failed-precondition";
  readonly details = Object.freeze({ reason: "protected-writes-paused" });

  constructor(options?: ErrorOptions) {
    super(PROTECTED_WRITE_MAINTENANCE_MESSAGE, options);
    this.name = "ProtectedWriteMaintenanceError";
  }
}

export function protectedWriteMaintenanceMessage(error: unknown, depth = 0): string | null {
  if (!error || typeof error !== "object") return null;
  const value = error as { code?: unknown; details?: { reason?: unknown }; cause?: unknown };
  if (["failed-precondition", "functions/failed-precondition"].includes(String(value.code))
    && value.details?.reason === "protected-writes-paused") return PROTECTED_WRITE_MAINTENANCE_MESSAGE;
  return depth < 4 && value.cause && value.cause !== error ? protectedWriteMaintenanceMessage(value.cause, depth + 1) : null;
}

/** Each explicit attempt reads current server status. Failed/malformed reads pause the attempt safely. */
export async function requireProtectedWritesAvailable(readStatus: () => Promise<unknown>): Promise<void> {
  let value: unknown;
  try { value = await readStatus(); }
  catch (cause) { throw new ProtectedWriteMaintenanceError({ cause }); }
  const record = value as Record<string, unknown>;
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== 1 || !Object.hasOwn(value, "protectedWritesPaused")
    || record.protectedWritesPaused !== false) throw new ProtectedWriteMaintenanceError();
}

export function announceProtectedWriteMaintenance() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROTECTED_WRITE_MAINTENANCE_EVENT));
}
