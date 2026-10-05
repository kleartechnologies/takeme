import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PolicySections, PublicInformationPage } from "@/components/public-information/public-information";
import { requireLegalInformation } from "@/components/public-information/legal-preview";
import { PrivacyLanguages } from "@/components/public-information/privacy-languages";
import { bmPrivacyApprovalRequired, privacyNotices } from "@/content/privacy-notices";
import { canRenderBmPrivacyNotice } from "@/lib/privacy-notice";
import { isProductionLegalPublication } from "@/lib/public-information";

export const metadata: Metadata = { title: "Privacy Notice · Bahasa Melayu", description: "TAKEME Bahasa Melayu privacy notice availability.", alternates: { canonical: "/privacy/bm", languages: { en: "/privacy", ms: "/privacy/bm" } }, robots: { index: isProductionLegalPublication() && privacyNotices.bm.sections !== null, follow: isProductionLegalPublication() } };
export default function BmPrivacyPage() {
  requireLegalInformation();
  if (!canRenderBmPrivacyNotice({ nodeEnv: process.env.NODE_ENV, useEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, buildProof: process.env.TAKEME_BUILD_RELEASE_PROOF })) notFound();
  const sections = privacyNotices.bm.sections;
  return <PublicInformationPage title="Privacy Notice · Bahasa Melayu" policy="privacy">
    <PrivacyLanguages current="bm" />
    {sections ? <PolicySections sections={[...sections]} /> : <section aria-labelledby="bm-approval"><h2 id="bm-approval" className="text-lg font-semibold">{bmPrivacyApprovalRequired}</h2><p className="mt-3">The intended V1 privacy notice will be available in English and Bahasa Melayu. The approved Bahasa Melayu legal text has not been supplied. This review placeholder is not a privacy notice and cannot be published in production.</p></section>}
  </PublicInformationPage>;
}
