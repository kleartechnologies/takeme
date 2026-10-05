import type { InformationSection } from "../components/public-information/public-information";
import { privacySections } from "./privacy.ts";
import { bmPrivacySections } from "./privacy-bm.ts";

export type PrivacyNoticeLanguage = "en" | "bm";
// Both owner drafts share the central Privacy version. Content availability
// does not grant final legal approval or production publication permission.
export const privacyNotices = Object.freeze({
  en: { language: "English", href: "/privacy", sections: privacySections as readonly InformationSection[] },
  bm: { language: "Bahasa Melayu", href: "/privacy/bm", sections: bmPrivacySections as readonly InformationSection[] | null },
});
export const bmPrivacyApprovalRequired = "OWNER/LEGAL APPROVAL REQUIRED";
