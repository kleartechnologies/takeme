import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { privacyDocument, privacySections } from "../src/content/privacy.ts";
import { privacyNotices } from "../src/content/privacy-notices.ts";
import { bmPrivacySections } from "../src/content/privacy-bm.ts";
import { marketplaceOperator } from "../src/content/operator.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";
import { canPublishProductionLegal, resolveLegalDocumentState } from "../src/lib/public-information.ts";
import { canRenderBmPrivacyNotice, hasApprovedBmPrivacyNotice } from "../src/lib/privacy-notice.ts";
import { buildPrivacyMetadata } from "../src/lib/privacy-metadata.ts";

const coverage = [
  /who we are/i, /scope.*privacy notice/i, /what personal data we collect/i,
  /data provided by users/i, /account.*authentication/i, /profile data/i,
  /listing.*product content/i, /messaging.*offer.*auction/i, /saved.*following.*preferences/i,
  /(?:device.*)?technical.*security/i, /support.*report.*dispute/i, /policy acceptance evidence/i,
  /how we use personal data/i, /legal.*compliance.*security purposes/i, /marketplace operation purposes/i,
  /personali[sz]ation.*discovery/i, /fraud.*abuse prevention/i, /service providers/i,
  /data sharing/i, /international.*cross.border processing/i, /retention/i,
  /account deletion/i, /legal holds.*disputes/i, /^security$/i,
  /(?:user|your) rights.*applicable law/i, /children.*minimum age/i, /cookies.*analytics/i,
  /changes to this notice/i, /^contact$/i,
];
const unnumbered = (title: string) => title.replace(/^\d+\.\s*/, "");
const sectionCopy = (section: typeof privacySections[number]) => [
  ...section.paragraphs ?? [], ...section.bullets ?? [], ...section.links?.map(link => link.label) ?? [],
].join(" ");
function copy(title: RegExp) {
  const section = privacySections.find(value => title.test(unnumbered(value.title)));
  assert.ok(section, `Missing Privacy coverage: ${title}`);
  return sectionCopy(section);
}
const allCopy = () => privacySections.map(sectionCopy).join(" ");
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("English Privacy V1 covers every requested topic with 29 ordered accessible sections", () => {
  assert.equal(privacySections.length, coverage.length);
  for (const [index, section] of privacySections.entries()) {
    assert.match(unnumbered(section.title), coverage[index]);
    assert.equal(Number(section.title.match(/^(\d+)\./)?.[1]), index + 1);
    assert.match(section.id, /^[a-z][a-z0-9-]*$/);
    assert.ok((section.paragraphs?.length ?? 0) + (section.bullets?.length ?? 0) > 0, section.title);
  }
  assert.equal(new Set(privacySections.map(section => section.id)).size, coverage.length);
});

test("Privacy identity uses central V1 identifiers and keeps publication and launch dates unresolved", () => {
  assert.equal(privacyDocument.title, "TAKEME Privacy Notice");
  assert.equal(privacyDocument.language, "English");
  assert.equal(privacyDocument.version, productionReleasePolicy.privacyVersion);
  assert.equal(privacyDocument.version, "1.0");
  assert.equal(privacyDocument.minimumAge, productionReleasePolicy.minimumAge);
  assert.equal(privacyDocument.minimumAge, 18);
  assert.equal(privacyDocument.effectiveDate, legalPublicationReadiness.effectiveDate);
  assert.equal(privacyDocument.lastUpdated, legalPublicationReadiness.lastUpdated);
  assert.equal(privacyDocument.effectiveDate, null);
  assert.equal(privacyDocument.lastUpdated, null);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(legalPublicationReadiness.finalContentApproved, false);
  const preview = resolveLegalDocumentState("privacy", { nodeEnv: "development", useEmulators: "true", projectId: "demo-takeme" });
  assert.equal(preview.version, "1.0");
  assert.equal(preview.effectiveDate, null);
  assert.equal(preview.lastUpdated, null);
  assert.equal(preview.publicationApproved, false);
});

test("Privacy identifies the confirmed operator and contact without inventing an address", () => {
  assert.equal(privacyDocument.operator, marketplaceOperator);
  assert.equal(privacyDocument.operator.name, "TAKEME TECHNOLOGIES");
  assert.equal(privacyDocument.operator.registrationNumber, "KT0622373-U");
  assert.equal(privacyDocument.operator.supportEmail, "support.takeme@gmail.com");
  assert.equal(privacyDocument.operator.privacyLegalEmail, "support.takeme@gmail.com");
  assert.equal(privacyDocument.businessAddress, null);
  assert.equal(privacyDocument.businessAddressStatus, "LEGAL REVIEW / OWNER INPUT REQUIRED");
  assert.equal(legalPublicationReadiness.address, "pending");
  for (const identity of [/TAKEME TECHNOLOGIES/, /KT0622373-U/, /support\.takeme@gmail\.com/, /LEGAL REVIEW \/ OWNER INPUT REQUIRED/]) assert.match(copy(/^contact$/i), identity);
});

test("Account and profile data describe V1 authentication without publishing private account identity", () => {
  const account = copy(/account.*authentication/i);
  for (const category of [/email/i, /Google/i, /identifier|account ID/i, /status/i]) assert.match(account, category);
  assert.match(account, /Firebase/i);
  const profile = copy(/profile data/i);
  for (const publicData of [/display name|seller\/profile name/i, /photo|image/i, /public/i, /seller/i]) assert.match(profile, publicData);
  const text = `${account} ${profile} ${copy(/what personal data we collect/i)}`;
  assert.match(text, /email.*(?:not|private|restricted)|(?:not|private|restricted).*email/i);
});

test("Public content is distinguished from private addresses and private account state", () => {
  const text = allCopy();
  for (const publicData of [/public.*profile|profile.*public/i, /published.*listing|listing.*public/i, /review|rating/i]) assert.match(text, publicData);
  assert.match(text, /private address/i);
  assert.match(text, /private address[^.]*not[^.]*public|private address[^.]*not[^.]*shown|not[^.]*public[^.]*private address/i);
  assert.match(text, /private address[^.]*not[^.]*automatically|not[^.]*automatically[^.]*private address/i);
  for (const restrictedData of [/acceptance history/i, /saved.*private|private.*saved/i, /report.*restricted|restricted.*report/i, /deletion.*record/i]) assert.match(text, restrictedData);
});

test("Listings, messaging, offers and auctions disclose actual marketplace data and limited participants", () => {
  const listings = copy(/listing.*product content/i);
  for (const category of [/title/i, /description/i, /categor/i, /price/i, /image|photo/i, /draft/i]) assert.match(listings, category);
  assert.match(listings, /listing.promotion request/i);
  for (const requestData of [/seller\/listing reference/i, /package\/type/i, /example price\/duration/i, /request\/payment.setup status/i, /timestamps/i]) assert.match(listings, requestData);
  assert.match(listings, /checkout, payment and paid activation remain unavailable/i);
  assert.match(listings, /saving a request does not buy extra placement or take a payment/i);
  const interactions = copy(/messaging.*offer.*auction/i);
  for (const category of [/message/i, /offer/i, /bid/i, /auction/i, /participant/i, /timestamp/i]) assert.match(interactions, category);
  assert.match(interactions, /not public|private|restricted/i);
  assert.match(interactions, /safety|abuse|support|dispute/i);
  for (const sentence of interactions.split(/(?<=[.!?])\s+/)) {
    if (/staff routinely read|routinely read by staff|all messages.*staff/i.test(sentence)) assert.match(sentence, /does not mean|do not|not routinely/i);
  }
});

test("Saved, following, settings and Updates remain supported in-app activity", () => {
  const preferences = copy(/saved.*following.*preferences/i);
  for (const feature of [/saved/i, /follow/i, /search/i, /setting|preference/i, /notification|Updates/i]) assert.match(preferences, feature);
  assert.match(preferences, /private/i);
  assert.match(preferences, /aggregate.*follower|follower.*aggregate/i);
});

test("Technical and support disclosures stay bounded to operation, evidence and security", () => {
  const technical = copy(/(?:device.*)?technical.*security/i);
  for (const category of [/browser|device/i, /timestamp/i, /request/i, /security|abuse/i, /log/i]) assert.match(technical, category);
  assert.match(technical, /where|may|supported|necessary|reasonably/i);
  const support = copy(/support.*report.*dispute/i);
  for (const purpose of [/support/i, /report/i, /dispute/i, /evidence/i, /restrict|authori[sz]/i]) assert.match(support, purpose);
  assert.doesNotMatch(support, /permanent retention|retained permanently|retained indefinitely/i);
});

test("Policy evidence is immutable server-authored acceptance history with bounded eligibility purposes", () => {
  const evidence = copy(/policy acceptance evidence/i);
  for (const requirement of [/immutable/i, /server/i, /Terms.*version|version.*Terms/i, /Privacy.*version|version.*Privacy/i, /18\+/i, /timestamp/i, /source|context/i, /eligib/i, /compliance|evidence/i, /reaccept/i]) assert.match(evidence, requirement);
  assert.doesNotMatch(allCopy(), /releasePolicies\/current|users\/[^{\s]+\/private|policyAcceptances\/events|accountSetup\/current|eligibility\/current/i);
});

test("Privacy acceptance remains explicit for new users and outdated users before protected actions", () => {
  const text = allCopy();
  assert.match(text, /new users|new accounts|create.*account/i);
  assert.match(text, /explicit.*accept|accept.*explicit/i);
  assert.match(text, /outdated|older|previous.*version|reaccept/i);
  assert.match(text, /public.*brows|brows.*public/i);
  assert.match(text, /protected.*action|protected.*write/i);
  for (const action of [/Sell/i, /Chat|messag/i, /Offer/i, /Bid/i, /Save/i, /Follow/i, /upload/i]) assert.match(text, action);
  assert.match(text, /login|logging in/i);
  assert.match(text, /refresh/i);
  assert.match(text, /never.*accept|never.*consent|does not.*accept|does not.*consent/i);
  assert.match(text, /no.*automatic.*action|not.*automatically.*(?:action|execute|send|bid|offer|Save|Follow|publish)|do not.*automatically.*(?:action|execute)|without.*automatically.*(?:action|execut)/i);
});

test("Processing purposes cover the current marketplace without external advertising profiling", () => {
  const use = `${copy(/how we use personal data/i)} ${copy(/marketplace operation purposes/i)}`;
  for (const purpose of [/account/i, /listing/i, /communicat|message/i, /offer/i, /auction/i, /saved/i, /follow/i, /support/i, /delet/i, /reliab/i]) assert.match(use, purpose);
  const discovery = copy(/personali[sz]ation.*discovery/i);
  assert.match(discovery, /marketplace/i);
  assert.match(discovery, /currently|supported|implemented/i);
  assert.match(discovery, /recommend|rank|relevan/i);
  assert.match(discovery, /not.*(?:other websites|external|advertising)|no.*(?:external|advertising)/i);
});

test("Legal and abuse purposes stay limited to enforcement, restricted investigations and necessary records", () => {
  const legal = copy(/legal.*compliance.*security purposes/i);
  for (const purpose of [/law|legal/i, /Terms/i, /record/i, /investigat/i, /secur/i]) assert.match(legal, purpose);
  const fraud = copy(/fraud.*abuse prevention/i);
  for (const purpose of [/fraud/i, /abus/i, /spam|rate|misuse/i, /restrict|bounded|limit/i]) assert.match(fraud, purpose);
});

test("Actual providers and cross-border processing remain subject to legal review without invented countries", () => {
  const providers = copy(/service providers/i);
  for (const provider of [/Firebase|Google Cloud/i, /Cloudflare/i, /Google.*sign.in|authentication/i, /support|email/i]) assert.match(providers, provider);
  assert.match(providers, /LEGAL REVIEW REQUIRED/);
  const transfer = copy(/international.*cross.border processing/i);
  assert.match(transfer, /outside Malaysia/i);
  assert.match(transfer, /may/i);
  assert.match(transfer, /LEGAL REVIEW REQUIRED/);
  assert.doesNotMatch(transfer, /(?:stored|hosted|processed) (?:only |exclusively |entirely )?in (?:Singapore|United States|Europe|China|Australia)/i);
});

test("Sharing is limited to service and lawful purposes and does not sell data to advertisers", () => {
  const sharing = copy(/data sharing/i);
  assert.match(sharing, /TAKEME does not sell personal data to advertisers/i);
  for (const recipient of [/provider/i, /other users|marketplace.*users|participant/i, /authorit|law/i, /security|fraud/i]) assert.match(sharing, recipient);
  assert.match(sharing, /necessary|limited|lawful/i);
});

test("Retention describes purposes and existing bounded cleanup, retaining unresolved legal reconciliation", () => {
  const retention = copy(/^retention$/i);
  for (const category of [/account|profile/i, /marketplace/i, /pseudonym/i, /report|dispute/i, /security|audit/i, /backup|log/i]) assert.match(retention, category);
  assert.match(retention, /LEGAL REVIEW REQUIRED/);
  assert.match(retention, /Malaysian|Malaysia/i);
  assert.match(retention, /statutory|marketplace record/i);
  for (const sentence of retention.split(/(?<=[.!?])\s+/)) {
    if (/retained forever|indefinite default|all.*permanently retained/i.test(sentence)) assert.match(sentence, /no |not |does not/i);
  }
});

test("Deletion supports requests and partial cleanup without rewriting outcomes or promising instant erasure", () => {
  const deletion = copy(/account deletion/i);
  assert.match(deletion, /request/i);
  for (const caveat of [/live auction/i, /deal|transaction/i, /dispute/i, /fraud|security/i, /legal hold/i, /statutory/i, /pseudonym|retain/i, /backup|log/i]) assert.match(deletion, caveat);
  assert.match(deletion, /pending|delay|limit/i);
  assert.match(deletion, /does not.*(?:fabricate|rewrite)|not.*(?:fabricate|rewrite)/i);
  assert.match(deletion, /not.*(?:immediate|all data)|does not.*(?:immediate|all data)|not.*(?:erase|erasure)|no immediate.*erasure/i);
  assert.match(deletion, /production.*(?:off|disabled)|(?:off|disabled).*production/i);
  const section = privacySections.find(value => /account deletion/i.test(unnumbered(value.title)));
  assert.ok(section?.links?.some(link => link.href === "/account-deletion"));
});

test("Legal holds, backups and logs have purpose, restriction and unresolved retention requirements", () => {
  const holds = copy(/legal holds.*disputes/i);
  for (const marker of [/LEGAL REVIEW REQUIRED/, /restrict/i, /purpose|necessary/i, /expir|bounded|limit|period/i, /backup/i, /log/i]) assert.match(holds, marker);
  assert.match(holds, /security\/fraud holds require a documented purpose and expiry/i);
  assert.match(holds, /open report\/dispute evidence can await valid resolution before its bounded closure.based expiry is set/i);
  assert.doesNotMatch(holds, /(?:all|every) (?:open )?(?:report|dispute|case|hold)[^.]*fixed (?:expiry|period|deadline)/i);
  assert.match(holds, /reappl|deletion state|cleanup.*restore|restor.*cleanup/i);
});

test("User rights remain conditional on Malaysian law without absolute GDPR-style promises", () => {
  const rights = copy(/(?:user|your) rights.*applicable law/i);
  for (const right of [/access/i, /correct/i, /withdraw.*consent/i, /limit.*process/i, /complaint|contact/i, /delet/i]) assert.match(rights, right);
  assert.match(rights, /where applicable|where.*law|subject to|as provided/i);
  assert.match(rights, /LEGAL REVIEW REQUIRED/);
  assert.match(rights, /Malaysia|Malaysian/i);
  assert.doesNotMatch(rights, /unconditional right|guaranteed.*erasure|absolute.*right|GDPR applies to every user/i);
});

test("Age and security disclosures require adults and avoid absolute protection promises", () => {
  const children = copy(/children.*minimum age/i);
  assert.match(children, /at least 18|18\+|18 years/i);
  assert.match(children, /below 18|under 18/i);
  assert.match(children, /should not.*account|must not.*account/i);
  assert.match(children, /protected marketplace/i);
  const security = copy(/^security$/i);
  assert.match(security, /technical.*organisational|organisational.*technical/i);
  assert.match(security, /no.*absolute|cannot guarantee|does not guarantee/i);
  assert.match(security, /LEGAL REVIEW REQUIRED/);
  assert.match(security, /breach/i);
  assert.match(security, /DPO|data protection officer/i);
});

test("Browser storage and analytics wording reflect only implemented authentication and marketplace use", () => {
  const browser = copy(/cookies.*analytics/i);
  assert.match(browser, /local storage|browser storage/i);
  assert.match(browser, /sign.in|auth|session/i);
  assert.match(browser, /marketplace.*(?:activity|signals)|(?:activity|signals).*marketplace/i);
  assert.match(browser, /no.*(?:external|third.party).*analytics|not.*(?:external|third.party).*analytics|no active.*analytics|does not enable[^.]*Firebase Analytics/i);
  assert.match(browser, /no.*marketing|not.*marketing/i);
});

test("Reserved V2 services are not described as current collection or processing", () => {
  const reserved = /Stripe(?: Connect)?|payment.card|seller payouts?|\bAWB\b|Seller Centre|short.video|live commerce|native push|V2 analytics/gi;
  for (const section of privacySections) {
    for (const paragraph of [...section.paragraphs ?? [], ...section.bullets ?? []]) {
      for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
        if (sentence.match(reserved)) assert.match(sentence, /future|unless|if introduced|not currently|does not(?: currently)?|do not(?: currently)?|not active|not available|not implemented|no active|not payment.card/i, `Current future-feature claim in ${section.title}`);
      }
    }
  }
});

test("English draft retains every legal-review topic without staging or invented date text", () => {
  for (const topic of [/service providers/i, /international.*cross.border/i, /^retention$/i, /account deletion/i, /legal holds.*disputes/i, /^security$/i, /(?:user|your) rights/i, /^contact$/i]) assert.match(copy(topic), /LEGAL REVIEW REQUIRED|LEGAL REVIEW \/ OWNER INPUT REQUIRED/, String(topic));
  assert.match(allCopy(), /final English.*LEGAL REVIEW REQUIRED|LEGAL REVIEW REQUIRED.*final English|English.*legal approval/i);
  assert.match(allCopy(), /Bahasa Melayu|BM Privacy/i);
  assert.match(allCopy(), /LEGAL REVIEW REQUIRED/);
  assert.match(privacyDocument.reviewNotice, /draft|review/i);
  assert.match(privacyDocument.reviewNotice, /not.*published|unpublished|not in effect/i);
  assert.doesNotMatch(privacyDocument.reviewNotice, /staging|synthetic|demo/i);
  assert.doesNotMatch(allCopy(), /staging|synthetic demo/i);
  assert.doesNotMatch(allCopy(), /(?:Effective|Last updated)(?: date)?:?\s*\d{4}-\d{2}-\d{2}/i);
});

test("Supplied BM owner draft still requires independent legal approval and cannot publish", () => {
  assert.equal(privacyNotices.en.sections, privacySections);
  assert.equal(privacyNotices.en.href, "/privacy");
  assert.equal(privacyNotices.bm.href, "/privacy/bm");
  assert.equal(privacyNotices.bm.sections, bmPrivacySections);
  assert.equal(legalPublicationReadiness.bmPrivacyNoticeApproved, false);
  assert.equal(hasApprovedBmPrivacyNotice(), false);
  const approvedFlag = { ...legalPublicationReadiness, bmPrivacyNoticeApproved: true };
  const syntheticApprovedSections = [{ id: "synthetic", title: "Synthetic approved BM notice", paragraphs: ["Test content only"] }];
  assert.equal(hasApprovedBmPrivacyNotice(approvedFlag, null), false, "An approval flag cannot manufacture missing translation");
  assert.equal(hasApprovedBmPrivacyNotice(approvedFlag, []), false);
  assert.equal(hasApprovedBmPrivacyNotice(legalPublicationReadiness, syntheticApprovedSections), false, "Supplied text still needs independent approval");
  assert.equal(hasApprovedBmPrivacyNotice(approvedFlag, syntheticApprovedSections), true, "Synthetic test-only approval and text");
  assert.equal(canRenderBmPrivacyNotice({ nodeEnv: "production", useEmulators: "false", projectId: "takeme-52b80" }), false);
  const route = source("../src/app/privacy/bm/page.tsx");
  assert.match(route, /requireLegalInformation\(\)/);
  assert.match(route, /canRenderBmPrivacyNotice/);
  assert.match(route, /notFound\(\)/);
});

test("Privacy route uses the existing closed publication gate and pure draft metadata", () => {
  assert.equal(canPublishProductionLegal({ nodeEnv: "production", useEmulators: "false", projectId: "takeme-52b80" }), false);
  const metadata = buildPrivacyMetadata(false);
  assert.deepEqual(metadata.title, { absolute: privacyDocument.title });
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  assert.equal(metadata.alternates?.canonical, "/privacy");
  assert.deepEqual(metadata.alternates?.languages, { en: "/privacy" });
  assert.deepEqual(buildPrivacyMetadata(true).alternates?.languages, { en: "/privacy" }, "Even metadata for a hypothetical published EN route cannot advertise missing/unapproved BM content");
  assert.equal(metadata.openGraph?.title, privacyDocument.title);
  assert.equal(metadata.openGraph?.url, "/privacy");
  const route = source("../src/app/privacy/page.tsx");
  assert.match(route, /requireLegalInformation\(\)/);
  assert.match(route, /buildPrivacyMetadata\(isProductionLegalPublication\(\)\)/);
  assert.match(route, /policy="privacy"/);
  assert.match(route, /reviewNotice=\{privacyDocument\.reviewNotice\}/);
});

test("Privacy sections keep mobile and desktop accessible rendering without new layout code", () => {
  const route = source("../src/app/privacy/page.tsx");
  assert.match(route, /sections=\{privacySections\}/);
  assert.match(route, /PolicySections sections=\{privacySections\}/);
  assert.match(route, /PrivacyLanguages current="en"/);
  const renderer = source("../src/components/public-information/public-information.tsx");
  assert.match(renderer, /aria-label="Page sections"/);
  assert.match(renderer, /aria-labelledby=\{section\.id\}/);
  assert.match(renderer, /<h2 id=\{section\.id\}/);
  const css = source("../src/components/public-information/public-information.module.css");
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /\.mobileToc\s*\{[^}]*display:\s*block/);
  assert.match(css, /\.desktopToc\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.article\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/);
});
