import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PROTECTED_WRITE_MAINTENANCE_MESSAGE,
  ProtectedWriteMaintenanceError,
  protectedWriteMaintenanceMessage,
  requireProtectedWritesAvailable,
} from "../src/lib/protected-write-maintenance.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("maintenance uses the exact safe copy and a distinct typed refusal", () => {
  const error = new ProtectedWriteMaintenanceError();
  assert.equal(error.message, "TAKEME is completing a short system update. Browsing is still available, but this action is temporarily unavailable. Please try again shortly.");
  assert.equal(error.code, "functions/failed-precondition");
  assert.deepEqual(error.details, { reason: "protected-writes-paused" });
  assert.equal(protectedWriteMaintenanceMessage(error), PROTECTED_WRITE_MAINTENANCE_MESSAGE);
  assert.equal(protectedWriteMaintenanceMessage({ code: "failed-precondition", details: { reason: "protected-writes-paused" } }), error.message);
  for (const value of [null, undefined, "protected-writes-paused", new Error("Account restricted"),
    { code: "functions/permission-denied", details: { reason: "protected-writes-paused" } },
    { code: "functions/failed-precondition", details: { reason: "account-policy-required" } }]) {
    assert.equal(protectedWriteMaintenanceMessage(value), null);
  }
});

test("upload/service wrapper causes preserve maintenance while bounded traversal stops cycles", () => {
  const wrapped = new Error("Upload wrapper", { cause: new Error("Service wrapper", { cause: new ProtectedWriteMaintenanceError() }) });
  assert.equal(protectedWriteMaintenanceMessage(wrapped), PROTECTED_WRITE_MAINTENANCE_MESSAGE);
  const cycle: { cause?: unknown } = {};
  cycle.cause = cycle;
  assert.equal(protectedWriteMaintenanceMessage(cycle), null);
  const second: { cause?: unknown } = {};
  cycle.cause = second;
  second.cause = cycle;
  assert.equal(protectedWriteMaintenanceMessage(cycle), null);
});

test("only an exact fresh OFF status permits the explicit write attempt", async () => {
  await requireProtectedWritesAvailable(async () => ({ protectedWritesPaused: false }));
  const inherited = Object.assign(Object.create({ protectedWritesPaused: false }), { unrelated: false });
  for (const value of [undefined, null, false, [], {}, inherited,
    { protectedWritesPaused: true }, { protectedWritesPaused: "false" },
    { protectedWritesPaused: 0 }, { protectedWritesPaused: false, projectId: "private" }]) {
    await assert.rejects(requireProtectedWritesAvailable(async () => value), (error: unknown) => error instanceof ProtectedWriteMaintenanceError);
  }
  await assert.rejects(requireProtectedWritesAvailable(async () => { throw new Error("Private server diagnostic"); }), (error: unknown) => {
    assert.ok(error instanceof ProtectedWriteMaintenanceError);
    assert.equal(error.message, PROTECTED_WRITE_MAINTENANCE_MESSAGE);
    assert.doesNotMatch(error.message, /Private|diagnostic/);
    return true;
  });
});

test("pause preserves user input; lifting it never replays without another explicit attempt", async () => {
  let paused = true, reads = 0, writes = 0;
  const context = { listingTitle: "Synthetic listing", message: "My unsent message", offer: "120", bid: "150", photos: ["local-preview"] };
  const expected = structuredClone(context);
  const attempt = async () => {
    await requireProtectedWritesAvailable(async () => { reads++; return { protectedWritesPaused: paused }; });
    writes++;
  };
  await assert.rejects(attempt(), ProtectedWriteMaintenanceError);
  assert.deepEqual(context, expected);
  assert.deepEqual({ reads, writes }, { reads: 1, writes: 0 });
  paused = false;
  await Promise.resolve();
  assert.equal(writes, 0, "changing the control does not queue or replay an action");
  await attempt();
  assert.deepEqual({ reads, writes }, { reads: 2, writes: 1 });
  assert.deepEqual(context, expected);
});

test("central integration checks maintenance before policy and suppresses background notices", () => {
  const wrapper = source("src/lib/services/marketplace-call.ts");
  assert.ok(wrapper.indexOf("await assertProtectedWritesAvailable()") < wrapper.indexOf("await assertCurrentPolicy("));
  assert.ok(wrapper.indexOf("if (maintenance)") < wrapper.indexOf("window.dispatchEvent(new CustomEvent(ACCOUNT_ELIGIBILITY_EVENT"));
  assert.match(wrapper, /checkMaintenance: options\.background !== true && isProtectedMarketplaceCallable\(name\)/);
  assert.match(wrapper, /notifyMaintenance: options\.background !== true/);
  assert.match(wrapper, /throw new ProtectedWriteMaintenanceError\(\{ cause: error \}\)/);
  const hook = source("src/components/auth/auth-provider.tsx").split("export function useProtectedMarketplaceAction()")[1];
  assert.ok(hook.indexOf("await assertProtectedWritesAvailable()") < hook.indexOf("if (!uid)"));
  assert.ok(hook.indexOf("await assertProtectedWritesAvailable()") < hook.indexOf("await refreshSetup()"));
  assert.doesNotMatch(hook, /setTimeout|setInterval|logout\(/);
  const status = source("src/lib/services/protected-write-status.ts");
  assert.match(status, /"getProtectedWriteStatus"/);
  assert.doesNotMatch(status, /getAccountSetupStatus|setTimeout|setInterval|localStorage|sessionStorage/);
});

test("notice is dismissible nonmodal feedback and keeps navigation and auth untouched", () => {
  const notice = source("src/components/layout/protected-write-notice.tsx");
  assert.match(notice, /role="status" aria-live="polite"/);
  assert.match(notice, /Continue browsing/);
  assert.match(notice, /Dismiss system update notice/);
  assert.match(notice, /previousFocus\.current\.focus\(\)/);
  assert.match(notice, /removeEventListener\(PROTECTED_WRITE_MAINTENANCE_EVENT, show\)/);
  assert.doesNotMatch(notice, /role="dialog"|aria-modal|router\.|href=|logout\(|setInterval|setTimeout/);
  const sheet = source("src/components/ui/action-sheet.tsx");
  assert.match(sheet, /!dialog\.current\?\.contains\(document\.activeElement\)/);
  assert.match(sheet, /\(event\.shiftKey \? last : first\)\?\.focus\(\)/);
});

test("a paused auto-seen update cannot break message reads or swallow saved write rejection", () => {
  const conversation = source("src/lib/services/conversations.ts");
  assert.match(conversation, /"markConversationSeen", \{ conversationId \}, true/);
  const view = source("src/components/messages/conversation-view.tsx");
  assert.match(view, /try \{ await markConversationSeen\(id\); \}/);
  assert.match(view, /if \(!protectedWriteMaintenanceMessage\(error\)\) throw error/);
  assert.match(view, /!autoSeenPaused\.current/);
  assert.match(view, /autoSeenPaused\.current = true/);
  const saved = source("src/lib/services/saved.ts");
  const catchClause = saved.slice(saved.indexOf("catch (error)"));
  assert.ok(catchClause.indexOf("if (protectedWriteMaintenanceMessage(error)) throw error") < catchClause.indexOf("getDoc(reference)"));
  const tracking = source("src/lib/services/intelligence.ts");
  assert.match(tracking, /"trackMarketplaceEvent", options/);
  assert.match(tracking, /trackMarketplaceEvent\(event, \{ background: true \}\)\.catch/);
});
