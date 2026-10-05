import type { Metadata } from "next";
import { isProductionLegalPublication } from "@/lib/public-information";
import { PolicySections, PublicInformationPage } from "@/components/public-information/public-information";
import { requireLegalInformation } from "@/components/public-information/legal-preview";
import { privacySections } from "@/content/privacy";

export const metadata: Metadata = { title: "Privacy Policy", description: "How TAKEME handles account and marketplace information, location, choices, retention and account deletion.", alternates: { canonical: "/privacy" }, robots: { index: isProductionLegalPublication(), follow: isProductionLegalPublication() } };
export default function PrivacyPage() {
  requireLegalInformation();
  return <PublicInformationPage title="Privacy Policy" intro="Understand what you share, how TAKEME uses it, and the choices available to you." policy="privacy" sections={privacySections}><PolicySections sections={privacySections} /></PublicInformationPage>;
}
