import type { Metadata } from "next";
import { termsDocument } from "../content/terms.ts";

// The route supplies the result of the existing legal publication gate.
// Draft metadata does not grant permission to render or publish the document.
export function buildTermsMetadata(publicationApproved: boolean): Metadata {
  const description = "TAKEME Terms of Service for marketplace browsing, accounts, listings, offers, auctions, messages and account deletion.";
  return {
    title: { absolute: termsDocument.title },
    description,
    alternates: { canonical: "/terms" },
    openGraph: { title: termsDocument.title, description, url: "/terms", type: "website" },
    robots: { index: publicationApproved, follow: publicationApproved },
  };
}
