import type { Metadata } from "next";
import { bmPrivacyDocument } from "../content/privacy-bm.ts";
import { hasApprovedBmPrivacyNotice } from "./privacy-notice.ts";

// A local translation draft does not grant publication or indexing permission.
export function buildBmPrivacyMetadata(publicationApproved: boolean): Metadata {
  const approved = publicationApproved && hasApprovedBmPrivacyNotice();
  const description = "Notis Privasi TAKEME tentang data akaun dan pasaran, penerimaan polisi, pilihan privasi, penyimpanan data dan pemadaman akaun.";
  const languages: Record<string, string> = { en: "/privacy" };
  if (approved) languages.ms = "/privacy/bm";
  return {
    title: { absolute: bmPrivacyDocument.title },
    description,
    alternates: { canonical: "/privacy/bm", languages },
    openGraph: { title: bmPrivacyDocument.title, description, url: "/privacy/bm", type: "website", locale: "ms_MY" },
    robots: { index: approved, follow: approved },
  };
}
