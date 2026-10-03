import type { Metadata } from "next";
import { PolicySections, PublicInformationPage } from "@/components/public-information/public-information";
import { requireLocalLegalPreview } from "@/components/public-information/legal-preview";
import { privacySections } from "@/content/privacy";

export const metadata: Metadata = { title: "Privacy Policy", description: "TAKEME’s working privacy draft: account and marketplace data, private messaging, location, choices, retention and account deletion.", alternates: { canonical: "/privacy" }, robots: { index: false, follow: false } };
export default function PrivacyPage() {
  requireLocalLegalPreview();
  return <PublicInformationPage title="Privacy Policy" intro="Understand what you share, how TAKEME uses it, and the choices available to you." draft sections={privacySections}><PolicySections sections={privacySections} /></PublicInformationPage>;
}
