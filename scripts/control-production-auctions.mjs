import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { productionEnvironment } from "../functions/src/production-environment.ts";
import { planProductionAuctionControl, assertAuctionControlSource, applyProductionAuctionControl, readZeroAuctionCounts } from "../functions/src/production-auction-control.ts";
import { checkReleaseRules } from "./check-release-rules.mjs";

// Future operator tool only. No invocation is authorized by preparation of this file.
// Plan never loads SDK/ADC. Check returns aggregates only. Apply writes one fixed
// control with strict CAS, never policy, listings, clocks or customer records.
try {
  const args = process.argv.slice(2), mode = args[0];
  let index = 1, plan, updateTime;
  if (mode === "--check") {
    if (args[index++] !== "--expected-update-time") throw new Error("Freeze token required.");
    updateTime = args[index++];
  } else {
    if (!["--plan", "--apply"].includes(mode) || args[index++] !== "--action") throw new Error("Invalid mode.");
    const action = args[index++];
    if (!["freeze", "restore"].includes(action) || args[index++] !== "--expected-state") throw new Error("Explicit action/state required.");
    const state = args[index++];
    updateTime = null;
    if (state !== "absent") {
      if (args[index++] !== "--expected-update-time") throw new Error("Existing token required.");
      updateTime = args[index++];
    }
    plan = planProductionAuctionControl({ env: process.env, appProjectId: productionEnvironment.projectId, appStorageBucket: productionEnvironment.storageBucket }, action, state, updateTime);
  }
  if (args[index++] !== "--project" || args[index++] !== productionEnvironment.projectId) throw new Error("Exact production project required.");
  if (mode === "--apply" && args[index++] !== (plan.action === "freeze" ? "--owner-approved-auction-freeze" : "--owner-approved-auction-restore")) throw new Error("Explicit operation approval required.");
  if (index !== args.length) throw new Error("Unexpected argument.");
  if (mode === "--plan") {
    console.log(JSON.stringify({ mode: "plan", cloudAccessed: false, ...plan, operationalCoverageVerified: false, activationAuthorized: false }, null, 2));
  } else {
    // Identity/source validation precedes any credential loading or cloud request.
    if (mode === "--check") {
      planProductionAuctionControl({ env: process.env, appProjectId: productionEnvironment.projectId, appStorageBucket: productionEnvironment.storageBucket }, "freeze", "on", updateTime);
    } else {
      assertAuctionControlSource(plan);
      if (plan.action === "restore") await checkReleaseRules(fileURLToPath(new URL("../", import.meta.url)));
    }
    const require = createRequire(new URL("../functions/package.json", import.meta.url));
    const { initializeApp } = require("firebase-admin/app"), { getFirestore } = require("firebase-admin/firestore");
    const app = initializeApp({ projectId: productionEnvironment.projectId, storageBucket: productionEnvironment.storageBucket }, "takeme-auction-creation-control");
    const db = getFirestore(app), control = db.doc("releaseControls/auctionCreation");
    const snapshot = value => ({ exists: value.exists, data: value.data(), updateTime: value.updateTime
      ? `${value.updateTime.seconds}.${String(value.updateTime.nanoseconds).padStart(9, "0")}` : null });
    const readAuctionControl = async () => snapshot(await control.get());
    const result = mode === "--check" ? await readZeroAuctionCounts({ readAuctionControl,
      countPublished: async status => (await db.collection("listings").where("status", "==", "active").where("auctionStatus", "==", status).count().get()).data().count,
    }, updateTime) : await applyProductionAuctionControl({ readAuctionControl,
      transaction: operation => db.runTransaction(tx => operation({
        readAuctionControl: async () => snapshot(await tx.get(control)),
        readMaintenance: async () => (await tx.get(db.doc("releaseControls/current"))).data(),
        readPolicy: async () => (await tx.get(db.doc("releasePolicies/current"))).data(),
        create: record => { tx.create(control, record); }, replace: record => { tx.set(control, record); },
      })),
    }, plan);
    console.log(JSON.stringify({ ...result, verifiedAt: new Date().toISOString(), operationalCoverageVerified: false, activationAuthorized: false }, null, 2));
  }
} catch {
  console.error("Auction operation refused or outcome unknown. Keep the safe state; inspect the fixed control before an explicitly approved retry. No automatic repair/reopen.");
  process.exitCode = 1;
}
