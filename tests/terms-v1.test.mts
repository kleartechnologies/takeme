import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { termsDocument, termsSections } from "../src/content/terms.ts";
import { marketplaceOperator } from "../src/content/operator.ts";
import { prohibitedItemsPolicy } from "../src/content/marketplace-rules.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { legalLaunchDatePolicy, legalPublicationReadiness } from "../functions/src/legal-publication.ts";
import { canPublishProductionLegal, resolveLegalDocumentState } from "../src/lib/public-information.ts";
import { buildTermsMetadata } from "../src/lib/terms-metadata.ts";

const expectedTitles = [
  "About TAKEME", "Eligibility", "Browsing Without Acceptance", "Your TAKEME Account",
  "One Account for Buying and Selling", "Role of TAKEME", "Seller Obligations", "Listings",
  "Prohibited and Restricted Items", "Offers and Negotiations", "Auctions", "Messaging",
  "User Content", "Intellectual Property", "Counterfeit and Infringing Goods", "Reviews and Ratings",
  "Complaints and Reports", "Records and Legal Retention", "Privacy", "Account Suspension and Restrictions",
  "Account Deletion", "Marketplace Safety", "Payments Between Users", "Shipping, Delivery and Collection",
  "Fees", "Third-Party Services", "Service Availability", "No Guarantee of Transactions",
  "Limitation of Liability", "Indemnity", "Changes to These Terms", "Governing Law",
  "Severability", "No Waiver", "Contact",
];
const sectionTitle = (title: string) => title.replace(/^\d+\.\s*/, "");
function sectionText(title: string) {
  const section = termsSections.find(value => sectionTitle(value.title) === title);
  assert.ok(section, `Missing Terms section: ${title}`);
  return [...section.paragraphs ?? [], ...section.bullets ?? [], ...section.links?.map(link => link.label) ?? []].join(" ");
}
const termsText = () => termsSections.map(section => sectionText(sectionTitle(section.title))).join(" ");
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Terms V1 preserves all 35 ordered sections with unique usable route anchors", () => {
  assert.deepEqual(termsSections.map(section => sectionTitle(section.title)), expectedTitles);
  assert.deepEqual(termsSections.map(section => Number(section.title.match(/^(\d+)\./)?.[1])), Array.from({ length: 35 }, (_, index) => index + 1));
  assert.equal(new Set(termsSections.map(section => section.id)).size, 35);
  for (const section of termsSections) {
    assert.match(section.id, /^[a-z][a-z0-9-]*$/);
    assert.ok((section.paragraphs?.length ?? 0) + (section.bullets?.length ?? 0) > 0, section.title);
  }
});

test("Terms V1 identity and launch dates use the inactive central production sources", () => {
  assert.equal(termsDocument.title, "TAKEME Terms of Service");
  assert.equal(termsDocument.version, productionReleasePolicy.termsVersion);
  assert.equal(termsDocument.version, "1.0");
  assert.equal(termsDocument.minimumAge, productionReleasePolicy.minimumAge);
  assert.equal(termsDocument.minimumAge, 18);
  assert.equal(termsDocument.effectiveDate, legalPublicationReadiness.effectiveDate);
  assert.equal(termsDocument.lastUpdated, legalPublicationReadiness.lastUpdated);
  assert.equal(termsDocument.effectiveDate, "2026-10-12");
  assert.equal(termsDocument.lastUpdated, "2026-10-12");
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(legalPublicationReadiness.finalContentApproved, false);
  assert.equal(legalLaunchDatePolicy.effectiveDate, "actual-public-launch-date");
  assert.equal(legalLaunchDatePolicy.lastUpdated, "same-as-public-launch-date-for-v1-unless-separately-changed");
  const preview = resolveLegalDocumentState("terms", { nodeEnv: "development", useEmulators: "true", projectId: "demo-takeme" });
  assert.equal(preview.version, termsDocument.version);
  assert.equal(preview.effectiveDate, "2026-10-12");
  assert.equal(preview.lastUpdated, "2026-10-12");
  assert.equal(preview.publicationApproved, false);
});

test("Terms identify the owner-confirmed operator and 18+ eligibility without a business address", () => {
  assert.equal(termsDocument.operator, marketplaceOperator);
  assert.equal(termsDocument.operator.name, "TAKEME TECHNOLOGIES");
  assert.equal(termsDocument.operator.registrationNumber, "KT0622373-U");
  assert.equal(termsDocument.operator.supportEmail, "support.takeme@gmail.com");
  assert.match(sectionText("About TAKEME"), /TAKEME TECHNOLOGIES/);
  assert.match(sectionText("About TAKEME"), /KT0622373-U/);
  assert.match(sectionText("Eligibility"), /18\+|at least 18|18 years old/i);
  assert.match(sectionText("Contact"), /support\.takeme@gmail\.com/);
  assert.equal(termsDocument.businessAddress, null);
  assert.equal(termsDocument.businessAddressStatus, "LEGAL REVIEW / OWNER INPUT REQUIRED");
  assert.equal(legalPublicationReadiness.address, "pending");
  assert.match(sectionText("Contact"), /LEGAL REVIEW \/ OWNER INPUT REQUIRED/);
});

test("Terms permit public browsing and require explicit current acceptance for protected marketplace actions", () => {
  const browsing = sectionText("Browsing Without Acceptance");
  assert.match(browsing, /public brows|browse.*public|brows.*marketplace/i);
  assert.match(browsing, /without.*accept|does not require.*accept|not.*accepted/i);
  assert.match(browsing, /current Terms/i);
  assert.match(browsing, /Privacy/i);
  assert.match(browsing, /Sell/i);
  assert.match(browsing, /Chat|messag/i);
  for (const action of [/Offer/i, /Bid/i, /Save/i, /Follow/i, /upload/i]) assert.match(browsing, action);
  assert.match(browsing, /require|before/i);
  assert.match(browsing, /log(?:ging)?\s*in|login/i);
  assert.match(browsing, /refresh/i);
  assert.match(browsing, /never.*(?:consent|accept)|does not.*(?:consent|accept)|do not.*(?:consent|accept)/i);
});

test("Terms describe one account and the V1 marketplace intermediary transaction responsibilities", () => {
  const about = sectionText("About TAKEME");
  for (const feature of [/discover/i, /list/i, /buy|buyer/i, /sell/i, /messag/i, /offer|negotiat/i, /auction|bid/i, /Save/i, /follow/i, /manage/i]) assert.match(about, feature);
  assert.match(sectionText("One Account for Buying and Selling"), /same account|one account/i);
  const role = sectionText("Role of TAKEME");
  assert.match(role, /platform|intermediar/i);
  assert.match(role, /seller.*responsib/i);
  assert.match(role, /does not.*(?:own|ownership)|do not.*(?:own|ownership)/i);
  assert.match(role, /buyer.*seller|seller.*buyer/i);
  assert.match(role, /complet.*transaction|transaction.*complet/i);
});

test("Terms preserve seller duties and unresolved disclosure obligations", () => {
  const sellers = sectionText("Seller Obligations");
  assert.match(sellers, /lawful|lawfully/i);
  assert.match(sellers, /accurate|truthful/i);
  assert.match(sellers, /condition/i);
  assert.match(sellers, /defect/i);
  assert.match(sellers, /LEGAL REVIEW REQUIRED/);
  for (const detail of [/disclosure/i, /individual/i, /business/i, /national.language/i, /platform|operator/i]) assert.match(sellers, detail);
});

test("Terms incorporate the V1 Prohibited Items Policy without granting final legal approval", () => {
  const prohibited = termsSections.find(section => sectionTitle(section.title) === "Prohibited and Restricted Items");
  assert.ok(prohibited);
  assert.ok(prohibited.links?.some(link => link.href === "/help/prohibited-items"));
  assert.match(sectionText("Prohibited and Restricted Items"), /TAKEME Prohibited Items Policy/);
  assert.match(sectionText("Prohibited and Restricted Items"), /LEGAL REVIEW REQUIRED/);
  assert.equal(prohibitedItemsPolicy.version, productionReleasePolicy.termsVersion);
  assert.equal(prohibitedItemsPolicy.publicationApproved, false);
});

test("Terms reject manipulated auctions and do not guarantee completion for the highest bidder", () => {
  const auctions = sectionText("Auctions");
  assert.match(auctions, /genuine/i);
  assert.match(auctions, /self.bidd|own auction/i);
  assert.match(auctions, /coordinat.*manipulat|manipulat.*coordinat/i);
  for (const reason of [/invalid/i, /stale/i, /abus/i]) assert.match(auctions, reason);
  assert.match(auctions, /reject/i);
  assert.match(auctions, /highest bid/i);
  assert.match(auctions, /does not guarantee|no guarantee/i);
  assert.match(auctions, /buyer.*seller|seller.*buyer/i);
  assert.match(auctions, /responsib/i);
});

test("Offers and messaging preserve good faith and anti-spam, fraud and harassment obligations", () => {
  assert.match(sectionText("Offers and Negotiations"), /good faith|genuine/i);
  const messages = sectionText("Messaging");
  for (const conduct of [/spam/i, /fraud/i, /harass/i]) assert.match(messages, conduct);
  for (const sentence of `${sectionText("Offers and Negotiations")} ${messages}`.split(/(?<=[.!?])\s+/)) {
    if (/TAKEME guarantees (?:payment|refund|fulfilment)/i.test(sentence)) assert.match(sentence, /does not|do not|no guarantee/i);
  }
  assert.match(messages, /does not.*payment guarantee|no payment guarantee/i);
});

test("The operational content licence retains user ownership and is limited to necessary marketplace purposes", () => {
  const content = sectionText("User Content");
  assert.match(content, /retain.*ownership|own.*content/i);
  assert.match(content, /licen[cs]e/i);
  assert.match(content, /reasonably|required|necessary/i);
  for (const purpose of [/host/i, /stor/i, /reproduc/i, /display/i, /resize|resizing/i, /process/i, /operat/i, /secur/i, /improv/i, /promot/i]) assert.match(content, purpose);
  assert.match(content, /retention|retain/i);
  assert.match(content, /legal/i);
  assert.doesNotMatch(content, /TAKEME (?:owns|takes ownership of|becomes the owner of) (?:your|user) content/i);
});

test("Statutory record retention remains a three-year legal-review item and Privacy is linked", () => {
  const retention = sectionText("Records and Legal Retention");
  assert.match(retention, /three years|3 years/i);
  assert.match(retention, /Malaysian|Malaysia/i);
  assert.match(retention, /may.*retain|may.*retention/i);
  assert.match(retention, /LEGAL REVIEW REQUIRED/);
  const privacy = termsSections.find(section => sectionTitle(section.title) === "Privacy");
  assert.ok(privacy?.links?.some(link => link.href === "/privacy"));
  assert.match(sectionText("Privacy"), /TAKEME Privacy Notice/);
});

test("Account deletion supports requests while retaining active obligations and legal caveats", () => {
  const deletion = sectionText("Account Deletion");
  assert.match(deletion, /request.*delet|delet.*request/i);
  assert.match(deletion, /delay|pending/i);
  for (const obligation of [/live auction/i, /transaction/i, /dispute/i, /fraud/i, /secur/i, /investigat/i, /legal hold/i, /statutory retention/i]) assert.match(deletion, obligation);
  for (const sentence of deletion.split(/(?<=[.!?])\s+/)) {
    if (/(?:immediate|immediately) (?:and complete )?(?:erasure|erase|delete.*all)/i.test(sentence)) assert.match(sentence, /does not|do not|not guaranteed/i);
  }
});

test("Payment and shipping remain user arrangements; fees require prior clear disclosure", () => {
  const payments = sectionText("Payments Between Users");
  assert.match(payments, /unless/i);
  assert.match(payments, /integrated payment/i);
  assert.match(payments, /buyer.*seller|seller.*buyer/i);
  assert.match(payments, /responsib/i);
  const shipping = sectionText("Shipping, Delivery and Collection");
  assert.match(shipping, /unless/i);
  assert.match(shipping, /integrated shipping/i);
  assert.match(shipping, /buyer.*seller|seller.*buyer/i);
  assert.match(shipping, /arrang/i);
  const fees = sectionText("Fees");
  assert.match(fees, /future|may introduce/i);
  assert.match(fees, /disclos/i);
  assert.match(fees, /before|prior/i);
  assert.match(fees, /retroactiv/i);
});

test("Terms do not present reserved V2 services as current V1 features", () => {
  const reservedFeatures = /Stripe(?: Connect)?|protected checkout|seller payouts?|\bAWB\b|Seller Centre|short.video commerce|live commerce/gi;
  for (const section of termsSections) {
    for (const paragraph of [...section.paragraphs ?? [], ...section.bullets ?? []]) {
      for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
        if (sentence.match(reservedFeatures)) {
          assert.match(sentence, /future|unless|if introduced|not currently|does not(?: currently)?|do not(?: currently)?|not available/i, `Unqualified future feature in ${section.title}`);
        }
      }
    }
  }
  assert.doesNotMatch(termsText(), /TAKEME (?:currently )?(?:processes|holds|transfers) (?:your |buyer )?(?:payments|funds)/i);
});

test("Liability, indemnity and Malaysian law retain conservative review and mandatory-rights language", () => {
  assert.match(sectionText("Limitation of Liability"), /LEGAL REVIEW REQUIRED/);
  assert.match(sectionText("Indemnity"), /LEGAL REVIEW REQUIRED/);
  assert.match(sectionText("Limitation of Liability"), /cannot.*exclud|non.excludable|mandatory.*rights|permitted by.*law/i);
  assert.doesNotMatch(sectionText("Limitation of Liability"), /exclude all liability|no liability whatsoever/i);
  const law = sectionText("Governing Law");
  assert.match(law, /laws of Malaysia|Malaysian law/i);
  assert.match(law, /consumer|mandatory/i);
  assert.doesNotMatch(law, /exclusive jurisdiction|exclusive forum|courts? (?:of|in) Kuala Lumpur/i);
});

test("Every unresolved legal subject stays expressly marked and the review notice contains no staging text", () => {
  for (const title of ["Seller Obligations", "Prohibited and Restricted Items", "Records and Legal Retention", "Role of TAKEME", "Third-Party Services", "Limitation of Liability", "Indemnity"]) {
    assert.match(sectionText(title), /LEGAL REVIEW REQUIRED/, title);
  }
  assert.match(sectionText("Third-Party Services"), /provider/i);
  assert.match(sectionText("Third-Party Services"), /cross.border/i);
  assert.match(termsDocument.reviewNotice, /draft|review/i);
  assert.match(termsDocument.reviewNotice, /not.*(?:published|in effect)|unpublished/i);
  assert.doesNotMatch(termsDocument.reviewNotice, /staging|synthetic|demo/i);
  assert.doesNotMatch(termsText(), /staging|synthetic demo/i);
});

test("Terms metadata stays noindex for the actual closed source and only the route applies the publication gate", () => {
  assert.equal(canPublishProductionLegal({ nodeEnv: "production", useEmulators: "false", projectId: "takeme-52b80" }), false);
  const metadata = buildTermsMetadata(false);
  assert.deepEqual(metadata.title, { absolute: termsDocument.title });
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  assert.equal(metadata.alternates?.canonical, "/terms");
  assert.equal(metadata.openGraph?.title, termsDocument.title);
  assert.equal(metadata.openGraph?.url, "/terms");
  const route = source("../src/app/terms/page.tsx");
  assert.match(route, /requireLegalInformation\(\)/);
  assert.match(route, /buildTermsMetadata\(isProductionLegalPublication\(\)\)/);
  assert.match(route, /policy="terms"/);
  assert.match(route, /reviewNotice=\{termsDocument\.reviewNotice\}/);
});

test("Terms route supplies all sections to accessible mobile and desktop rendering", () => {
  const route = source("../src/app/terms/page.tsx");
  assert.match(route, /sections=\{termsSections\}/);
  assert.match(route, /PolicySections sections=\{termsSections\}/);
  const renderer = source("../src/components/public-information/public-information.tsx");
  assert.match(renderer, /<details className=\{styles\.mobileToc\}>/);
  assert.match(renderer, /<summary>On this page<\/summary>/);
  assert.match(renderer, /aria-label="Page sections"/);
  assert.match(renderer, /<aside className=\{styles\.desktopToc\}>/);
  assert.match(renderer, /aria-labelledby=\{section\.id\}/);
  assert.match(renderer, /<h2 id=\{section\.id\}/);
  const css = source("../src/components/public-information/public-information.module.css");
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /\.mobileToc\s*\{[^}]*display:\s*block/);
  assert.match(css, /\.desktopToc\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.article\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.desktopToc\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/);
});
