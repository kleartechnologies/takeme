import type { Metadata } from "next";
import { isProductionLegalPublication } from "@/lib/public-information";
import { PolicySections, PublicInformationPage } from "@/components/public-information/public-information";
import { requireLegalInformation } from "@/components/public-information/legal-preview";
import { termsDocument, termsSections } from "@/content/terms";
import { buildTermsMetadata } from "@/lib/terms-metadata";
export const metadata: Metadata = buildTermsMetadata(isProductionLegalPublication());
export default function TermsPage() {
  requireLegalInformation();
  return <PublicInformationPage title={termsDocument.title} intro="Clear rules for browsing, listing, communicating and arranging marketplace exchanges on TAKEME." policy="terms" sections={termsSections} reviewNotice={termsDocument.reviewNotice}><PolicySections sections={termsSections} /></PublicInformationPage>;
}
