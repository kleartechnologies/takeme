import { productionEnvironment } from "../../functions/src/production-environment.ts";
import { productionReleasePolicy, validateProductionPolicy } from "../../functions/src/release-policy.ts";
import { releasePolicyFromMirror } from "../../functions/src/policy-runtime.ts";
import { validateV1LegalDates, type V1LegalDates } from "../../functions/src/legal-launch-date-plan.ts";
import { validateOperatorDisclosure, type OperatorDisclosureDecision } from "../content/operator-disclosure.ts";

// Preparation model only. No runtime import, cloud client, write or approval override.
export const finalLegalRoutes = ["/terms", "/privacy", "/privacy/bm", "/help/prohibited-items", "/help", "/contact", "/account-deletion"] as const;
export const ownerApprovalItems = ["terms", "privacyEn", "privacyBm", "prohibitedItems", "addressDisclosure", "retention", "launchDate", "productionActivation", "domainCutover"] as const;
export const counselApprovalItems = ["terms", "privacyEn", "privacyBm", "sellerDisclosures", "retentionDeletion", "providersTransfers", "rightsBreachDpo", "liabilityIndemnity", "prohibitedRegulatory"] as const;
export const externalLegalIssueIds = [
  "terms", "privacyEn", "privacyBm", "prohibitedItems", "addressDisclosure", "individualSellerDisclosures", "businessSellerDisclosures",
  "bmSellerDisclosures", "statutoryRetention", "retentionDeletion", "providersTransfers", "malaysianRights", "backupsLogsHolds",
  "breachNotification", "dpoApplicability", "liability", "indemnity", "intermediaryObligations", "regulatedGoods",
] as const;
export interface LegalIssueDecision { status: "pending" | "resolved" | "explicitly-accepted"; reviewReference: string | null }
export interface V1LaunchApprovals {
  owner: Readonly<Record<typeof ownerApprovalItems[number], boolean>>;
  counsel: Readonly<Record<typeof counselApprovalItems[number], boolean>>;
  issues: Readonly<Record<typeof externalLegalIssueIds[number], Readonly<LegalIssueDecision>>>;
}
const unchecked = <T extends string>(items: readonly T[]) => Object.freeze(Object.fromEntries(items.map(id => [id, false])) as Record<T, boolean>);
export const pendingV1LaunchApprovals: Readonly<V1LaunchApprovals> = Object.freeze({
  owner: unchecked(ownerApprovalItems), counsel: unchecked(counselApprovalItems),
  issues: Object.freeze(Object.fromEntries(externalLegalIssueIds.map(id => [id, Object.freeze({ status: "pending", reviewReference: null })])) as V1LaunchApprovals["issues"]),
});

export interface V1PublicationGateInputs {
  approvals: V1LaunchApprovals;
  launchDate: unknown;
  disclosure: OperatorDisclosureDecision;
  sourceDates: V1LegalDates;
  verifiedRoutes: Readonly<Partial<Record<typeof finalLegalRoutes[number], boolean>>>;
  finalFrontendArtifactVerified: boolean;
  policyRulesArtifactsRegenerated: boolean;
}

/** Report unmet publication conditions. A successful review is not execution or domain-cutover authorization. */
export function reviewV1PublicationGate(input: V1PublicationGateInputs): string[] {
  const issues: string[] = [];
  for (const key of ownerApprovalItems) {
    // Domain cutover is a later, independently approved step, not legal publication.
    if (key !== "domainCutover" && input.approvals.owner[key] !== true) issues.push(`Owner approval outstanding: ${key}.`);
  }
  for (const key of counselApprovalItems) if (input.approvals.counsel[key] !== true) issues.push(`Counsel approval outstanding: ${key}.`);
  for (const key of externalLegalIssueIds) {
    const decision = input.approvals.issues[key];
    if (!decision || !["resolved", "explicitly-accepted"].includes(decision.status)
      || typeof decision.reviewReference !== "string" || !decision.reviewReference.trim()) {
      issues.push(`External legal review unresolved or undocumented: ${key}.`);
    }
  }
  issues.push(...validateOperatorDisclosure(input.disclosure));
  try { issues.push(...validateV1LegalDates(input.sourceDates, input.launchDate)); }
  catch { issues.push("An exact valid owner-approved launch date is required."); }
  for (const route of finalLegalRoutes) if (input.verifiedRoutes[route] !== true) issues.push(`Final published-candidate route verification required: ${route}.`);
  if (input.finalFrontendArtifactVerified !== true) issues.push("The final frontend artifact must be built and verified.");
  if (input.policyRulesArtifactsRegenerated !== true) issues.push("Final policy/rules artifacts must be regenerated and verified.");
  return issues;
}

/** Exact future six-field record validated locally. Never writes releasePolicies/current. */
export function prepareV1PolicyRecord() {
  if (productionReleasePolicy.termsVersion !== "1.0" || productionReleasePolicy.privacyVersion !== "1.0" || productionReleasePolicy.minimumAge !== 18) {
    throw new Error("The central policy source must match the reviewed V1 versions and minimum age.");
  }
  const record = Object.freeze({ releaseTarget: "production" as const, projectId: productionEnvironment.projectId,
    ...productionReleasePolicy, publicationApproved: true });
  if (validateProductionPolicy(record).length || !releasePolicyFromMirror(record, { target: "production", projectId: productionEnvironment.projectId })) {
    throw new Error("The prepared V1 record failed the existing production policy schema.");
  }
  return record;
}
