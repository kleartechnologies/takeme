import type { Metadata } from "next";
import { PolicySections, PublicInformationPage } from "@/components/public-information/public-information";
import { requireLocalLegalPreview } from "@/components/public-information/legal-preview";
import { termsSections } from "@/content/terms";
export const metadata: Metadata = { title: "Terms of Service", description: "TAKEME’s working Terms draft for listings, offers, auctions, agreed deals, marketplace conduct and account deletion.", alternates: { canonical: "/terms" }, robots: { index: false, follow: false } };
export default function TermsPage() {
  requireLocalLegalPreview();
  return <PublicInformationPage title="Terms of Service" intro="Clear rules for listing, communicating and arranging marketplace exchanges on TAKEME." draft sections={termsSections}><PolicySections sections={termsSections} /></PublicInformationPage>;
}
