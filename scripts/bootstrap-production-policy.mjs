import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { productionEnvironment } from "../functions/src/production-environment.ts";
import { planProductionPolicyBootstrap, createProductionPolicyMirror, ProductionPolicyBootstrapError } from "../functions/src/production-policy-bootstrap.ts";
import { checkReleaseRules } from "./check-release-rules.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
try {
  const args = process.argv.slice(2);
  const apply = JSON.stringify(args) === JSON.stringify(["--apply", "--project", productionEnvironment.projectId, "--owner-approved-create-only"]);
  if (args.length && !apply && JSON.stringify(args) !== JSON.stringify(["--dry-run"])) throw new Error("Use default/--dry-run, or the exact owner-approved create-only production operation. Policy/version/approval overrides are refused.");
  const runtime = { env: process.env, appProjectId: productionEnvironment.projectId, appStorageBucket: productionEnvironment.storageBucket };
  const plan = planProductionPolicyBootstrap(runtime);
  await checkReleaseRules(repository);
  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", operation: "create-only", path: plan.path, record: plan.record, cloudAccessed: false }, null, 2));
  } else {
    // SDK/ADC is loaded only after actual source policy/legal/resource/rule gates pass.
    // This script is never imported by onboarding or registered as a callable.
    const require = createRequire(new URL("../functions/package.json", import.meta.url));
    const { initializeApp } = require("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore");
    const app = initializeApp({ projectId: productionEnvironment.projectId, storageBucket: productionEnvironment.storageBucket }, "takeme-production-policy-bootstrap");
    const ref = getFirestore(app).doc(plan.path);
    const result = await createProductionPolicyMirror({ create: record => ref.create(record), read: async () => (await ref.get()).data() }, plan);
    console.log(`Production policy create-only operation: ${result}. No existing record was changed.`);
  }
} catch (error) {
  console.error(error instanceof ProductionPolicyBootstrapError ? error.message : "Production policy bootstrap refused or failed. No overwrite operation is supported.");
  process.exitCode = 1;
}
