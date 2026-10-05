import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { transformHistoricalModule, historicalProtectedNames } from "../scripts/prepare-legacy-maintenance-bridge.mjs";

const source = `import {onCall} from 'firebase-functions/v2/https';
export const sendConversationMessage = onCall({region:'asia-southeast1', maxInstances:20}, async (request) => {
 if (!request.auth) throw new Error('original auth');
 return db.runTransaction(async tx => { const value = await tx.get(ref); tx.set(ref, request.data); return { id:value.id }; });
});
export const publicRead = onCall(async request => db.runTransaction(async tx => (await tx.get(ref)).data()));`;

test("bridge keeps original callable options/body and scopes transaction reads without policy substitution", () => {
 const result = transformHistoricalModule(source, "messaging.ts", ["sendConversationMessage"]);
 assert.deepEqual(result.found, ["sendConversationMessage"]);
 assert.match(result.source, /onCall\(\{region:'asia-southeast1', maxInstances:20\}, async \(request\) =>/);
 assert.match(result.source, /return invokeHistoricalProtectedWrite\(request, async \(\) =>/);
 assert.match(result.source, /if \(!request.auth\) throw new Error\('original auth'\)/);
 assert.match(result.source, /runHistoricalMaintenanceTransaction\(db, async tx =>/);
 assert.equal(result.transactionSites.length, 2, "Read helper remains unscoped at runtime.");
 assert.doesNotMatch(result.source, /releasePolicies|eligibility|acceptance|setGlobalOptions/);
});
test("only reviewed ignored standalone create/set results are converted, preserving merge/create semantics", () => {
 for (const [name, method, args] of [["createFixedListingDraft", "create", "data"], ["createAuctionListing", "create", "data"], ["setNotificationPreference", "set", "data, {merge:true}"]]) {
  const result = transformHistoricalModule(`export const ${name} = onCall(async request => { await ref.${method}(${args}); return {ok:true}; });`, "index.ts", [name]);
  assert.equal(result.directWrites.length, 1);
  assert.ok(result.source.includes(`writeHistoricalMaintenanceDocument(ref, "${method}", ${args})`));
 }
 assert.throws(() => transformHistoricalModule(`export const createFixedListingDraft = onCall(async request => { const result = await ref.create(data); });`, "index.ts", ["createFixedListingDraft"]), /consumed WriteResult/);
 assert.throws(() => transformHistoricalModule(`export const sendConversationMessage = onCall(async request => { await ref.set(data); });`, "index.ts", ["sendConversationMessage"]), /Unreviewed standalone/);
});
test("policy-aware preparation factory checks maintenance before the original policy guard", () => {
 const result = transformHistoricalModule(`function call(handler,mutation) { return onCall(async request => { if (!request.auth) throw new Error('auth'); if (mutation) await policy(); return handler(request); }); }`, "account-lifecycle.ts", []);
 assert.equal(result.factory, true);
 assert.ok(result.source.indexOf("assertHistoricalProtectedWritesAvailable()") < result.source.indexOf("await policy()"));
});
test("only creation/publication opt into the historical auction admission scope", () => {
 for (const name of ["createAuctionListing", "publishAuctionListing", "placeBid", "updateAuctionListing", "sendConversationMessage"]) {
  const result = transformHistoricalModule(`export const ${name} = onCall(async request => { return db.runTransaction(async tx => { tx.set(ref, data); }); });`, "index.ts", [name]);
  assert.equal(result.source.includes("}, true);"), ["createAuctionListing", "publishAuctionListing"].includes(name));
 }
});
test("generator rejects unknown constructor/callback/double wrapping and guards nested-module imports", () => {
 assert.throws(() => transformHistoricalModule("export const placeBid = unknown(async request => {});", "index.ts", ["placeBid"]), /constructor/);
 assert.throws(() => transformHistoricalModule("export const placeBid = onCall(request => ({}));", "index.ts", ["placeBid"]), /callback/);
 assert.throws(() => transformHistoricalModule("// legacy-maintenance-bridge", "index.ts", []), /double wrapping/);
 const result = transformHistoricalModule(source, "helper/module.ts", ["sendConversationMessage"]);
 assert.match(result.source, /from "\.\.\/legacy-maintenance-bridge"/);
 assert.equal(historicalProtectedNames.length, 35);assert.equal(new Set(historicalProtectedNames).size,35);
});
test("generator has no credentials/cloud/deploy implementation, requires exact source revisions and refuses Git output", async () => {
 const value = await readFile(new URL("../scripts/prepare-legacy-maintenance-bridge.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(value, /fetch\(|spawn\(|exec\(|applicationDefault\(|cert\(|process\.env/);
 for (const marker of ["codeTreeMatchesRepresentative", "versionedArchiveBytesMatched", "archiveSha256", "binding.revision", "deploymentApproved: false", "Review output cannot be inside Git"]) assert.ok(value.includes(marker));
});
