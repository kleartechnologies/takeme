import type { Metadata } from "next";
import { isProductionLegalPublication } from "@/lib/public-information";
import { PolicySections, PublicInformationPage } from "@/components/public-information/public-information";
import { requireLegalInformation } from "@/components/public-information/legal-preview";
import { privacyDocument, privacySections } from "@/content/privacy";
import { PrivacyLanguages } from "@/components/public-information/privacy-languages";
import { buildPrivacyMetadata } from "@/lib/privacy-metadata";

export const metadata: Metadata = buildPrivacyMetadata(isProductionLegalPublication());
export default function PrivacyPage() {
  requireLegalInformation();
  return <PublicInformationPage title={privacyDocument.title} intro="Understand what you share, how TAKEME uses it, and the choices available to you." policy="privacy" sections={privacySections} reviewNotice={privacyDocument.reviewNotice}><PrivacyLanguages current="en" /><PolicySections sections={privacySections} /></PublicInformationPage>;
}
