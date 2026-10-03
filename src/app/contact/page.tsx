import type { Metadata } from "next";
import Link from "next/link";
import { PublicInformationPage } from "@/components/public-information/public-information";
import { requireLocalLegalPreview } from "@/components/public-information/legal-preview";
import { marketplaceOperator } from "@/content/operator";
import styles from "@/components/public-information/public-information.module.css";
export const metadata: Metadata = { title: "Contact TAKEME", description: "Local review of TAKEME support, account/privacy help and marketplace reporting information.", alternates: { canonical: "/contact" }, robots: { index: false, follow: false } };
export default function ContactPage() {
  requireLocalLegalPreview();
  return <PublicInformationPage title="Contact TAKEME" intro="Find help with your account or a marketplace concern.">
    <p className={`${styles.review} mb-6`}>Local development review only. This page has not been published.</p>
    <p className="mb-6">TAKEME is operated by {marketplaceOperator.name}.</p>
    <section className={styles.contactCard}><h2>Help with TAKEME</h2><p>Start with practical answers about listings, offers, auctions, messages and account controls. For customer support, email TAKEME.</p><div className={styles.links}><a href={`mailto:${marketplaceOperator.supportEmail}`}>{marketplaceOperator.supportEmail}</a><Link href="/help">Visit the Help Centre</Link></div></section>
    <section className={styles.contactCard}><h2>Account &amp; privacy</h2><p>For privacy questions or legal enquiries, use the email below. Use Settings for supported profile, location, notification and security controls. Account deletion can be initiated securely in your browser after sign-in and identity confirmation.</p><div className={styles.links}><a href={`mailto:${marketplaceOperator.privacyLegalEmail}`}>{marketplaceOperator.privacyLegalEmail}</a><Link href="/profile/settings">Account settings</Link><Link href="/account-deletion">Request account deletion</Link><Link href="/privacy">Privacy Policy draft</Link></div></section>
    <section className={styles.contactCard}><h2>Report a marketplace concern</h2><p>Use Report listing, Report seller or the Report action in a conversation/on another participant’s message. Choose a relevant reason and provide concise details. Report submission does not guarantee a response time, refund or specific outcome.</p><div className={styles.links}><Link href="/help#safety">Read safety and reporting guidance</Link></div></section>
  </PublicInformationPage>;
}
