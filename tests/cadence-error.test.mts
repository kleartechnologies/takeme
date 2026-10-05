import { test } from "node:test";
import assert from "node:assert/strict";
import { cadenceErrorMessage, CADENCE_ERROR_MESSAGE } from "../src/lib/cadence-error.ts";
test("cadence errors expose only safe copy and preserve pipeline causes", () => {
  const failure = { code: "functions/resource-exhausted", details: { reason: "cadence-limit", retryAfterMs: 900, privateCounter: 100 } };
  assert.equal(cadenceErrorMessage(failure), CADENCE_ERROR_MESSAGE);
  assert.equal(cadenceErrorMessage(new Error("pipeline", { cause: failure })), CADENCE_ERROR_MESSAGE);
  assert.equal(cadenceErrorMessage({ code: "functions/resource-exhausted", details: { reason: "business-quota" } }), null);
  assert.equal(cadenceErrorMessage(null), null);
});
