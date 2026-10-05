import { createRequire } from "node:module";
import { productionEnvironment } from "../functions/src/production-environment.ts";
import { planProductionMaintenance, assertMaintenanceApplySource, applyProductionMaintenance, MaintenanceControlError } from "../functions/src/production-maintenance-control.ts";
import { checkReleaseRules } from "./check-release-rules.mjs";
import { fileURLToPath } from "node:url";

// Operator-only fixed-document control. Dry-run never loads SDK/ADC. No callable,
// environment approval override, broad merge, delete, timer or automatic reopen.
try {
  const args = process.argv.slice(2);
  if (![7, 8, 9, 10].includes(args.length) || !["--plan", "--apply"].includes(args[0])
    || args[1] !== "--action" || !["enable", "disable"].includes(args[2])
    || args[3] !== "--expected-state" || !["absent", "off", "on"].includes(args[4])) throw new Error("Invalid operator arguments.");
  const apply = args[0] === "--apply", action = args[2], state = args[4];
  let index = 5, updateTime = null;
  if (state !== "absent") {
    if (args[index++] !== "--expected-update-time") throw new Error("Existing control token is required.");
    updateTime = args[index++];
  }
  if (args[index++] !== "--project" || args[index++] !== productionEnvironment.projectId) throw new Error("Exact production project is required.");
  if (apply && args[index++] !== (action === "enable" ? "--owner-approved-maintenance" : "--owner-approved-reopen")) throw new Error("Explicit operation approval is required.");
  if (index !== args.length) throw new Error("Unexpected operator argument.");
  const plan = planProductionMaintenance({ env: process.env, appProjectId: productionEnvironment.projectId, appStorageBucket: productionEnvironment.storageBucket }, action, state, updateTime);
  if (!apply) {
    console.log(JSON.stringify({ mode: "plan", cloudAccessed: false, ...plan,
      reopenSourceQualified: false, operationalCoverageVerified: false,
      warning: "Plan only. Inspect live enforcement, record state/token and rollback readiness before separately approving apply." }, null, 2));
  } else {
    assertMaintenanceApplySource(plan);
    if (action === "disable") await checkReleaseRules(fileURLToPath(new URL("../", import.meta.url)));
    // Production SDK and existing operator credentials are loaded only after
    // exact resource/CAS/source gates. The script never creates credentials.
    const require = createRequire(new URL("../functions/package.json", import.meta.url));
    const { initializeApp } = require("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore");
    const app = initializeApp({ projectId: productionEnvironment.projectId, storageBucket: productionEnvironment.storageBucket }, "takeme-production-maintenance-control");
    const db = getFirestore(app), control = db.doc("releaseControls/current"), policy = db.doc("releasePolicies/current");
    const snapshot = value => ({ exists: value.exists, data: value.data(),
      updateTime: value.updateTime ? `${value.updateTime.seconds}.${String(value.updateTime.nanoseconds).padStart(9, "0")}` : null });
    const result = await applyProductionMaintenance({
      transaction: operation => db.runTransaction(tx => operation({
        readControl: async () => snapshot(await tx.get(control)),
        readPolicy: async () => (await tx.get(policy)).data(),
        createControl: record => { tx.create(control, record); },
        replaceControl: record => { tx.set(control, record); },
      })),
      readControl: async () => snapshot(await control.get()),
    }, plan);
    // Safe receipt only: source/time/resource/control, never authentication tokens, SDK config or
    // private headers. Store receipts outside Git; this is not coverage proof.
    console.log(JSON.stringify({ ...result, verifiedAt: new Date().toISOString(), operationalCoverageVerified: false }, null, 2));
  }
} catch (error) {
  console.error(error instanceof MaintenanceControlError ? error.message : "Maintenance control refused or failed. Stop; inspect the fixed control before retrying. No automatic repair is supported.");
  process.exitCode = 1;
}
