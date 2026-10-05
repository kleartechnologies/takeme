import { demoReleasePolicy, productionReleasePolicy, validateProductionPolicy, type ReleasePolicy } from "../../functions/src/release-policy.ts";
import { legalPublicationReadiness, validateLegalPublication, type LegalPublicationReadiness } from "./legal-publication.ts";
import { stagingEnvironment } from "../../functions/src/staging-environment.ts";
import { productionEnvironment } from "../../functions/src/production-environment.ts";
import { decodeReleaseProof, isStagingReleaseProof } from "./release-proof.ts";

export const publicInformationPaths = ["/privacy", "/privacy-policy", "/terms", "/help", "/help/prohibited-items", "/contact", "/account-deletion"] as const;
export function isPublicInformationPath(pathname: string) { return publicInformationPaths.some(path => path === pathname); }
export interface LegalRuntime { nodeEnv?: string; useEmulators?: string; projectId?: string; buildProof?: string }

export function canPreviewLegalDraft(runtime: LegalRuntime) {
  return runtime.nodeEnv === "development" && runtime.useEmulators === "true" && runtime.projectId === "demo-takeme"
    || runtime.nodeEnv === "production" && runtime.useEmulators === "false" && runtime.projectId === stagingEnvironment.projectId && isStagingReleaseProof(runtime.buildProof);
}

/** Source approvals and exact compiled policy identity are independent requirements. */
export function canPublishProductionLegal(runtime: LegalRuntime, readiness: LegalPublicationReadiness = legalPublicationReadiness, policy: ReleasePolicy = productionReleasePolicy) {
  const proof = runtime.buildProof ? decodeReleaseProof(runtime.buildProof) : null;
  return runtime.nodeEnv === "production" && runtime.useEmulators === "false" && runtime.projectId === productionEnvironment.projectId
    && !validateLegalPublication(readiness).length && !validateProductionPolicy(policy).length
    && proof?.purpose === "production-build" && proof.target === "production" && proof.useEmulators === false
    && proof.projectId === productionEnvironment.projectId && proof.siteUrl === productionEnvironment.siteUrl
    && proof.firebase?.NEXT_PUBLIC_FIREBASE_PROJECT_ID === productionEnvironment.projectId
    && proof.firebase.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN === productionEnvironment.projectId + ".firebaseapp.com"
    && proof.firebase.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET === productionEnvironment.storageBucket
    && proof.policy?.publicationApproved === true && proof.policy.termsVersion === policy.termsVersion
    && proof.policy.privacyVersion === policy.privacyVersion && proof.policy.minimumAge === policy.minimumAge;
}
function legalRuntime(): LegalRuntime {
  return { nodeEnv: process.env.NODE_ENV, useEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, buildProof: process.env.TAKEME_BUILD_RELEASE_PROOF };
}
export function isLocalLegalPreview() { return canPreviewLegalDraft(legalRuntime()); }
export function isProductionLegalPublication() { return canPublishProductionLegal(legalRuntime()); }
export function isLegalInformationAvailable() { return isLocalLegalPreview() || isProductionLegalPublication(); }

// Existing owner-supplied proposed dates must be reviewed with the final content.
// No version, effective date or approval is activated by a build command.
export function legalDocumentState(kind: "terms" | "privacy" = "terms") {
  const production = isProductionLegalPublication();
  const preview = isLocalLegalPreview();
  const previewVersion = isStagingReleaseProof(process.env.TAKEME_BUILD_RELEASE_PROOF) ? stagingEnvironment.policyVersion : demoReleasePolicy.termsVersion;
  const policy = production ? productionReleasePolicy : preview ? { ...demoReleasePolicy, termsVersion: previewVersion, privacyVersion: previewVersion } : productionReleasePolicy;
  return { version: kind === "privacy" ? policy.privacyVersion : policy.termsVersion,
    termsVersion: policy.termsVersion, privacyVersion: policy.privacyVersion, lastUpdated: "2026-10-03", effectiveDate: "2026-10-05",
    minimumAge: policy.minimumAge, jurisdiction: "Malaysia", publicationApproved: production, production };
}
export const legalDraft = Object.freeze(legalDocumentState());
