import { stagingFirebaseProjectId, stagingPolicyVersion, stagingStorageBucket } from "./staging-environment.ts";

/** The sole policy-version source. Test approval never grants production publication. */
export type ReleaseTarget = "demo" | "staging" | "production";
export interface ReleasePolicy {
  readonly publicationApproved: boolean;
  readonly termsVersion: string | null;
  readonly privacyVersion: string | null;
  readonly minimumAge: 18;
}

export const demoReleasePolicy: Readonly<ReleasePolicy> = Object.freeze({
  publicationApproved: true, termsVersion: "1.0-draft", privacyVersion: "1.0-draft", minimumAge: 18,
});

// Approval is limited to synthetic accounts in the exact, protected staging environment.
export const stagingReleasePolicy: Readonly<ReleasePolicy> = Object.freeze({
  publicationApproved: true, termsVersion: stagingPolicyVersion, privacyVersion: stagingPolicyVersion, minimumAge: 18,
});

// Final versions and publication approval require a separate owner/legal decision.
export const productionReleasePolicy: Readonly<ReleasePolicy> = Object.freeze({
  publicationApproved: false, termsVersion: null, privacyVersion: null, minimumAge: 18,
});

export function getReleasePolicy(target: ReleaseTarget): Readonly<ReleasePolicy> {
  return target === "demo" ? demoReleasePolicy : target === "staging" ? stagingReleasePolicy : productionReleasePolicy;
}

export function validateProductionPolicy(policy: ReleasePolicy = productionReleasePolicy): string[] {
  const issues: string[] = [];
  if (policy.publicationApproved !== true) issues.push("Final Terms and Privacy publication approval is required.");
  for (const [name, version] of [["Terms", policy.termsVersion], ["Privacy", policy.privacyVersion]] as const) {
    if (typeof version !== "string" || !version.trim()) issues.push(`${name} policy version is required.`);
    else if (version !== version.trim() || /\s/.test(version)) issues.push(`${name} policy version must be an exact version identifier.`);
    else if (/draft|demo|test|staging/i.test(version)) issues.push(`${name} policy version must be a final published version.`);
  }
  if (policy.minimumAge !== 18) issues.push("The approved V1 age requirement is 18.");
  return issues;
}

/** Build qualification can retain an honest unpublished/null policy; it grants no acceptance. */
export function validateProductionPolicyConfiguration(policy: ReleasePolicy): string[] {
  if (policy.publicationApproved === true) return validateProductionPolicy(policy);
  const issues: string[] = [];
  if (policy.publicationApproved !== false) issues.push("Production policy publication intent must be explicit.");
  if (policy.minimumAge !== 18) issues.push("The approved V1 age requirement is 18.");
  for (const [name, version] of [["Terms", policy.termsVersion], ["Privacy", policy.privacyVersion]] as const) {
    if (version !== null && (typeof version !== "string" || !version || version !== version.trim() || /\s|draft|demo|test|staging/i.test(version))) issues.push(`${name} policy version must be null or an exact final version awaiting publication.`);
  }
  return issues;
}

export function policyIsConfigured(policy: ReleasePolicy): policy is ReleasePolicy & { termsVersion: string; privacyVersion: string } {
  return policy.publicationApproved === true && typeof policy.termsVersion === "string" && !!policy.termsVersion.trim()
    && policy.termsVersion === policy.termsVersion.trim() && typeof policy.privacyVersion === "string" && !!policy.privacyVersion.trim()
    && policy.privacyVersion === policy.privacyVersion.trim() && policy.minimumAge === 18;
}

const rulesStart = "    // BEGIN GENERATED RELEASE POLICY — functions/src/release-policy.ts";
const rulesEnd = "    // END GENERATED RELEASE POLICY";
function rulesString(value: string) { return JSON.stringify(value); }
/** Storage has a two-document cross-service limit: generate trusted versions rather than adding a third lookup. */
export function renderPolicyRules(): string {
  const demo = demoReleasePolicy;
  const staging = stagingReleasePolicy;
  const production = productionReleasePolicy;
  const productionClause = validateProductionPolicy(production).length ? "false" :
    `(!request.auth.token.aud.matches('demo-.*') && request.auth.token.aud != ${rulesString(stagingFirebaseProjectId)} && acceptance.termsVersion == ${rulesString(production.termsVersion!)} && acceptance.privacyVersion == ${rulesString(production.privacyVersion!)})`;
  const productionMirrorClause = validateProductionPolicy(production).length ? "false" :
    `(policy.releaseTarget == 'production' && !policy.projectId.matches('demo-.*') && policy.projectId != ${rulesString(stagingFirebaseProjectId)} && policy.termsVersion == ${rulesString(production.termsVersion!)} && policy.privacyVersion == ${rulesString(production.privacyVersion!)})`;
  return `${rulesStart}\n    function configuredAcceptance(acceptance) {\n      return acceptance.termsAcceptedAt is timestamp && acceptance.privacyAcceptedAt is timestamp\n        && acceptance.age18ConfirmedAt is timestamp && acceptance.acceptanceSource == 'web'\n        && (!('revokedAt' in acceptance) || acceptance.revokedAt == null)\n        && ((request.auth.token.aud == 'demo-takeme' && acceptance.termsVersion == ${rulesString(demo.termsVersion!)}\n          && acceptance.privacyVersion == ${rulesString(demo.privacyVersion!)})\n          || (request.auth.token.aud == ${rulesString(stagingFirebaseProjectId)} && acceptance.termsVersion == ${rulesString(staging.termsVersion!)}\n            && acceptance.privacyVersion == ${rulesString(staging.privacyVersion!)})\n          || ${productionClause});\n    }\n    function configuredReleasePolicy(policy) {\n      return policy.publicationApproved == true && policy.minimumAge == 18\n        && policy.projectId == request.auth.token.aud\n        && ((policy.releaseTarget == 'demo' && policy.projectId == 'demo-takeme'\n            && policy.termsVersion == ${rulesString(demo.termsVersion!)} && policy.privacyVersion == ${rulesString(demo.privacyVersion!)})\n          || (policy.releaseTarget == 'staging' && policy.projectId == ${rulesString(stagingFirebaseProjectId)}\n            && policy.termsVersion == ${rulesString(staging.termsVersion!)} && policy.privacyVersion == ${rulesString(staging.privacyVersion!)})\n          || ${productionMirrorClause});\n    }\n    function configuredStorageBucket(name) {\n      return (request.auth.token.aud == ${rulesString(stagingFirebaseProjectId)} && name == ${rulesString(stagingStorageBucket)})\n        || (request.auth.token.aud != ${rulesString(stagingFirebaseProjectId)}\n          && name in [request.auth.token.aud + '.appspot.com', request.auth.token.aud + '.firebasestorage.app']);\n    }\n${rulesEnd}`;
}
function assertPolicyRules(raw: string) {
  const start = raw.indexOf(rulesStart), end = raw.indexOf(rulesEnd);
  if (start < 0 || end < start || raw.slice(start, end + rulesEnd.length) !== renderPolicyRules()) {
    throw new Error("Security rules policy versions differ from the approved central release configuration.");
  }
}
export const assertStoragePolicyRules = assertPolicyRules;
export const assertFirestorePolicyRules = assertPolicyRules;
