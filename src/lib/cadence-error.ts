export const CADENCE_ERROR_MESSAGE = "Too many attempts. Please try again shortly.";
export function cadenceErrorMessage(error: unknown, depth = 0): string | null {
  if (!error || typeof error !== "object") return null;
  const value = error as { code?: unknown; details?: { reason?: unknown }; cause?: unknown };
  if (["resource-exhausted", "functions/resource-exhausted"].includes(String(value.code)) && value.details?.reason === "cadence-limit") return CADENCE_ERROR_MESSAGE;
  return depth < 4 && value.cause && value.cause !== error ? cadenceErrorMessage(value.cause, depth + 1) : null;
}
