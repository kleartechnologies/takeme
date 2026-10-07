import { lstat, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import ts from "typescript";
import { stagingEnvironment } from "../functions/src/staging-environment.ts";

// Owner-confirmed preview identity. These are resource identifiers, not credentials.
export const previewWorkerIdentity = Object.freeze({
  environment: "preview", workerName: "takeme-web-preview",
  accountId: "3ade68940865285d676a83971b23b4d4",
  siteUrl: stagingEnvironment.siteUrl,
});

export function assertStagingConfiguration(configuration) {
  if (configuration.target !== "staging" || configuration.purpose !== "staging-preview"
    || configuration.useEmulators !== false || configuration.productionDeletionEnabled !== false
    || configuration.projectId !== stagingEnvironment.projectId || configuration.siteUrl !== stagingEnvironment.siteUrl
    || configuration.publicFirebase?.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== stagingEnvironment.projectId
    || configuration.publicFirebase?.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID !== stagingEnvironment.projectNumber
    || configuration.publicFirebase?.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== stagingEnvironment.authDomain
    || configuration.publicFirebase?.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET !== stagingEnvironment.storageBucket
    || configuration.storageBuckets?.length !== 1 || configuration.storageBuckets[0] !== stagingEnvironment.storageBucket
    || configuration.policy?.publicationApproved !== true || typeof configuration.stagingDeletionEnabled !== "boolean"
    || configuration.policy?.termsVersion !== stagingEnvironment.policyVersion
    || configuration.policy?.privacyVersion !== stagingEnvironment.policyVersion || configuration.policy?.minimumAge !== 18) {
    throw new Error("Preview requires the independently qualified staging configuration; production/demo/offline resources are refused.");
  }
}

export function validatePreviewWrangler(raw, configuration) {
  assertStagingConfiguration(configuration);
  const selected = raw?.env?.preview;
  if (!selected || selected.name !== previewWorkerIdentity.workerName
    || (selected.account_id ?? raw.account_id) !== previewWorkerIdentity.accountId
    || selected.main !== "workers/staging-entry.mjs"
    || typeof selected.workers_dev !== "boolean" || selected.preview_urls !== false
    || raw.workers_dev !== false || raw.preview_urls !== false
    || raw.name !== "takeme-web") throw new Error("Preview Wrangler identity or routing configuration differs from the approved local plan.");
  // A named environment may inherit routing configuration. Refuse both levels.
  for (const scope of [raw, selected]) {
    if (Object.hasOwn(scope, "route") || Object.hasOwn(scope, "routes")) throw new Error("Preview cannot configure custom domains or routes.");
  }
  const assets = selected.assets ?? raw.assets;
  if (assets?.directory !== ".open-next/assets" || assets.binding !== "ASSETS" || assets.run_worker_first !== true
    || selected.services?.length !== 1 || selected.services[0]?.binding !== "WORKER_SELF_REFERENCE"
    || selected.services[0]?.service !== previewWorkerIdentity.workerName
    || Object.keys(selected.services[0]).some(key => !["binding", "service"].includes(key)) || selected.images?.binding !== "IMAGES") {
    throw new Error("Preview assets, self-reference or Images bindings differ from the reviewed adapter configuration.");
  }
  const vars = selected.vars;
  const required = {
    TAKEME_RELEASE_TARGET: "staging", TAKEME_FIREBASE_PROJECT_ID: stagingEnvironment.projectId,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: stagingEnvironment.projectId, NEXT_PUBLIC_SITE_URL: stagingEnvironment.siteUrl,
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", TAKEME_ENABLE_PRODUCTION_DELETION: "false",
  };
  if (!vars || Object.entries(required).some(([key, value]) => vars[key] !== value)) throw new Error("Preview runtime identity must be explicitly staging-bound with production deletion disabled.");
  for (const [key, value] of Object.entries(vars)) {
    if (/EMULATOR/i.test(key) && key !== "NEXT_PUBLIC_USE_FIREBASE_EMULATORS") throw new Error("Preview runtime must not contain emulator hosts or switches.");
    if (Object.hasOwn(configuration.publicFirebase, key) && value !== configuration.publicFirebase[key]) throw new Error("Preview runtime Firebase inputs differ from the build.");
    if (/(?:TAKEME|FIREBASE|FUNCTION|SITE|STORAGE)/.test(key)
      && /takeme-52b80|(?:^|[/.])takeme\.my(?:[/:]|$)|localhost|127\.0\.0\.1|demo-takeme/i.test(String(value))) throw new Error("Preview runtime contains a forbidden production/demo/local resource.");
    if (key === "TAKEME_OFFLINE_QUALIFICATION" || key === "PROTECTED_PAYMENTS_ENABLED" && value !== "false") throw new Error("Preview runtime contains a forbidden qualification or payments flag.");
  }
  return { ...previewWorkerIdentity, main: selected.main, workersDev: selected.workers_dev, previewUrls: false,
    assets: { directory: assets.directory, binding: assets.binding, runWorkerFirst: assets.run_worker_first },
    selfReference: selected.services[0].service, imagesBinding: selected.images.binding };
}

export async function readPreviewWrangler(repository, configuration) {
  const file = path.join(repository, "wrangler.staging.jsonc");
  if (!(await lstat(file)).isFile()) throw new Error("Preview Wrangler configuration must be an ordinary local file.");
  const text = await readFile(file, "utf8");
  const parsed = ts.parseConfigFileTextToJson("wrangler.staging.jsonc", text);
  if (parsed.error) throw new Error("Preview Wrangler configuration is malformed.");
  return validatePreviewWrangler(parsed.config, configuration);
}

// Only an approval/evidence check for a future plan. It does not call Cloudflare
// or establish Access protection; owner evidence must be reviewed independently.
export function validatePreviewPlanApproval(env, evidence, revision, branch, deploymentContext, now = Date.now()) {
  if (!deploymentContext || Object.entries(previewWorkerIdentity).some(([key, value]) => deploymentContext[key] !== value)
    || deploymentContext.main !== "workers/staging-entry.mjs" || typeof deploymentContext.workersDev !== "boolean"
    || deploymentContext.previewUrls !== false || deploymentContext.selfReference !== previewWorkerIdentity.workerName
    || deploymentContext.assets?.directory !== ".open-next/assets" || deploymentContext.assets?.binding !== "ASSETS"
    || deploymentContext.assets?.runWorkerFirst !== true || deploymentContext.imagesBinding !== "IMAGES") throw new Error("Preview plan requires its validated staging deployment context.");
  if (env.TAKEME_PREVIEW_DEPLOYMENT_APPROVED !== "true") throw new Error("A separate owner preview deployment approval is required to prepare an approved deployment plan.");
  if (!/^[a-f0-9]{40}$/.test(revision) || branch !== "staging"
    || env.WORKERS_CI_BRANCH !== undefined && env.WORKERS_CI_BRANCH !== "staging"
    || env.WORKERS_CI_COMMIT_SHA !== undefined && env.WORKERS_CI_COMMIT_SHA !== revision) throw new Error("Preview plan requires the staging branch and matching Git revision; main/unknown branches are refused.");
  const e = evidence;
  const anonymousBlocked = e && ([401, 403].includes(e.anonymousStatus)
    || e.anonymousStatus === 302 && e.anonymousRedirectOrigin === e.accessTeamDomain);
  if (!e || e.accountId !== previewWorkerIdentity.accountId || e.environment !== "preview"
    || e.workerName !== previewWorkerIdentity.workerName || e.siteUrl !== previewWorkerIdentity.siteUrl || e.revision !== revision
    || e.approvedTestersConfirmed !== true || e.anonymousDenied !== true
    || !anonymousBlocked
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(e.applicationId ?? "")
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(e.policyId ?? "")) throw new Error("Preview Access evidence is missing, mismatched or incomplete.");
  const checkedAt = Date.parse(e.denialCheckedAt);
  if (!Number.isFinite(checkedAt) || checkedAt > now || now - checkedAt > 24 * 60 * 60 * 1000) throw new Error("Preview Access denial evidence must be reviewed within the last 24 hours.");
  if (!/^https:\/\/[a-z0-9][a-z0-9-]{0,62}\.cloudflareaccess\.com$/.test(e.accessTeamDomain ?? "")
    || !/^[a-f0-9]{64}$/i.test(e.accessAud ?? "") || env.CF_ACCESS_TEAM_DOMAIN !== e.accessTeamDomain || env.CF_ACCESS_AUD !== e.accessAud) throw new Error("Preview Access runtime identity must match the reviewed evidence.");
  if (e.testerAllowlistSha256 !== previewTesterFingerprint(env.CF_ACCESS_ALLOWED_EMAILS)) throw new Error("Preview Access tester runtime input must match the owner-reviewed allowlist evidence.");
  return { environment: "preview", workerName: previewWorkerIdentity.workerName, revision,
    workersDev: deploymentContext.workersDev, routingActivationRequired: !deploymentContext.workersDev, deploymentExecuted: false };
}

export function assertPreviewWorkingTreeClean(status) {
  if (typeof status !== "string" || status.trim()) throw new Error("Preview plan requires a reviewed clean working tree, including nonignored untracked files.");
}

export function previewTesterFingerprint(value) {
  let emails;
  try { emails = JSON.parse(value || ""); } catch { throw new Error("Preview Access tester runtime input is missing or invalid."); }
  if (!Array.isArray(emails) || !emails.length || emails.length > 20
    || emails.some(email => typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("Preview Access tester runtime input is missing or invalid.");
  const normalized = emails.map(email => email.toLowerCase()).sort();
  if (new Set(normalized).size !== normalized.length) throw new Error("Preview Access tester runtime input must not contain duplicates.");
  // Records a binding hash only. Never return or print personal tester addresses.
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
