import type { Metadata } from "next";
import { isProductionLegalPublication } from "@/lib/public-information";
import { PolicySections, PublicInformationPage } from "@/components/public-information/public-information";
import { requireLegalInformation } from "@/components/public-information/legal-preview";
import { prohibitedItems } from "@/content/marketplace-rules";
export const metadata: Metadata = { title: "Prohibited items and moderation", description: "TAKEME prohibited-items rules, marketplace conduct and reporting/moderation boundaries.", alternates: { canonical: "/help/prohibited-items" }, robots: { index: isProductionLegalPublication(), follow: isProductionLegalPublication() } };
export default function ProhibitedItemsPage() {
  requireLegalInformation();
  return <PublicInformationPage title="Prohibited items & conduct" intro="Keep TAKEME lawful, safe and respectful. These V1 rules apply to listings, content and marketplace activity." policy="terms">
    <PolicySections sections={[{ id: "prohibited", title: "Items and services that are not allowed", paragraphs: ["TAKEME must not be used for illegal, unsafe, fraudulent, infringing or prohibited goods/services. The V1 rules prohibit:"], bullets: prohibitedItems }, { id: "moderation", title: "Reports and moderation", paragraphs: ["TAKEME may remove or restrict listings, content or accounts that violate marketplace rules, applicable law, intellectual-property rights, safety requirements or fraud/abuse controls. Listing publication is not pre-approval, inspection or authentication.", "Existing Report actions accept concerns about listings, sellers, conversations and another participant’s messages. Authorised report review can record status, resolutions and private notes; it does not guarantee an outcome or automatically resolve a disputed deal. Do not abuse reports or include unnecessary private information."], links: [{ href: "/help#safety", label: "How to report a concern" }, { href: "/terms", label: "Terms of Service draft" }] }]} />
  </PublicInformationPage>;
}
