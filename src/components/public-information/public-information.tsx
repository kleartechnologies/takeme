import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { isLocalLegalPreview, legalDraft } from "@/lib/public-information";
import styles from "./public-information.module.css";

export interface InformationSection { id: string; title: string; paragraphs?: string[]; bullets?: string[]; links?: { href: string; label: string }[] }

export function PublicInformationHeader() {
  return <header className={styles.header}><a className={styles.skip} href="#public-content">Skip to content</a><div className={styles.headerInner}><Logo compact /><nav className={styles.headerNav} aria-label="Public navigation"><Link href="/help">Help</Link><Link href="/explore">Explore</Link></nav></div></header>;
}

export function PublicInformationLinks({ className }: { className?: string }) {
  const preview = isLocalLegalPreview();
  return <nav className={className ?? styles.footerLinks} aria-label="Help and legal"><Link href="/help">Help Centre</Link>{preview && <><Link href="/contact">Contact</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></>}<Link href="/account-deletion">Account deletion</Link></nav>;
}

export function PublicInformationFooter() {
  return <footer className={styles.footer}><div className={styles.footerInner}><div className={styles.footerTop}><span>TAKEME · Buy. Sell. Find.</span><a href="#public-content">Back to top ↑</a></div><PublicInformationLinks /></div></footer>;
}

function Contents({ sections }: { sections: Pick<InformationSection, "id" | "title">[] }) {
  return <div className={styles.tocLinks}>{sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</div>;
}

export function PublicInformationPage({ title, intro, draft = false, sections, children }: { title: string; intro?: string; draft?: boolean; sections?: Pick<InformationSection, "id" | "title">[]; children: ReactNode }) {
  return <main id="public-content" tabIndex={-1} className={styles.page}>
    <div className={styles.heading}><p className={styles.eyebrow}>TAKEME · {draft ? "Owner review" : "Help & information"}</p><h1>{title}</h1>{intro && <p className={styles.intro}>{intro}</p>}{draft && <><p className={styles.meta}>Version {legalDraft.version} · Last updated <time dateTime={legalDraft.lastUpdated}>3 October 2026</time><br />Proposed effective date <time dateTime={legalDraft.effectiveDate}>5 October 2026</time></p><p className={styles.review}>Working draft for business and legal review. This document is not in effect and has not been published.</p></>}</div>
    {sections && <details className={styles.mobileToc}><summary>On this page</summary><nav aria-label="Page sections"><Contents sections={sections} /></nav></details>}
    <div className={sections ? styles.layout : styles.withoutToc}>{sections && <aside className={styles.desktopToc}><p className={styles.tocTitle}>On this page</p><nav aria-label="Page sections"><Contents sections={sections} /></nav></aside>}<div className={styles.article}>{children}</div></div>
  </main>;
}

export function PolicySections({ sections }: { sections: InformationSection[] }) {
  return <>{sections.map(section => <section className={styles.section} key={section.id} aria-labelledby={section.id}><h2 id={section.id} tabIndex={-1}>{section.title}</h2>{section.paragraphs?.map(text => <p key={text}>{text}</p>)}{section.bullets && <ul>{section.bullets.map(text => <li key={text}>{text}</li>)}</ul>}{section.links && <div className={styles.links}>{section.links.map(link => <Link href={link.href} key={link.href}>{link.label}</Link>)}</div>}</section>)}</>;
}
