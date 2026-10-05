import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { productionEnvironment } from "../functions/src/production-environment.ts";
import { stagingFirebaseProjectId } from "../functions/src/staging-environment.ts";

// These are previously reviewed local captures, not a claim about today's live
// rules. This script imports no Firebase SDK, CLI, environment or credentials.
export const reviewedRuleCaptureHashes = Object.freeze({
  firestore: "879ed4f732b1f85e1d707e4c75dae0d5eae0637049ecbc770103709a3b890422",
  storage: "f1cc00f8ef675e7b44b9d037b76984817837f22ff2f081d8c8aaea24cd8a9cb2",
});
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const writeOperations = new Set(["create", "update", "delete", "write"]);
const permittedOperations = new Set(["read", "get", "list", ...writeOperations]);

/** Exact reviewed inputs contain no semicolons in their allow expressions. */
export function scanRuleAllows(raw) {
  return [...raw.matchAll(/\ballow\s+([a-z,\s]+):\s*if\s+([^;]+);/g)].map((match, ordinal) => {
    const operations = match[1].split(",").map(value => value.trim());
    if (operations.some(value => !permittedOperations.has(value))) throw new Error("Unknown rule operation; preparation refused.");
    return { ordinal, start: match.index, end: match.index + match[0].length, original: match[0],
      operations, condition: match[2].trim(), sourceLine: raw.slice(0, match.index).split("\n").length };
  });
}

/** Pure expression transformation, used only after the CLI pins the full input hashes. */
export function transformRuleAllows(raw, kind) {
  if (!["firestore", "storage"].includes(kind)) throw new Error("Unknown rule source; preparation refused.");
  const clauses = scanRuleAllows(raw), traces = [];
  let output = "", cursor = 0;
  for (const clause of clauses) {
    const writing = clause.operations.some(value => writeOperations.has(value));
    let condition = clause.condition, behavior = "preserved-read";
    if (clause.condition === "false") behavior = "preserved-deny";
    else if (writing) {
      if (clause.operations.some(value => !writeOperations.has(value))) throw new Error("Mixed permissive read/write clause; preparation refused.");
      const initialProfile = kind === "firestore" && clause.ordinal === 2 && clause.operations.length === 1
        && clause.operations[0] === "create" && clause.condition === "owns(uid) && validPublicProfile(request.resource.data, uid)";
      if (initialProfile) behavior = "preserved-initial-profile-create";
      else if (kind === "firestore") {
        condition = `maintenanceBridgeWritesAllowed() && (${clause.condition})`;
        behavior = "guarded-write";
      } else if (clause.operations.every(value => ["create", "update"].includes(value))) {
        condition = "false";
        behavior = "frozen-storage-write";
      } else if (clause.operations.length === 1 && clause.operations[0] === "delete") behavior = "preserved-storage-cleanup";
      else throw new Error("Unclassified Storage write; preparation refused.");
    }
    const replacement = condition === clause.condition ? clause.original : `allow ${clause.operations.join(", ")}: if ${condition};`;
    output += raw.slice(cursor, clause.start) + replacement;
    cursor = clause.end;
    traces.push({ ordinal: clause.ordinal, sourceLine: clause.sourceLine, operations: clause.operations, behavior,
      originalConditionSha256: digest(clause.condition), reviewConditionSha256: digest(condition) });
  }
  return { rules: output + raw.slice(cursor), traces };
}

function firestoreControlBlock() {
  return `    // REVIEW ONLY maintenance bridge: preserves historical OFF contracts.
    // This controls direct client writes only; Admin SDK Functions need a separately qualified guard.
    function maintenanceBridgeWritesAllowed() {
      return request.auth != null
        && request.auth.token.aud in ['demo-takeme', '${stagingFirebaseProjectId}', '${productionEnvironment.projectId}']
        && (!exists(/databases/$(database)/documents/releaseControls/current)
          || maintenanceBridgeUnpaused(get(/databases/$(database)/documents/releaseControls/current).data));
    }
    function maintenanceBridgeUnpaused(control) {
      return control is map
        && control.keys().hasAll(['releaseTarget', 'projectId', 'protectedWritesPaused'])
        && control.keys().hasOnly(['releaseTarget', 'projectId', 'protectedWritesPaused'])
        && control.protectedWritesPaused is bool && control.protectedWritesPaused == false
        && control.projectId == request.auth.token.aud
        && ((control.releaseTarget == 'demo' && control.projectId == 'demo-takeme')
          || (control.releaseTarget == 'staging' && control.projectId == '${stagingFirebaseProjectId}')
          || (control.releaseTarget == 'production' && control.projectId == '${productionEnvironment.projectId}'));
    }
    // Safe status is callable-only. Never publish raw control content.
    match /releaseControls/{id} { allow read, write: if false; }
`;
}

function assertCounts(traces, expected) {
  for (const [behavior, count] of Object.entries(expected)) {
    if (traces.filter(trace => trace.behavior === behavior).length !== count) throw new Error("Reviewed rule transformation inventory differs; preparation refused.");
  }
}

export function prepareMaintenanceRuleBridge(firestoreBytes, storageBytes) {
  for (const [kind, bytes] of [["firestore", firestoreBytes], ["storage", storageBytes]]) {
    if (digest(bytes) !== reviewedRuleCaptureHashes[kind]) throw new Error(`The ${kind} capture does not match its reviewed SHA-256; no output prepared.`);
  }
  const fire = transformRuleAllows(firestoreBytes.toString("utf8"), "firestore");
  const storage = transformRuleAllows(storageBytes.toString("utf8"), "storage");
  if (fire.traces.length !== 95 || storage.traces.length !== 6) throw new Error("Reviewed allow-clause totals differ; preparation refused.");
  assertCounts(fire.traces, { "guarded-write": 12, "preserved-initial-profile-create": 1 });
  assertCounts(storage.traces, { "frozen-storage-write": 2, "preserved-storage-cleanup": 2, "preserved-read": 2 });
  const anchor = "  match /databases/{database}/documents {\n";
  if (fire.rules.split(anchor).length !== 2) throw new Error("Reviewed Firestore scope differs; preparation refused.");
  const header = "// REVIEW ONLY: output-only maintenance preparation. Not approved for deployment.\n";
  const outputs = {
    "firestore.maintenance-bridge.review.rules": header + fire.rules.replace(anchor, anchor + firestoreControlBlock()),
    "storage.maintenance-freeze.review.rules": header
      + "// Static create/update freeze. Read and owner cleanup delete conditions are unchanged.\n"
      + "// Turning releaseControls OFF does not remove this freeze; separately reviewed replacement rules are required.\n" + storage.rules,
  };
  const manifest = {
    purpose: "maintenance-rule-bridge-review", deployable: false, deploymentApproved: false, cloudAccessed: false,
    productionModified: false, activationApproved: false, deletionEnabled: false,
    reviewedCaptureHashes: reviewedRuleCaptureHashes, currentRemoteParityVerified: false,
    reviewRules: Object.fromEntries(Object.entries(outputs).map(([file, rules]) => [file, { sha256: digest(rules), deploymentApproved: false }])),
    trace: { firestore: fire.traces, storage: storage.traces },
    limitations: [
      "Previously reviewed captures do not establish current deployed-rule parity.",
      "Admin SDK Functions bypass these rules; their historical guard/contract bridge must be independently qualified.",
      "Firestore preserves one authenticated, validated initial public profile create exemption.",
      "Storage create/update is statically frozen; owner cleanup deletes and public reads retain historical conditions.",
      "Storage unfreezing requires a separately reviewed rules replacement, not merely setting releaseControls OFF.",
      "No policy versions, source publication approvals, legal dates or production resources are changed.",
    ],
  };
  return { outputs, manifest };
}

async function readOrdinaryFile(input) {
  if (!path.isAbsolute(input) || !(await lstat(input)).isFile() || (await lstat(input)).isSymbolicLink()) throw new Error("Captured input must be an ordinary absolute local file.");
  return readFile(input);
}
async function newPrivateOutputDirectory(input) {
  if (!path.isAbsolute(input)) throw new Error("Review output requires an absolute new directory outside Git.");
  const output = path.join(await realpath(path.dirname(input)), path.basename(input));
  for (let directory = output; ; directory = path.dirname(directory)) {
    if (existsSync(path.join(directory, ".git"))) throw new Error("Review output must remain outside every Git checkout.");
    if (directory === path.dirname(directory)) break;
  }
  if (existsSync(output)) throw new Error("Review output directory must not already exist.");
  await mkdir(output, { mode: 0o700 });
  return output;
}
export async function runMaintenanceRuleBridge(args) {
  if (args.length !== 6) throw new Error("Use --firestore-input <reviewed-file> --storage-input <reviewed-file> --output <new-directory-outside-Git>. No apply selector exists.");
  const values = new Map();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!["--firestore-input", "--storage-input", "--output"].includes(key) || values.has(key)) throw new Error("Unknown or duplicated preparation argument; no apply or override is supported.");
    values.set(key, args[i + 1]);
  }
  const [firestore, storage] = await Promise.all([readOrdinaryFile(values.get("--firestore-input")), readOrdinaryFile(values.get("--storage-input"))]);
  const { outputs, manifest } = prepareMaintenanceRuleBridge(firestore, storage);
  const output = await newPrivateOutputDirectory(values.get("--output"));
  for (const [file, rules] of Object.entries(outputs)) await writeFile(path.join(output, file), rules, { flag: "wx", mode: 0o600 });
  await writeFile(path.join(output, "maintenance-rule-bridge.review.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runMaintenanceRuleBridge(process.argv.slice(2));
    console.log("Local maintenance rule bridge review prepared outside Git. Nothing deployed, activated or accessed remotely.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Local maintenance rule bridge preparation refused.");
    process.exitCode = 1;
  }
}
