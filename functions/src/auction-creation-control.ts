import { productionEnvironment } from "./production-environment.ts";
import { stagingFirebaseProjectId } from "./staging-environment.ts";
import type { ProtectedWriteContext } from "./protected-write-maintenance.ts";

export const AUCTION_CREATION_CONTROL_PATH = "releaseControls/auctionCreation";
export const AUCTION_CREATION_PAUSED_REASON = "auction-creation-paused";
export const AUCTION_CREATION_PAUSED_MESSAGE = "New auctions are temporarily unavailable. You can still browse existing auctions.";
export interface AuctionCreationControl {
  readonly releaseTarget: ProtectedWriteContext["target"];
  readonly projectId: string;
  readonly auctionCreationPaused: boolean;
}
const projects = { demo: "demo-takeme", staging: stagingFirebaseProjectId, production: productionEnvironment.projectId } as const;
export function validateAuctionCreationControl(value: unknown, context: ProtectedWriteContext | null): AuctionCreationControl | null {
  if (!context || !Object.hasOwn(projects, context.target) || projects[context.target] !== context.projectId
    || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 3 || !["releaseTarget", "projectId", "auctionCreationPaused"].every(key => Object.hasOwn(record, key))
    || record.releaseTarget !== context.target || record.projectId !== context.projectId || typeof record.auctionCreationPaused !== "boolean") return null;
  return Object.freeze({ releaseTarget: context.target, projectId: context.projectId, auctionCreationPaused: record.auctionCreationPaused });
}
/** Absent is compatible OFF, never proof of a freeze; malformed/read-error/untrusted state denies. */
export function auctionCreationIsPaused(value: unknown, context: ProtectedWriteContext | null): boolean {
  if (!context || !Object.hasOwn(projects, context.target) || projects[context.target] !== context.projectId) return true;
  return value === undefined ? false : validateAuctionCreationControl(value, context)?.auctionCreationPaused ?? true;
}

/** Counts only: published scheduled auctions can start during an open-ended pause. */
export function assessZeroAuctionActivation(evidence: {
  readonly active: number | null; readonly scheduled: number | null;
  readonly creationFrozen: boolean; readonly freezeTokenUnchanged: boolean;
  readonly admissionGuardsVerified: boolean; readonly oldAdmissionsDrained: boolean;
  readonly lifecycleHealthy: boolean; readonly fresh: boolean;
}) {
  const reasons: string[] = [];
  for (const key of ["active", "scheduled"] as const) {
    if (!Number.isSafeInteger(evidence[key]) || evidence[key] !== 0) reasons.push(`${key} must be a verified zero count.`);
  }
  for (const key of ["creationFrozen", "freezeTokenUnchanged", "admissionGuardsVerified", "oldAdmissionsDrained", "lifecycleHealthy", "fresh"] as const) {
    if (evidence[key] !== true) reasons.push(`${key} must be verified.`);
  }
  return Object.freeze({ ready: reasons.length === 0, reasons: Object.freeze(reasons), activationAuthorized: false as const });
}
