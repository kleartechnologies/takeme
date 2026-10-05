/** Rehearsal planning only. Samples are observations, never provider guarantees. */
export interface TimingObservation {
  readonly durationMs: number;
  readonly verified: boolean;
  readonly completeBatch: boolean;
}

export interface TimingReserve {
  readonly multiplier: number;
  readonly additionalMs: number;
  readonly roundToMs: number;
}

/** Require repeated, complete, verified observations; retain rollout outliers. */
export function operationalTimingBudget(samples: readonly TimingObservation[], reserve: TimingReserve) {
  if (samples.length < 2 || samples.some(sample => sample.verified !== true || sample.completeBatch !== true
    || !Number.isFinite(sample.durationMs) || sample.durationMs <= 0)
    || !Number.isFinite(reserve.multiplier) || reserve.multiplier < 1
    || !Number.isFinite(reserve.additionalMs) || reserve.additionalMs < 0
    || !Number.isFinite(reserve.roundToMs) || reserve.roundToMs <= 0) return null;
  const sorted = samples.map(sample => sample.durationMs).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const expectedMs = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  const conservativeMs = Math.ceil((sorted.at(-1)! * reserve.multiplier + reserve.additionalMs) / reserve.roundToMs) * reserve.roundToMs;
  if (!Number.isSafeInteger(conservativeMs)) return null;
  return Object.freeze({ samples: sorted.length, bestMs: sorted[0]!, expectedMs,
    longestObservedMs: sorted.at(-1)!, conservativeMs, guaranteedUpperBound: false as const });
}

/** An unknown required phase prevents a complete window or auction horizon. */
export function completeOperationalWindow(phases: readonly (number | null)[], safetyBufferMs: number): number | null {
  if (!phases.length || !Number.isFinite(safetyBufferMs) || safetyBufferMs <= 0
    || phases.some(phase => phase === null || !Number.isFinite(phase) || phase <= 0)) return null;
  const sum = (phases as readonly number[]).reduce((total, value) => total + value, safetyBufferMs);
  return Number.isSafeInteger(sum) ? sum : null;
}

export interface AuctionOperationalEvidence {
  readonly projectId: string;
  readonly capturedAtMs: number;
  readonly coveredFromMs: number;
  readonly coveredThroughMs: number;
  /** Aggregate counts only; no auction IDs, bid contents or account data. */
  readonly starts: number | null;
  readonly ends: number | null;
  readonly schedulerEnabled: boolean;
  readonly schedulerLastSuccessAtMs: number | null;
  /** A successful Scheduler HTTP attempt does not establish these counts. */
  readonly unresolvedSchedulerIncidents: number | null;
  readonly unresolvedLifecycleErrors: number | null;
}

/** A fresh, complete nonpersonal precheck is necessary; it never arms activation. */
export function assessAuctionOperationalPrecheck(evidence: AuctionOperationalEvidence,
  window: { readonly fromMs: number | null; readonly throughMs: number | null },
  nowMs: number, maximumEvidenceAgeMs: number) {
  const reasons: string[] = [];
  const validWindow = window.fromMs !== null && window.throughMs !== null
    && Number.isFinite(window.fromMs) && Number.isFinite(window.throughMs) && window.fromMs < window.throughMs;
  if (!validWindow) reasons.push("Measured exclusion window required.");
  if (!Number.isFinite(nowMs) || !Number.isFinite(maximumEvidenceAgeMs) || maximumEvidenceAgeMs <= 0
    || !Number.isFinite(evidence.capturedAtMs) || evidence.capturedAtMs > nowMs
    || nowMs - evidence.capturedAtMs > maximumEvidenceAgeMs) reasons.push("Fresh aggregate evidence required.");
  if (evidence.projectId !== "takeme-52b80") reasons.push("Confirmed production metadata identity required.");
  if (validWindow && (!Number.isFinite(evidence.coveredFromMs) || !Number.isFinite(evidence.coveredThroughMs)
    || evidence.coveredFromMs > window.fromMs! || evidence.coveredThroughMs < window.throughMs!)) {
    reasons.push("Aggregate query must cover the entire exclusion interval.");
  }
  for (const key of ["starts", "ends", "unresolvedSchedulerIncidents", "unresolvedLifecycleErrors"] as const) {
    if (!Number.isSafeInteger(evidence[key]) || evidence[key] !== 0) reasons.push(`${key} must be a verified zero count.`);
  }
  if (evidence.schedulerEnabled !== true || evidence.schedulerLastSuccessAtMs === null
    || !Number.isFinite(evidence.schedulerLastSuccessAtMs) || evidence.schedulerLastSuccessAtMs > nowMs
    || nowMs - evidence.schedulerLastSuccessAtMs > maximumEvidenceAgeMs) reasons.push("Recent successful lifecycle scheduling required.");
  return Object.freeze({ ready: reasons.length === 0, reasons: Object.freeze(reasons), activationAuthorized: false as const });
}
