import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { FooterSocialLinks } from "@/components/layout/footer-social-links";
import { legalSectionParagraphs } from "@/content/operator-disclosure";
import { publicLegalParagraph } from "@/lib/legal-review-presentation";
import { isLegalInformationAvailable, isProductionLegalPublication, legalDocumentState } from "@/lib/public-information";
import styles from "./public-information.module.css";

export interface InformationSection { id: string; title: string; paragraphs?: string[]; addressParagraphs?: string[]; bullets?: string[]; links?: { href: string; label: string }[] }

export function PublicInformationHeader() {
  return <header className={styles.header}><a className={styles.skip} href="#public-content">Skip to content</a><div className={styles.headerInner}><Logo compact /><nav className={styles.headerNav} aria-label="Public navigation"><Link href="/help">Help</Link><Link href="/explore">Explore</Link></nav></div></header>;
}

export function PublicInformationLinks({ className }: { className?: string }) {
  const available = isLegalInformationAvailable();
  return <nav className={className ?? styles.footerLinks} aria-label="Help and legal"><Link href="/help">Help Centre</Link>{available && <><Link href="/contact">Contact</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></>}<Link href="/account-deletion">Account deletion</Link></nav>;
}

export function PublicInformationFooter() {
  return <footer className={styles.footer}><div className={styles.footerInner}><div className={styles.footerTop}><span>TAKEME · Buy. Sell. Find.</span><a href="#public-content">Back to top ↑</a></div><div className={styles.footerBottom}><PublicInformationLinks /><FooterSocialLinks className="mt-3 shrink-0" /></div></div></footer>;
}

function Contents({ sections }: { sections: Pick<InformationSection, "id" | "title">[] }) {
  return <div className={styles.tocLinks}>{sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</div>;
}

export function PublicInformationPage({ title, intro, draft = false, policy, sections, reviewNotice, language = "en", children }: { title: string; intro?: string; draft?: boolean; policy?: "terms" | "privacy"; sections?: Pick<InformationSection, "id" | "title">[]; reviewNotice?: string; language?: "en" | "ms"; children: ReactNode }) {
  const document = legalDocumentState(policy);
  const policyPage = draft || !!policy;
  const review = policyPage && !document.production;
  const bm = language === "ms";
  const date = (value: string) => new Intl.DateTimeFormat(bm ? "ms-MY" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  const copy = bm ? {
    review: "Semakan pemilik", information: "Bantuan & maklumat", intendedVersion: "Versi V1 yang dicadangkan", version: "Versi",
    approvalPending: "kelulusan pemilik/undang-undang belum diperoleh", proposedUpdated: "Tarikh kemas kini terakhir yang dicadangkan", updated: "Tarikh kemas kini terakhir",
    proposedEffective: "Tarikh berkuat kuasa yang dicadangkan", effective: "Tarikh berkuat kuasa",
    datePending: "BELUM DITETAPKAN — tarikh pelancaran awam sebenar", updatedPending: "BELUM DITETAPKAN — tarikh pelancaran awam sebenar melainkan ditukar kemudian", contents: "Dalam halaman ini",
  } : {
    review: "Owner review", information: "Help & information", intendedVersion: "Intended V1 version", version: "Version",
    approvalPending: "pending owner/legal approval", proposedUpdated: "Proposed last updated", updated: "Last updated",
    proposedEffective: "Proposed effective date", effective: "Effective date",
    datePending: "actual public launch date pending", updatedPending: "actual public launch date pending", contents: "On this page",
  };
  const contentsSummary = bm ? <summary>Dalam halaman ini</summary> : <summary>On this page</summary>;
  const contentsNavigation = sections && (bm
    ? <nav aria-label="Bahagian halaman"><Contents sections={sections} /></nav>
    : <nav aria-label="Page sections"><Contents sections={sections} /></nav>);
  return <main id="public-content" tabIndex={-1} className={styles.page} lang={language}>
    <div className={styles.heading}><p className={styles.eyebrow}>TAKEME · {review ? copy.review : copy.information}</p><h1>{title}</h1>{intro && <p className={styles.intro}>{intro}</p>}{policyPage && <><p className={styles.meta}>{review ? copy.intendedVersion : copy.version} {document.version ?? copy.approvalPending} · {review ? copy.proposedUpdated : copy.updated} {document.lastUpdated ? <time dateTime={document.lastUpdated}>{date(document.lastUpdated)}</time> : copy.updatedPending}<br />{review ? copy.proposedEffective : copy.effective} {document.effectiveDate ? <time dateTime={document.effectiveDate}>{date(document.effectiveDate)}</time> : copy.datePending}</p>{review && <p className={styles.review}>{reviewNotice ?? "Working draft for business and legal review. This document is not in effect and has not been published. The intended V1 identifiers shown here are separate from synthetic demo/staging acceptance policies."}</p>}</>}</div>
    {sections && <details className={styles.mobileToc}>{contentsSummary}{contentsNavigation}</details>}
    <div className={sections ? styles.layout : styles.withoutToc}>{sections && <aside className={styles.desktopToc}><p className={styles.tocTitle}>{copy.contents}</p>{contentsNavigation}</aside>}<div className={styles.article}>{children}</div></div>
  </main>;
}

export function PolicySections({ sections }: { sections: InformationSection[] }) {
  const published = isProductionLegalPublication();
  return <>{sections.map(section => <section className={styles.section} key={section.id} aria-labelledby={section.id}><h2 id={section.id} tabIndex={-1}>{section.title}</h2>{legalSectionParagraphs(section).map(text => {
    const paragraph = publicLegalParagraph(text, published);
    return <p key={paragraph}>{paragraph}</p>;
  })}{section.bullets && <ul>{section.bullets.map(text => <li key={text}>{text}</li>)}</ul>}{section.links && <div className={styles.links}>{section.links.map(link => <Link href={link.href} key={link.href}>{published ? link.label.replace(/\s+draft\b/gi, "") : link.label}</Link>)}</div>}</section>)}</>;
}
