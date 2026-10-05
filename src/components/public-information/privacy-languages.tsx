import Link from "next/link";
import { privacyNotices, type PrivacyNoticeLanguage } from "@/content/privacy-notices";
import { hasApprovedBmPrivacyNotice } from "@/lib/privacy-notice";
import { isLocalLegalPreview } from "@/lib/public-information";

export function PrivacyLanguages({ current }: { current: PrivacyNoticeLanguage }) {
  const bmApproved = hasApprovedBmPrivacyNotice();
  const preview = isLocalLegalPreview();
  return <nav className="mb-6 flex flex-wrap gap-5 text-sm font-semibold" aria-label="Privacy notice language">
    {Object.entries(privacyNotices).map(([language, notice]) => language === "bm" && !bmApproved && !preview
      ? <span key={language} lang="ms" aria-disabled="true" className="inline-flex min-h-11 items-center text-gray-500">{notice.language} · not yet approved</span>
      : <Link key={language} href={notice.href} lang={language === "bm" ? "ms" : "en"} aria-current={language === current ? "page" : undefined} className="inline-flex min-h-11 items-center text-[var(--takeme-green)] underline">{notice.language}{language === "bm" && !bmApproved ? " · approval required" : ""}</Link>)}
  </nav>;
}
