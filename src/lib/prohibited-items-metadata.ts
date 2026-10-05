import type { Metadata } from "next";
import { prohibitedItemsPolicy } from "../content/marketplace-rules.ts";

// Rendering and publication still require the existing legal-information gate.
export function buildProhibitedItemsMetadata(publicationApproved: boolean): Metadata {
  const description = "TAKEME prohibited and restricted items, listing rules, reporting and marketplace enforcement boundaries.";
  return {
    title: { absolute: prohibitedItemsPolicy.title },
    description,
    alternates: { canonical: "/help/prohibited-items" },
    openGraph: { title: prohibitedItemsPolicy.title, description, url: "/help/prohibited-items", type: "website" },
    robots: { index: publicationApproved, follow: publicationApproved },
  };
}
