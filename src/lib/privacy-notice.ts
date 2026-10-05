import type { InformationSection } from "../components/public-information/public-information";
import { privacyNotices } from "../content/privacy-notices.ts";
import { canPreviewLegalDraft, canPublishProductionLegal, type LegalRuntime } from "./public-information.ts";
import { legalPublicationReadiness, type LegalPublicationReadiness } from "./legal-publication.ts";
import { productionReleasePolicy, type ReleasePolicy } from "../../functions/src/release-policy.ts";

export function hasApprovedBmPrivacyNotice(readiness: LegalPublicationReadiness = legalPublicationReadiness, sections: readonly InformationSection[] | null = privacyNotices.bm.sections) {
  return readiness.bmPrivacyNoticeApproved === true && Array.isArray(sections) && sections.length > 0;
}

// A supplied owner draft is not final legal approval. Production still needs
// the complete publication gate, independent BM approval and actual content.
export function canRenderBmPrivacyNotice(runtime: LegalRuntime, readiness: LegalPublicationReadiness = legalPublicationReadiness, policy: ReleasePolicy = productionReleasePolicy, sections: readonly InformationSection[] | null = privacyNotices.bm.sections) {
  return canPreviewLegalDraft(runtime)
    || canPublishProductionLegal(runtime, readiness, policy) && hasApprovedBmPrivacyNotice(readiness, sections);
}
