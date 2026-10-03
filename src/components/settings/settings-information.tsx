import { ChevronDown, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { marketplaceOperator } from "@/content/operator";
import styles from "./settings.module.css";

export function PrivacySettings() {
  return <>
    <p className={styles.intro}>Understand what you share on TAKEME.</p>
    <section className={styles.card}><h2>Your public profile</h2><p>Your profile photo, display name and general marketplace location can be seen by other people. Listings can show the general area and a meet-up place you explicitly select.</p><Link className={styles.link} href="/profile/settings/edit">Edit public profile</Link></section>
    <section className={styles.card}><h2>Your private details</h2><p>Your account email and saved private address are account-only. A private address is never copied into a listing or selected as a meet-up place automatically.</p><Link className={styles.link} href="/profile/locations">Manage addresses &amp; meet-up places</Link></section>
    <div className={styles.notice}><LockKeyhole size={19} /><span>There are currently no adjustable profile-visibility or messaging-privacy controls.</span></div>
    <section className={styles.card}><h2>Privacy Policy</h2><p>The policy draft explains current data practices and limited retention. It remains under business and legal review.</p><Link className={styles.link} href="/privacy">Read Privacy Policy draft</Link></section>
    <Link className={styles.link} href="/account-deletion">Account deletion information</Link>
  </>;
}

const faqs = [
  ["Buying", "How do I arrange an exchange?", "Open a listing and use Chat to ask questions. A buy-now request or accepted offer can form a deal. Agree collection, delivery and any costs with the seller. TAKEME does not process buyer-to-seller payments."],
  ["Selling", "How do I list an item?", "Use Sell, choose the listing type and add the item's details, photos and general location. Review the listing before publishing. Private addresses are never used as the public listing location."],
  ["Offers", "How do offers and counters work?", "For an available listing that supports offers, send an amount with Make Offer. The seller can accept, decline or counter. Accepting an offer or counter creates an agreed deal; it does not process a payment."],
  ["Auctions", "What happens if I am outbid?", "The auction shows your bid status and the minimum next bid. You can place another valid bid while it is live. At the end, a winning result can create a deal. Bid carefully and check the item before bidding."],
  ["Messages & saved items", "Where is my marketplace activity?", "Messages contains your conversations and offers. Updates shows marketplace alerts. Saved has your saved items, saved searches and followed sellers. Notification preferences control supported optional in-app alerts."],
  ["Account", "How do I delete my account?", "Open Delete account, sign in and confirm your identity using the existing deletion flow. Marketplace obligations can delay final deletion, and limited history or restricted evidence may be temporarily retained. Read the full deletion page before confirming."],
];

export function HelpSettings() {
  return <>
    <p className={styles.intro}>A few useful answers for your next exchange.</p>
    <Link className={`${styles.link} mb-5`} href="/help">Open the full Help Centre</Link>
    {faqs.map(([section, question, answer]) => <section key={section} className={styles.card}><h2>{section}</h2><details className={styles.faq}><summary>{question}<ChevronDown size={17} aria-hidden="true" /></summary><p>{answer}</p></details></section>)}
    <section className={styles.card}><h2>Safety &amp; reports</h2><p>Report a listing from its detail page, a seller from their profile, or a conversation/message using the available Report action.</p><Link className={styles.link} href="/profile/settings/safety">Read safety guidance</Link></section>
    <section className={styles.card}><h2>Contact support</h2><p>Email TAKEME for customer support or privacy/legal enquiries. Existing Report actions can submit marketplace concerns for review.</p><a className={styles.link} href={`mailto:${marketplaceOperator.supportEmail}`}>{marketplaceOperator.supportEmail}</a></section>
    <div className={styles.actions}><Link className={styles.link} href="/help/tiers">How TAKEME tiers work</Link><Link className={styles.link} href="/account-deletion">Account deletion details</Link></div>
  </>;
}

export function SafetySettings() {
  return <>
    <p className={styles.intro}>A little care goes a long way.</p>
    <div className={styles.notice}><ShieldCheck size={20} /><span>TAKEME helps you connect and record agreed deals. Buyers and sellers arrange the exchange together.</span></div>
    <section className={styles.card}><h2>Keep communication in TAKEME</h2><p>Use Chat to ask about the item and agree collection or delivery. Never share passwords or verification codes.</p><Link className={styles.link} href="/messages">Open Messages</Link></section>
    <section className={styles.card}><h2>Check before agreeing</h2><p>Read the description and seller reviews. Inspect the item at a public meet-up place where possible. Confirm what is included and any costs with the seller.</p></section>
    <section className={styles.card}><h2>Bid carefully</h2><p>Check the amount, minimum increment and end time before confirming a bid. Deleting an account does not cancel an existing bid or settle an agreed deal.</p></section>
    <section className={styles.card}><h2>Report suspicious activity</h2><p>Use Report listing on an item, Report seller on a seller profile, or the Report action in a conversation or on a message. Choose a reason and add relevant details. Reports are submitted for review; no response time or outcome is guaranteed.</p><div className={styles.actions}><Link className={styles.link} href="/explore">Browse listings</Link><Link className={styles.link} href="/messages">Go to conversations</Link></div></section>
    <p className={styles.intro}>Buyer-to-seller payments are not processed by TAKEME. Agree arrangements together before exchanging an item.</p>
  </>;
}
