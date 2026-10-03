import type { Metadata } from "next";
import Link from "next/link";
import { PublicInformationPage } from "@/components/public-information/public-information";
import { helpSections } from "@/content/help";
import { marketplaceOperator } from "@/content/operator";
import { isLocalLegalPreview } from "@/lib/public-information";
import styles from "@/components/public-information/public-information.module.css";
export const metadata: Metadata = { title: "Help Centre", description: "Practical TAKEME help for buying, selling, offers, auctions, messages, Saved, account privacy and safe exchanges.", alternates: { canonical: "/help" } };
export default function HelpPage() {
  const sections = [...helpSections.map(section => ({ ...section, links: section.links?.filter(link => isLocalLegalPreview() || link.href !== "/help/prohibited-items") })), { id: "contact-support", title: "Still need help?", questions: [{ question: "How do I contact TAKEME support?", answer: "Contact our support team for account or marketplace help. Never send your password or sign-in codes." }], links: [{ href: `mailto:${marketplaceOperator.supportEmail}`, label: "Email TAKEME support" }] }];
  return <PublicInformationPage title="How can we help?" intro="Useful answers for your next exchange. Find out how TAKEME works today." sections={sections}>
    {sections.map(section => <section key={section.id} className={styles.section} aria-labelledby={section.id}><h2 id={section.id} tabIndex={-1}>{section.title}</h2>{section.questions.map(faq => <details key={faq.question} className={styles.faq}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}{section.links && <div className={styles.links}>{section.links.map(link => <Link href={link.href} key={link.href}>{link.label}</Link>)}</div>}</section>)}
  </PublicInformationPage>;
}
