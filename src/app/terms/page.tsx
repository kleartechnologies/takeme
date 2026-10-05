import type { Metadata } from "next";
import { isProductionLegalPublication } from "@/lib/public-information";
import { PolicySections, PublicInformationPage } from "@/components/public-information/public-information";
import { requireLegalInformation } from "@/components/public-information/legal-preview";
import { termsSections } from "@/content/terms";
export const metadata: Metadata = { title: "Terms of Service", description: "TAKEME Terms for listings, offers, auctions, agreed deals, marketplace conduct and account deletion.", alternates: { canonical: "/terms" }, robots: { index: isProductionLegalPublication(), follow: isProductionLegalPublication() } };
export default function TermsPage() {
  requireLegalInformation();
  return <PublicInformationPage title="Terms of Service" intro="Clear rules for listing, communicating and arranging marketplace exchanges on TAKEME." policy="terms" sections={termsSections}><PolicySections sections={termsSections} /></PublicInformationPage>;
}
