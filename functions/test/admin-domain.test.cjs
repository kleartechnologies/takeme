const test = require("node:test");
const assert = require("node:assert/strict");
const { adminRange, completedValue, averageSen, ctr, tierDistribution } = require("../lib/admin-domain");

test("date presets and custom Malaysia dates are bounded", () => {
  const now = new Date("2026-09-20T06:00:00Z");
  assert.equal(adminRange({ preset: "today" }, now).start.toISOString(), "2026-09-19T16:00:00.000Z");
  assert.equal(adminRange({ preset: "7d" }, now).start.toISOString(), "2026-09-13T16:00:00.000Z");
  assert.equal(adminRange({ preset: "custom", from: "2026-09-01", to: "2026-09-02" }, now).end.toISOString(), "2026-09-02T16:00:00.000Z");
  assert.throws(() => adminRange({ preset: "custom", from: "2026-02-30", to: "2026-03-01" }, now));
});
test("GMV uses only legitimate completed transaction integer sen", () => {
  const records = [
    { status: "completed", amountSen: 12050, buyerId: "a", sellerId: "b" },
    { status: "in_progress", amountSen: 999900, buyerId: "a", sellerId: "b" },
    { status: "cancelled", amountSen: 50000, buyerId: "a", sellerId: "b" },
    { status: "disputed", amountSen: 75000, buyerId: "a", sellerId: "b" },
    { status: "completed", amountSen: 1000.5, buyerId: "a", sellerId: "b" },
    { status: "completed", amountSen: 100000, buyerId: "a", sellerId: "a" },
  ];
  assert.equal(completedValue(records), 12050);
  assert.equal(averageSen(12050, 1), 12050);
  assert.equal(averageSen(0, 0), null);
});
test("CTR, tiers and empty-state arithmetic are honest", () => {
  assert.equal(ctr(5, 100), 5);
  assert.equal(ctr(0, 0), null);
  assert.deepEqual(tierDistribution({ silver: 2 }), { bronze: 0, silver: 2, gold: 0, platinum: 0 });
});
