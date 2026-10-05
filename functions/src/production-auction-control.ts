import { AUCTION_CREATION_CONTROL_PATH, validateAuctionCreationControl, type AuctionCreationControl } from "./auction-creation-control.ts";
import { productionEnvironment } from "./production-environment.ts";
import { planProductionMaintenance, assertMaintenanceApplySource, type MaintenanceRuntime, type MaintenanceSnapshot, type ExpectedMaintenanceState } from "./production-maintenance-control.ts";
import { productionReleasePolicy, type ReleasePolicy } from "./release-policy.ts";
import { legalPublicationReadiness, type LegalPublicationReadiness } from "./legal-publication.ts";
import { productionPolicyRecordMatches } from "./production-policy-bootstrap.ts";

export interface AuctionControlPlan {
  readonly path: typeof AUCTION_CREATION_CONTROL_PATH;
  readonly action: "freeze" | "restore";
  readonly expectedState: ExpectedMaintenanceState;
  readonly expectedUpdateTime: string | null;
  readonly record: Readonly<AuctionCreationControl>;
}
const context = { target: "production" as const, projectId: productionEnvironment.projectId };
const refuse = (message: string): never => { throw new Error(`Auction control refused: ${message}`); };
const token = /^(0|[1-9]\d*)\.\d{9}$/;
export function planProductionAuctionControl(runtime: MaintenanceRuntime, action: AuctionControlPlan["action"], state: ExpectedMaintenanceState, updateTime: string | null = null): AuctionControlPlan {
  // Reuse the exact project/bucket/emulator/deletion/payment resource safeguards.
  planProductionMaintenance(runtime, "enable", state, updateTime);
  if (!["freeze", "restore"].includes(action) || action === "restore" && state === "absent") refuse("Explicit action and existing restore state required.");
  return Object.freeze({ path: AUCTION_CREATION_CONTROL_PATH, action, expectedState: state, expectedUpdateTime: updateTime,
    record: Object.freeze({ releaseTarget: "production", projectId: productionEnvironment.projectId, auctionCreationPaused: action === "freeze" }) });
}
export function assertAuctionControlSource(plan: AuctionControlPlan, policy: ReleasePolicy = productionReleasePolicy, legal: LegalPublicationReadiness = legalPublicationReadiness) {
  const record = validateAuctionCreationControl(plan.record, context);
  if (plan.path !== AUCTION_CREATION_CONTROL_PATH || !["freeze", "restore"].includes(plan.action) || !["absent", "off", "on"].includes(plan.expectedState)
    || !record || record.auctionCreationPaused !== (plan.action === "freeze")
    || (plan.expectedState === "absent" ? plan.expectedUpdateTime !== null : !plan.expectedUpdateTime || !token.test(plan.expectedUpdateTime))
    || plan.action === "restore" && plan.expectedState === "absent") refuse("Fixed control/CAS plan required.");
  if (plan.action === "restore") assertMaintenanceApplySource({ path: "releaseControls/current", action: "disable", expectedState: "on",
    expectedUpdateTime: plan.expectedUpdateTime, record: { releaseTarget: "production", projectId: productionEnvironment.projectId, protectedWritesPaused: false } }, policy, legal);
}
export interface AuctionControlStore {
  transaction<T>(handler: (tx: {
    readAuctionControl(): Promise<MaintenanceSnapshot>;
    readMaintenance(): Promise<unknown>;
    readPolicy(): Promise<unknown>;
    create(record: Readonly<AuctionCreationControl>): void;
    replace(record: Readonly<AuctionCreationControl>): void;
  }) => Promise<T>): Promise<T>;
  readAuctionControl(): Promise<MaintenanceSnapshot>;
}
/** Only the fixed auction control is written. No delete, broad merge, repair, timer or automatic reopen. */
export async function applyProductionAuctionControl(store: AuctionControlStore, plan: AuctionControlPlan,
  policy: ReleasePolicy = productionReleasePolicy, legal: LegalPublicationReadiness = legalPublicationReadiness) {
  assertAuctionControlSource(plan, policy, legal);
  const result = await store.transaction(async tx => {
    const current = await tx.readAuctionControl();
    const existing = validateAuctionCreationControl(current.data, context);
    if (plan.expectedState === "absent" ? current.exists || current.updateTime !== null
      : !current.exists || current.updateTime !== plan.expectedUpdateTime || !existing || existing.auctionCreationPaused !== (plan.expectedState === "on")) {
      refuse("State/token changed; inspect before an explicitly approved retry.");
    }
    if (plan.action === "restore") {
      const maintenance = await tx.readMaintenance();
      const expected = { releaseTarget: "production", projectId: productionEnvironment.projectId, protectedWritesPaused: false };
      if (!maintenance || typeof maintenance !== "object" || Object.keys(maintenance).length !== 3
        || !Object.entries(expected).every(([key, value]) => Object.hasOwn(maintenance, key) && (maintenance as Record<string, unknown>)[key] === value)) {
        refuse("Verified explicit maintenance OFF is required; keep auctions frozen.");
      }
      if (!productionPolicyRecordMatches(await tx.readPolicy(), { releaseTarget: "production", projectId: productionEnvironment.projectId,
        publicationApproved: true, termsVersion: policy.termsVersion!, privacyVersion: policy.privacyVersion!, minimumAge: 18 })) refuse("Final runtime policy parity required.");
    }
    if (existing?.auctionCreationPaused === plan.record.auctionCreationPaused) return "already-current" as const;
    if (current.exists) tx.replace(plan.record); else tx.create(plan.record);
    return "changed" as const;
  });
  const after = await store.readAuctionControl(), value = validateAuctionCreationControl(after.data, context);
  if (!after.exists || !after.updateTime || !value || value.auctionCreationPaused !== plan.record.auctionCreationPaused) return refuse("Outcome unknown; inspect without automatic repair.");
  return Object.freeze({ result, path: plan.path, projectId: productionEnvironment.projectId,
    auctionCreationPaused: value.auctionCreationPaused, updateTime: after.updateTime, operationalCoverageVerified: false });
}

/** Aggregate-only precheck. Caller supplies exact project-bound DB; no listing/bid/account documents returned. */
export async function readZeroAuctionCounts(store: {
  readAuctionControl(): Promise<MaintenanceSnapshot>;
  countPublished(status: "active" | "scheduled"): Promise<number>;
}, expectedUpdateTime: string) {
  if (!token.test(expectedUpdateTime)) refuse("Exact freeze update-time token required.");
  const frozen = (snapshot: MaintenanceSnapshot) => snapshot.exists && snapshot.updateTime === expectedUpdateTime
    && validateAuctionCreationControl(snapshot.data, context)?.auctionCreationPaused === true;
  if (!frozen(await store.readAuctionControl())) refuse("Verified freeze required before count queries.");
  const [active, scheduled] = await Promise.all([store.countPublished("active"), store.countPublished("scheduled")]);
  if (!frozen(await store.readAuctionControl()) || ![active, scheduled].every(Number.isSafeInteger) || active < 0 || scheduled < 0) refuse("Count or freeze outcome unknown; no-go.");
  return Object.freeze({ active, scheduled, zeroPublishedUnfinishedAuctions: active === 0 && scheduled === 0,
    freezeTokenUnchanged: true, activationAuthorized: false });
}
