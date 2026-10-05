import assert from "node:assert/strict";
import test from "node:test";
import { assessAuctionOperationalPrecheck, completeOperationalWindow, operationalTimingBudget } from "../functions/src/operational-timing.ts";

const verified = (durationMs: number) => ({ durationMs, verified: true, completeBatch: true });
const reserve = { multiplier: 2, additionalMs: 120_000, roundToMs: 60_000 };

test("deployment budget retains a slow rollout and requires repeated full batches", () => {
  const budget = operationalTimingBudget([verified(492_569), verified(593_693)], reserve);
  assert.equal(budget?.conservativeMs, 1_320_000);
  assert.equal(budget?.expectedMs, 543_131);
  assert.equal(budget?.longestObservedMs, 593_693);
  assert.equal(budget?.guaranteedUpperBound, false);
  assert.equal(operationalTimingBudget([verified(593_693)], reserve), null);
  assert.equal(operationalTimingBudget([verified(10), { ...verified(20), completeBatch: false }], reserve), null);
  assert.equal(operationalTimingBudget([verified(10), { ...verified(20), verified: false }], reserve), null);
});

test("invalid measurements and reserve policies cannot produce an execution budget", () => {
  for (const duration of [0, -1, NaN, Infinity]) assert.equal(operationalTimingBudget([verified(20), verified(duration)], reserve), null);
  for (const patch of [{ multiplier: 0.5 }, { multiplier: NaN }, { additionalMs: -1 }, { roundToMs: 0 }]) {
    assert.equal(operationalTimingBudget([verified(10), verified(20)], { ...reserve, ...patch }), null);
  }
});

test("unknown legal-host, propagation, or recovery phase blocks a total and auction horizon", () => {
  assert.equal(completeOperationalWindow([60_000, null, 120_000], 60_000), null);
  assert.equal(completeOperationalWindow([60_000, 120_000], 60_000), 240_000);
  assert.equal(completeOperationalWindow([], 60_000), null);
  assert.equal(completeOperationalWindow([60_000], 0), null);
});

const aggregate = { projectId: "takeme-52b80", capturedAtMs: 900, coveredFromMs: 100, coveredThroughMs: 10_000,
  starts: 0, ends: 0, schedulerEnabled: true, schedulerLastSuccessAtMs: 900,
  unresolvedSchedulerIncidents: 0, unresolvedLifecycleErrors: 0 };
const interval = { fromMs: 100, throughMs: 10_000 };

test("Scheduler success cannot substitute for unknown auction boundaries or lifecycle incidents", () => {
  for (const key of ["starts", "ends", "unresolvedSchedulerIncidents", "unresolvedLifecycleErrors"] as const) {
    assert.equal(assessAuctionOperationalPrecheck({ ...aggregate, [key]: null }, interval, 1000, 200).ready, false);
    assert.equal(assessAuctionOperationalPrecheck({ ...aggregate, [key]: 1 }, interval, 1000, 200).ready, false);
  }
  assert.equal(assessAuctionOperationalPrecheck(aggregate, { ...interval, fromMs: null }, 1000, 200).ready, false);
});

test("auction precheck refuses stale, partial, foreign or failed evidence and never authorizes activation", () => {
  for (const patch of [{ capturedAtMs: 700 }, { capturedAtMs: 1001 }, { coveredFromMs: 101 }, { coveredThroughMs: 9999 },
    { projectId: "takeme-staging-822a5" }, { schedulerEnabled: false }, { schedulerLastSuccessAtMs: null },
    { schedulerLastSuccessAtMs: 700 }]) {
    assert.equal(assessAuctionOperationalPrecheck({ ...aggregate, ...patch }, interval, 1000, 200).ready, false);
  }
  const result = assessAuctionOperationalPrecheck(aggregate, interval, 1000, 200);
  assert.equal(result.ready, true);
  assert.equal(result.activationAuthorized, false);
});
