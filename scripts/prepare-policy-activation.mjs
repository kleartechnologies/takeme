import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { legalPublicationReadiness, validateLegalPublication } from "../functions/src/legal-publication.ts";
import { planLegalLaunchDate } from "../functions/src/legal-launch-date-plan.ts";
import { productionEnvironment } from "../functions/src/production-environment.ts";
import { productionReleasePolicy, renderPolicyRules, renderProductionPolicyRulesPreview, assertFirestorePolicyRules, assertStoragePolicyRules } from "../functions/src/release-policy.ts";

// Local review output only. No Firebase SDK, credentials, cloud access or apply
// selector is loaded. Ordinary release checks reject these review rule blocks
// while the actual source remains unpublished.
const repository = fileURLToPath(new URL("../", import.meta.url));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

async function outsideGitDirectory(input) {
  if (!path.isAbsolute(input)) throw new Error("Review output requires an absolute directory outside Git.");
  const resolved = path.join(await realpath(path.dirname(input)), path.basename(input));
  for (let parent = resolved; ; parent = path.dirname(parent)) {
    if (existsSync(path.join(parent, ".git"))) throw new Error("Review output must remain outside every Git checkout.");
    if (parent === path.dirname(parent)) break;
  }
  await mkdir(resolved, { mode: 0o700 });
  if (!(await lstat(resolved)).isDirectory()) throw new Error("Review output must be an ordinary new directory.");
  return resolved;
}

try {
  const args = process.argv.slice(2);
  if (![2, 4].includes(args.length) || args[0] !== "--output" || args.length === 4 && args[2] !== "--launch-date") {
    throw new Error("Use --output <new-directory-outside-Git> with optional --launch-date YYYY-MM-DD. No apply or approval override exists.");
  }
  const dates = planLegalLaunchDate(args.length === 4 ? args[3] : null);
  if (productionReleasePolicy.termsVersion !== "1.0" || productionReleasePolicy.privacyVersion !== "1.0" || productionReleasePolicy.minimumAge !== 18) {
    throw new Error("The reviewed V1 activation plan requires the central intended versions and age to match.");
  }
  const current = renderPolicyRules(), intended = renderProductionPolicyRulesPreview();
  const fire = await readFile(path.join(repository, "firestore.rules"), "utf8");
  const storage = await readFile(path.join(repository, "storage.rules"), "utf8");
  assertFirestorePolicyRules(fire);
  assertStoragePolicyRules(storage);
  const reviewHeader = "// REVIEW ONLY: not deployment-approved. Final source/legal approvals and coordinated rollout are required.\n";
  const outputs = {
    "firestore.production-review.rules": reviewHeader + fire.replace(current, intended),
    "storage.production-review.rules": reviewHeader + storage.replace(current, intended),
  };
  const sourceFiles = ["functions/src/release-policy.ts", "functions/src/legal-publication.ts", "functions/src/legal-launch-date-plan.ts", "firestore.rules", "storage.rules", "src/content/terms.ts", "src/content/privacy.ts", "src/content/privacy-bm.ts", "src/content/marketplace-rules.ts"];
  const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, digest(await readFile(path.join(repository, file)))])));
  const payload = {
    releaseTarget: "production", projectId: productionEnvironment.projectId, publicationApproved: true,
    termsVersion: productionReleasePolicy.termsVersion, privacyVersion: productionReleasePolicy.privacyVersion, minimumAge: productionReleasePolicy.minimumAge,
  };
  const plan = {
    purpose: "policy-activation-review", deployable: false, cloudAccessed: false, activationApproved: false,
    actualSource: { publicationApproved: productionReleasePolicy.publicationApproved, effectiveDate: legalPublicationReadiness.effectiveDate, lastUpdated: legalPublicationReadiness.lastUpdated },
    launchDateProposal: dates,
    futureDocument: { path: "releasePolicies/current", record: payload, written: false },
    legalBlockers: validateLegalPublication(),
    resources: productionEnvironment,
    deletionEnabled: false, paymentsEnabled: false,
    sourceHashes,
    reviewRules: Object.fromEntries(Object.entries(outputs).map(([file, text]) => [file, { sha256: digest(text), deploymentApproved: false }])),
  };
  const output = await outsideGitDirectory(args[1]);
  for (const [file, text] of Object.entries(outputs)) await writeFile(path.join(output, file), text, { flag: "wx", mode: 0o600 });
  await writeFile(path.join(output, "policy-activation-review.json"), JSON.stringify(plan, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log("Local policy activation review prepared outside Git. Source approvals/dates unchanged; nothing activated or deployed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Local policy activation preparation refused.");
  process.exitCode = 1;
}
