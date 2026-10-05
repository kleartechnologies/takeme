import type { InformationSection } from "../components/public-information/public-information";
import { privacyNotices } from "../content/privacy-notices.ts";
import { canPreviewLegalDraft, canPublishProductionLegal, type LegalRuntime } from "./public-information.ts";
import { legalPublicationReadiness, type LegalPublicationReadiness } from "./legal-publication.ts";
import { productionReleasePolicy, type ReleasePolicy } from "../../functions/src/release-policy.ts";

// The review placeholder is never a publishable notice, even if a readiness
// boolean is changed before the actual approved BM content has been supplied.
export function canRenderBmPrivacyNotice(runtime: LegalRuntime, readiness: LegalPublicationReadiness = legalPublicationReadiness, policy: ReleasePolicy = productionReleasePolicy, sections: readonly InformationSection[] | null = privacyNotices.bm.sections) {
  return canPreviewLegalDraft(runtime)
    || canPublishProductionLegal(runtime, readiness, policy) && Array.isArray(sections) && sections.length > 0;
}
