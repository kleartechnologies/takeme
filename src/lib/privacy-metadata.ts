import type { Metadata } from "next";
import { privacyDocument } from "../content/privacy.ts";
import { hasApprovedBmPrivacyNotice } from "./privacy-notice.ts";

// Metadata follows the route's existing publication gate and cannot approve it.
export function buildPrivacyMetadata(publicationApproved: boolean): Metadata {
  const description = "TAKEME Privacy Notice for account and marketplace data, policy acceptance, privacy choices, retention and account deletion.";
  const languages: Record<string, string> = { en: "/privacy" };
  if (publicationApproved && hasApprovedBmPrivacyNotice()) languages.ms = "/privacy/bm";
  return {
    title: { absolute: privacyDocument.title },
    description,
    alternates: { canonical: "/privacy", languages },
    openGraph: { title: privacyDocument.title, description, url: "/privacy", type: "website" },
    robots: { index: publicationApproved, follow: publicationApproved },
  };
}
