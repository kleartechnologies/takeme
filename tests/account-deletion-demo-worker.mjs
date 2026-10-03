// Local Cloud Scheduler substitute. No credentials or production configuration.
import { createRequire } from "node:module";
process.env.GCLOUD_PROJECT = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const app = initializeApp({ projectId: "demo-takeme", storageBucket: "demo-takeme.firebasestorage.app" });
const { runDeletionMaintenance } = require("../functions/lib/account-deletion.js");
let stopped = false;
process.on("SIGINT", () => { stopped = true; });
process.on("SIGTERM", () => { stopped = true; });
console.log("TAKEME deletion maintenance: demo-takeme, loopback emulators only.");
try {
  do {
    try { await runDeletionMaintenance(); }
    catch { console.error("Demo maintenance did not complete; operations remain retryable. Inspect restricted operation status."); }
    if (!process.argv.includes("--once") && !stopped) await new Promise((resolve) => setTimeout(resolve, 30_000));
  } while (!stopped && !process.argv.includes("--once"));
} finally { await deleteApp(app); }
