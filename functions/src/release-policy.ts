/** The sole policy-version source. Draft approval is limited to demo emulators. */
export type ReleaseTarget = "demo" | "production";
export interface ReleasePolicy {
  readonly publicationApproved: boolean;
  readonly termsVersion: string | null;
  readonly privacyVersion: string | null;
  readonly minimumAge: 18;
}

export const demoReleasePolicy: Readonly<ReleasePolicy> = Object.freeze({
  publicationApproved: true, termsVersion: "1.0-draft", privacyVersion: "1.0-draft", minimumAge: 18,
});

// Final versions and publication approval require a separate owner/legal decision.
export const productionReleasePolicy: Readonly<ReleasePolicy> = Object.freeze({
  publicationApproved: false, termsVersion: null, privacyVersion: null, minimumAge: 18,
});

export function getReleasePolicy(target: ReleaseTarget): Readonly<ReleasePolicy> {
  return target === "demo" ? demoReleasePolicy : productionReleasePolicy;
}

export function validateProductionPolicy(policy: ReleasePolicy = productionReleasePolicy): string[] {
  const issues: string[] = [];
  if (policy.publicationApproved !== true) issues.push("Final Terms and Privacy publication approval is required.");
  for (const [name, version] of [["Terms", policy.termsVersion], ["Privacy", policy.privacyVersion]] as const) {
    if (typeof version !== "string" || !version.trim()) issues.push(`${name} policy version is required.`);
    else if (/draft|demo|test/i.test(version)) issues.push(`${name} policy version must be a final published version.`);
  }
  if (policy.minimumAge !== 18) issues.push("The approved V1 age requirement is 18.");
  return issues;
}

export function policyIsConfigured(policy: ReleasePolicy): policy is ReleasePolicy & { termsVersion: string; privacyVersion: string } {
  return policy.publicationApproved === true && typeof policy.termsVersion === "string" && !!policy.termsVersion.trim()
    && typeof policy.privacyVersion === "string" && !!policy.privacyVersion.trim() && policy.minimumAge === 18;
}

const rulesStart = "    // BEGIN GENERATED RELEASE POLICY — functions/src/release-policy.ts";
const rulesEnd = "    // END GENERATED RELEASE POLICY";
function rulesString(value: string) { return JSON.stringify(value); }
/** Storage has a two-document cross-service limit: generate trusted versions rather than adding a third lookup. */
export function renderPolicyRules(): string {
  const demo = demoReleasePolicy;
  const production = productionReleasePolicy;
  const productionClause = validateProductionPolicy(production).length ? "false" :
    `(!request.auth.token.aud.matches('demo-.*') && acceptance.termsVersion == ${rulesString(production.termsVersion!)} && acceptance.privacyVersion == ${rulesString(production.privacyVersion!)})`;
  return `${rulesStart}\n    function configuredAcceptance(acceptance) {\n      return acceptance.termsAcceptedAt is timestamp && acceptance.privacyAcceptedAt is timestamp\n        && acceptance.age18ConfirmedAt is timestamp && acceptance.acceptanceSource == 'web'\n        && (!('revokedAt' in acceptance) || acceptance.revokedAt == null)\n        && ((request.auth.token.aud == 'demo-takeme' && acceptance.termsVersion == ${rulesString(demo.termsVersion!)}\n          && acceptance.privacyVersion == ${rulesString(demo.privacyVersion!)})\n          || ${productionClause});\n    }\n${rulesEnd}`;
}
function assertPolicyRules(raw: string) {
  const start = raw.indexOf(rulesStart), end = raw.indexOf(rulesEnd);
  if (start < 0 || end < start || raw.slice(start, end + rulesEnd.length) !== renderPolicyRules()) {
    throw new Error("Security rules policy versions differ from the approved central release configuration.");
  }
}
export const assertStoragePolicyRules = assertPolicyRules;
export const assertFirestorePolicyRules = assertPolicyRules;
