import type { Metadata } from "next";
import { isProductionLegalPublication } from "@/lib/public-information";
import { PolicySections, PublicInformationPage } from "@/components/public-information/public-information";
import { requireLegalInformation } from "@/components/public-information/legal-preview";
import { prohibitedItemsIntro, prohibitedItemsPolicy, prohibitedItemsReviewNotice, prohibitedItemsSections } from "@/content/marketplace-rules";
import { buildProhibitedItemsMetadata } from "@/lib/prohibited-items-metadata";

export const metadata: Metadata = buildProhibitedItemsMetadata(isProductionLegalPublication());

export default function ProhibitedItemsPage() {
  requireLegalInformation();
  return <PublicInformationPage title={prohibitedItemsPolicy.title} intro={prohibitedItemsIntro} policy="terms" sections={prohibitedItemsSections} reviewNotice={prohibitedItemsReviewNotice}><PolicySections sections={prohibitedItemsSections} /></PublicInformationPage>;
}
