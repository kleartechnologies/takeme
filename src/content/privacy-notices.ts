import type { InformationSection } from "../components/public-information/public-information";
import { privacySections } from "./privacy.ts";

export type PrivacyNoticeLanguage = "en" | "bm";
// Only language wiring is approved. This is not a translated legal notice.
export const privacyNotices = Object.freeze({
  en: { language: "English", href: "/privacy", sections: privacySections as readonly InformationSection[] },
  bm: { language: "Bahasa Melayu", href: "/privacy/bm", sections: null as readonly InformationSection[] | null },
});
export const bmPrivacyApprovalRequired = "OWNER/LEGAL APPROVAL REQUIRED";
