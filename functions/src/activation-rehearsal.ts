/** Pure rehearsal/runbook validation. No SDK, credentials, environment, clock,
 * cloud apply, production activation or maintenance bypass exists here. */
export const rehearsalDrainBounds = Object.freeze({
  historicalCallableMs: 60_000,
  firestoreTransactionMs: 270_000,
  uploadPermitMs: 120_000,
  firestoreRulePropagationReserveMs: 600_000,
});
export interface DrainEvidence {
  readonly now: number;
  readonly lastOldRequestAt: number | null;
  readonly lastPermitIssuedAt: number | null;
  readonly ruleBridgeDeployedAt: number | null;
  readonly oldRevisionsRetired: boolean;
  readonly runtimeQuiescenceVerified: boolean;
  readonly historicalUploadsSettled: boolean;
  readonly newPermitsStopped: boolean;
  readonly freezeEnforcementVerified: boolean;
  readonly directWriteEnforcementVerified: boolean;
}
const validTime = (value: number | null, now: number): value is number => value !== null && Number.isFinite(value) && value >= 0 && value <= now;
export function assessActivationDrain(value: DrainEvidence) {
  const reasons: string[] = [];
  const times = [value.lastOldRequestAt, value.lastPermitIssuedAt, value.ruleBridgeDeployedAt];
  const valid = Number.isFinite(value.now) && value.now >= 0 && times.every(time => validTime(time, value.now));
  if (!valid) reasons.push("Confirmed monotonic drain timestamps required.");
  const notBefore = valid ? Math.max(
    value.lastOldRequestAt! + rehearsalDrainBounds.historicalCallableMs + rehearsalDrainBounds.firestoreTransactionMs,
    value.lastPermitIssuedAt! + rehearsalDrainBounds.uploadPermitMs,
    value.ruleBridgeDeployedAt! + rehearsalDrainBounds.firestoreRulePropagationReserveMs,
  ) : null;
  for (const key of ["oldRevisionsRetired", "runtimeQuiescenceVerified", "historicalUploadsSettled", "newPermitsStopped", "freezeEnforcementVerified", "directWriteEnforcementVerified"] as const) {
    if (value[key] !== true) reasons.push(`${key} not verified.`);
  }
  if (notBefore !== null && value.now < notBefore) reasons.push("Calculated drain reserve not elapsed.");
  return Object.freeze({ ready: reasons.length === 0, notBefore, reasons: Object.freeze(reasons) });
}
/** Owner-approved V1 checkpoint; elapsed time alone never authorizes transition. */
export function assessV1ActivationDrain(value: DrainEvidence & { readonly effectivePauseVerifiedAt: number | null }) {
  const prior = assessActivationDrain(value);
  const valid = validTime(value.effectivePauseVerifiedAt, value.now);
  const notBefore = valid && prior.notBefore !== null
    ? Math.max(prior.notBefore, value.effectivePauseVerifiedAt! + 900_000) : null;
  const reasons = [...prior.reasons];
  if (!valid) reasons.push("Verified effective-pause timestamp required.");
  if (notBefore !== null && value.now < notBefore) reasons.push("Owner-approved 900-second checkpoint not elapsed.");
  return Object.freeze({ ready: reasons.length === 0, notBefore, reasons: Object.freeze(reasons), activationAuthorized: false as const });
}
export interface WindowTiming {
  readonly activationStepsMs: readonly (number | null)[];
  readonly rollbackStepsMs: readonly (number | null)[];
  readonly verificationMs: number | null;
  readonly safetyMarginMs: number | null;
}
/** Historical timing analysis only; V1 activation no longer requires an X/Y horizon. */
export function calculateAuctionSafetyWindow(value: WindowTiming): number | null {
  const steps = [...value.activationStepsMs, ...value.rollbackStepsMs, value.verificationMs, value.safetyMarginMs];
  if (!value.activationStepsMs.length || !value.rollbackStepsMs.length || steps.some(time => time === null || !Number.isFinite(time) || time <= 0)) return null;
  const total = (steps as number[]).reduce((sum, time) => sum + time, 0);
  return Number.isSafeInteger(total) ? total : null;
}
export function auctionBoundaryIsSafe(now: number, boundary: number, windowMs: number | null): boolean {
  return Number.isFinite(now) && Number.isFinite(boundary) && windowMs !== null && Number.isFinite(windowMs) && windowMs > 0 && Math.abs(boundary - now) > windowMs;
}
export const activationDependencies = Object.freeze({
  installBridge: ["sourceBindingsVerified", "offContractsVerified", "rollbackCaptured"],
  establishPause: ["allCallableBridgesVerified", "directRuleBridgeVerified", "storageFreezeVerified", "controlOnReadback"],
  publishLegal: ["effectivePauseVerified", "drainVerified", "counselApproved", "datesApproved", "finalProseApproved"],
  bootstrap: ["legalRoutesReachable", "fivePreparationEndpointsVerified", "effectivePauseVerified"],
  frontend: ["bootstrapReadback", "artifactQualified", "effectivePauseVerified"],
  coordinatedFunctions: ["bootstrapReadback", "compatibleFrontendVerified", "legacyMessageTransitionReviewed", "effectivePauseVerified"],
  finalFirestore: ["bootstrapReadback", "coordinatedFunctionsVerified", "exactSourceRulesVerified", "effectivePauseVerified"],
  finalStorage: ["finalFirestoreVerified", "permitIssuanceBlocked", "permitDrainVerified", "exactSourceRulesVerified", "effectivePauseVerified"],
  pausedVerification: ["finalStorageVerified", "publicReadsVerified", "acceptanceHistoryVerified", "negativeWritesVerified", "isolationVerified"],
  reopen: ["pausedVerificationPassed", "allDeployedParityVerified", "monitoringReady", "ownerReopenApproved", "sourceAndPolicyReopenQualified"],
  positiveSmoke: ["guardedReopenReadback", "publicReadsStillAvailable", "syntheticSmokeApproved"],
} as const);
export type ActivationStep = keyof typeof activationDependencies;
export function missingActivationDependencies(step: ActivationStep, evidence: Readonly<Record<string, boolean>>): readonly string[] {
  return activationDependencies[step].filter(name => evidence[name] !== true);
}
export type AbortPhase = "beforePause" | "pausedBeforePolicy" | "policyBootstrapped" | "partiallyCoordinated" | "verifiedFinal" | "reopened";
export function classifyActivationAbort(phase: AbortPhase) {
  const before = phase === "beforePause";
  const partial = phase === "policyBootstrapped" || phase === "partiallyCoordinated" || phase === "reopened";
  return Object.freeze({
    preservePublicReads: true, retainAcceptanceEvidence: true,
    keepOrReestablishPause: !before, rollbackRequired: partial,
    legacyReopenAllowed: false,
    finalReopenMayBeReviewed: phase === "verifiedFinal",
    partlyIrreversible: phase === "policyBootstrapped" || phase === "partiallyCoordinated" || phase === "verifiedFinal" || phase === "reopened",
  });
}
