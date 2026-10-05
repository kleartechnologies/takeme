import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { isLegalInformationAvailable, isProductionLegalPublication, legalDocumentState } from "@/lib/public-information";
import styles from "./public-information.module.css";

export interface InformationSection { id: string; title: string; paragraphs?: string[]; bullets?: string[]; links?: { href: string; label: string }[] }

export function PublicInformationHeader() {
  return <header className={styles.header}><a className={styles.skip} href="#public-content">Skip to content</a><div className={styles.headerInner}><Logo compact /><nav className={styles.headerNav} aria-label="Public navigation"><Link href="/help">Help</Link><Link href="/explore">Explore</Link></nav></div></header>;
}

export function PublicInformationLinks({ className }: { className?: string }) {
  const available = isLegalInformationAvailable();
  return <nav className={className ?? styles.footerLinks} aria-label="Help and legal"><Link href="/help">Help Centre</Link>{available && <><Link href="/contact">Contact</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></>}<Link href="/account-deletion">Account deletion</Link></nav>;
}

export function PublicInformationFooter() {
  return <footer className={styles.footer}><div className={styles.footerInner}><div className={styles.footerTop}><span>TAKEME · Buy. Sell. Find.</span><a href="#public-content">Back to top ↑</a></div><PublicInformationLinks /></div></footer>;
}

function Contents({ sections }: { sections: Pick<InformationSection, "id" | "title">[] }) {
  return <div className={styles.tocLinks}>{sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</div>;
}

export function PublicInformationPage({ title, intro, draft = false, policy, sections, children }: { title: string; intro?: string; draft?: boolean; policy?: "terms" | "privacy"; sections?: Pick<InformationSection, "id" | "title">[]; children: ReactNode }) {
  const document = legalDocumentState(policy);
  const policyPage = draft || !!policy;
  const review = policyPage && !document.production;
  const date = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  return <main id="public-content" tabIndex={-1} className={styles.page}>
    <div className={styles.heading}><p className={styles.eyebrow}>TAKEME · {review ? "Owner review" : "Help & information"}</p><h1>{title}</h1>{intro && <p className={styles.intro}>{intro}</p>}{policyPage && <><p className={styles.meta}>{review ? "Intended V1 version" : "Version"} {document.version ?? "pending owner/legal approval"} · {review ? "Proposed last updated" : "Last updated"} {document.lastUpdated ? <time dateTime={document.lastUpdated}>{date(document.lastUpdated)}</time> : "actual public launch date pending"}<br />{review ? "Proposed effective date" : "Effective date"} {document.effectiveDate ? <time dateTime={document.effectiveDate}>{date(document.effectiveDate)}</time> : "actual public launch date pending"}</p>{review && <p className={styles.review}>Working draft for business and legal review. This document is not in effect and has not been published. The intended V1 identifiers shown here are separate from synthetic demo/staging acceptance policies.</p>}</>}</div>
    {sections && <details className={styles.mobileToc}><summary>On this page</summary><nav aria-label="Page sections"><Contents sections={sections} /></nav></details>}
    <div className={sections ? styles.layout : styles.withoutToc}>{sections && <aside className={styles.desktopToc}><p className={styles.tocTitle}>On this page</p><nav aria-label="Page sections"><Contents sections={sections} /></nav></aside>}<div className={styles.article}>{children}</div></div>
  </main>;
}

export function PolicySections({ sections }: { sections: InformationSection[] }) {
  const published = isProductionLegalPublication();
  return <>{sections.map(section => <section className={styles.section} key={section.id} aria-labelledby={section.id}><h2 id={section.id} tabIndex={-1}>{section.title}</h2>{section.paragraphs?.map(text => <p key={text}>{text}</p>)}{section.bullets && <ul>{section.bullets.map(text => <li key={text}>{text}</li>)}</ul>}{section.links && <div className={styles.links}>{section.links.map(link => <Link href={link.href} key={link.href}>{published ? link.label.replace(/\s+draft\b/gi, "") : link.label}</Link>)}</div>}</section>)}</>;
}
