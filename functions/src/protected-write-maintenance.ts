import { productionEnvironment } from "./production-environment.ts";
import { stagingFirebaseProjectId } from "./staging-environment.ts";
import type { ReleaseTarget } from "./release-policy.ts";

export const PROTECTED_WRITE_MAINTENANCE_MESSAGE = "TAKEME is completing a short system update. Browsing is still available, but this action is temporarily unavailable. Please try again shortly.";
export const PROTECTED_WRITE_MAINTENANCE_REASON = "protected-writes-paused";

export interface ProtectedWriteContext {
  readonly target: ReleaseTarget;
  readonly projectId: string;
}
export interface ProtectedWriteControl {
  readonly releaseTarget: ReleaseTarget;
  readonly projectId: string;
  readonly protectedWritesPaused: boolean;
}
export interface ProtectedWriteStatus { readonly protectedWritesPaused: boolean }

const projects: Readonly<Record<ReleaseTarget, string>> = Object.freeze({
  demo: "demo-takeme", staging: stagingFirebaseProjectId, production: productionEnvironment.projectId,
});

function validContext(context: ProtectedWriteContext | null): context is ProtectedWriteContext {
  return !!context && Object.hasOwn(projects, context.target) && projects[context.target] === context.projectId;
}

/** Only the exact server-owned three-field control for these trusted resources is accepted. */
export function validateProtectedWriteControl(value: unknown, context: ProtectedWriteContext | null): ProtectedWriteControl | null {
  if (!validContext(context) || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 3 || !["releaseTarget", "projectId", "protectedWritesPaused"].every(key => Object.hasOwn(record, key))
    || record.releaseTarget !== context.target || record.projectId !== context.projectId || typeof record.protectedWritesPaused !== "boolean") return null;
  return Object.freeze({ releaseTarget: context.target, projectId: context.projectId, protectedWritesPaused: record.protectedWritesPaused });
}

/** Missing control is explicitly OFF for compatible rollout, never a malformed/read-error fallback. */
export function maintenanceIsPaused(value: unknown, context: ProtectedWriteContext | null): boolean {
  if (!validContext(context)) return true;
  if (value === undefined) return false;
  return validateProtectedWriteControl(value, context)?.protectedWritesPaused ?? true;
}
