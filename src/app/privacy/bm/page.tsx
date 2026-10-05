import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PolicySections, PublicInformationPage } from "@/components/public-information/public-information";
import { requireLegalInformation } from "@/components/public-information/legal-preview";
import { PrivacyLanguages } from "@/components/public-information/privacy-languages";
import { bmPrivacyDocument, bmPrivacySections } from "@/content/privacy-bm";
import { canRenderBmPrivacyNotice } from "@/lib/privacy-notice";
import { isProductionLegalPublication } from "@/lib/public-information";
import { buildBmPrivacyMetadata } from "@/lib/privacy-bm-metadata";

export const metadata: Metadata = buildBmPrivacyMetadata(isProductionLegalPublication());
export default function BmPrivacyPage() {
  requireLegalInformation();
  if (!canRenderBmPrivacyNotice({ nodeEnv: process.env.NODE_ENV, useEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, buildProof: process.env.TAKEME_BUILD_RELEASE_PROOF })) notFound();
  return <PublicInformationPage title={bmPrivacyDocument.title} intro="Fahami data yang anda kongsi, cara TAKEME menggunakannya dan pilihan yang tersedia kepada anda." policy="privacy" language="ms" sections={bmPrivacySections} reviewNotice={bmPrivacyDocument.reviewNotice}>
    <PrivacyLanguages current="bm" />
    <PolicySections sections={bmPrivacySections} />
  </PublicInformationPage>;
}
