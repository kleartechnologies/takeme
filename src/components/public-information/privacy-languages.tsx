import Link from "next/link";
import { privacyNotices, type PrivacyNoticeLanguage } from "@/content/privacy-notices";

export function PrivacyLanguages({ current }: { current: PrivacyNoticeLanguage }) {
  return <nav className="mb-6 flex flex-wrap gap-5 text-sm font-semibold" aria-label="Privacy notice language">
    {Object.entries(privacyNotices).map(([language, notice]) => <Link key={language} href={notice.href} lang={language === "bm" ? "ms" : "en"} aria-current={language === current ? "page" : undefined} className="inline-flex min-h-11 items-center text-[var(--takeme-green)] underline">{notice.language}</Link>)}
  </nav>;
}
