const assert = require("node:assert/strict");
const { test } = require("node:test");
const { CADENCE_POLICIES, planActionCadence } = require("../lib/action-cadence-policy");
test("each normal action allows its documented rolling limit, then waits", () => {
  for (const [action, policy] of Object.entries(CADENCE_POLICIES)) {
    let events = [];
    for (let i = 0; i < policy.limit; i++) {
      const result = planActionCadence(action, events, 100_000);
      assert.equal(result.allowed, true); events = result.events;
    }
    assert.deepEqual(planActionCadence(action, events, 100_000), { allowed: false, retryAfterMs: 60_000 });
    assert.equal(planActionCadence(action, events, 160_000).allowed, true);
  }
});
test("sliding window does not reset at a fixed clock boundary and state stays bounded", () => {
  let events = Array.from({ length: 10 }, (_, i) => ({ at: 100_000 + i * 1_000 }));
  assert.equal(planActionCadence("listing", events, 159_999).retryAfterMs, 1);
  const next = planActionCadence("listing", events, 160_000);
  assert.equal(next.allowed, true); assert.equal(next.events.length, 10);
});
test("offer cadence protects the same listing while allowing other legitimate negotiations", () => {
  const events = Array.from({ length: 8 }, () => ({ at: 100_000, resource: "same" }));
  assert.deepEqual(planActionCadence("offer", events, 100_001, { resource: "same" }), { allowed: false, retryAfterMs: 29_999 });
  assert.equal(planActionCadence("offer", events, 100_001, { resource: "other" }).allowed, true);
  assert.equal(planActionCadence("offer", events, 130_000, { resource: "same" }).allowed, true);
});
test("an upload batch counts every start, without imposing a stored-object quota", () => {
  const events = Array.from({ length: 60 }, () => ({ at: 100_000 }));
  assert.equal(planActionCadence("upload", events, 100_001, { amount: 4 }).events.length, 64);
  assert.equal(planActionCadence("upload", events, 100_001, { amount: 5 }).allowed, false);
  assert.equal(planActionCadence("upload", events, 160_000, { amount: 8 }).allowed, true);
});
test("corrupt or future server state fails closed; invalid amounts never expand arrays", () => {
  for (const events of [[{ at: NaN }], [{ at: 101 }], Array.from({ length: 11 }, () => ({ at: 1 }))]) assert.equal(planActionCadence("listing", events, 100).allowed, false);
  for (const amount of [0, -1, 1.5, 65]) assert.throws(() => planActionCadence("upload", [], 100, { amount }));
});
