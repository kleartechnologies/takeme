import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  prohibitedItems,
  prohibitedItemsIntro,
  prohibitedItemsPolicy,
  prohibitedItemsReviewNotice,
  prohibitedItemsSections,
} from "../src/content/marketplace-rules.ts";
import { marketplaceOperator } from "../src/content/operator.ts";
import { termsDocument, termsSections } from "../src/content/terms.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";
import { canPreviewLegalDraft, canPublishProductionLegal, resolveLegalDocumentState } from "../src/lib/public-information.ts";
import { buildProhibitedItemsMetadata } from "../src/lib/prohibited-items-metadata.ts";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const sectionCopy = (section: typeof prohibitedItemsSections[number]) => [
  ...section.paragraphs ?? [], ...section.bullets ?? [], ...section.links?.map(link => link.label) ?? [],
].join(" ");
function copy(id: string) {
  const section = prohibitedItemsSections.find(value => value.id === id);
  assert.ok(section, `Missing policy coverage: ${id}`);
  return sectionCopy(section);
}
const allCopy = () => prohibitedItemsSections.map(sectionCopy).join(" ");
const legalReview = /LEGAL REVIEW REQUIRED/;

// The owner-reviewed list is a compatibility contract. The expanded draft may
// explain restrictions but cannot silently replace or broaden these originals.
const reviewedCategories = [
  "Illegal goods or services.",
  "Firearms, ammunition, explosives and regulated weapons.",
  "Illegal drugs and controlled substances.",
  "Counterfeit goods and unauthorised replicas.",
  "Stolen goods.",
  "Pornography, explicit sexual content or sexual services.",
  "Human trafficking or exploitation.",
  "Dangerous or hazardous materials.",
  "Prescription medicines sold unlawfully.",
  "Tobacco or nicotine products where unlawful or age-restricted.",
  "Alcohol where unlawful or age-restricted.",
  "Gambling services or products where unlawful.",
  "Fake documents, IDs or credentials.",
  "Financial scams, pyramid schemes or fraudulent investment offers.",
  "Malware, stolen accounts, hacked credentials or illegal digital access.",
  "Goods that infringe copyright, trademark or other intellectual-property rights.",
  "Wildlife or protected-species products where prohibited.",
  "Any item TAKEME reasonably determines creates legal, safety, fraud or abuse risk.",
];

test("Prohibited Items V1 preserves the exact reviewed category list and order", () => {
  assert.deepEqual(prohibitedItems, reviewedCategories);
});

test("Prohibited Items policy identity is part of the central inactive Terms V1 source", () => {
  assert.equal(prohibitedItemsPolicy.title, "TAKEME Prohibited Items Policy");
  assert.equal(prohibitedItemsPolicy.version, "1.0");
  assert.equal(prohibitedItemsPolicy.version, productionReleasePolicy.termsVersion);
  assert.equal(prohibitedItemsPolicy.version, termsDocument.version);
  assert.equal(prohibitedItemsPolicy.publicationApproved, false);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(legalPublicationReadiness.finalContentApproved, false);
  assert.equal(prohibitedItemsPolicy.effectiveDate, null);
  assert.equal(prohibitedItemsPolicy.lastUpdated, null);
  assert.equal(prohibitedItemsPolicy.effectiveDate, legalPublicationReadiness.effectiveDate);
  assert.equal(prohibitedItemsPolicy.lastUpdated, legalPublicationReadiness.lastUpdated);
  const preview = resolveLegalDocumentState("terms", { nodeEnv: "development", useEmulators: "true", projectId: "demo-takeme" });
  assert.equal(preview.version, prohibitedItemsPolicy.version);
  assert.equal(preview.publicationApproved, false);
  assert.equal(preview.effectiveDate, null);
  assert.equal(preview.lastUpdated, null);
});

test("Policy uses the confirmed operator, SSM and reporting email without a business address", () => {
  assert.equal(prohibitedItemsPolicy.operator, marketplaceOperator);
  assert.equal(prohibitedItemsPolicy.operator.name, "TAKEME TECHNOLOGIES");
  assert.equal(prohibitedItemsPolicy.registrationNumber, "KT0622373-U");
  assert.equal(prohibitedItemsPolicy.supportEmail, "support.takeme@gmail.com");
  assert.equal(prohibitedItemsPolicy.businessAddress, null);
  assert.equal(prohibitedItemsPolicy.businessAddressStatus, "LEGAL REVIEW / OWNER INPUT REQUIRED");
  for (const detail of [/TAKEME TECHNOLOGIES/, /KT0622373-U/, /support\.takeme@gmail\.com/]) assert.match(copy("terms-contact"), detail);
});

test("Policy sections have unique accessible anchors and useful content for every reviewed risk group", () => {
  const required = ["scope", "responsibility", "stolen-fraud", "counterfeit-ip", "weapons", "drugs-medicines", "hazardous", "alcohol-tobacco", "health-consumables", "exploitation", "extremism", "wildlife", "digital", "gambling-services", "evasion", "enforcement", "reports", "terms-contact"];
  assert.equal(new Set(prohibitedItemsSections.map(section => section.id)).size, prohibitedItemsSections.length);
  for (const id of required) assert.ok(prohibitedItemsSections.some(section => section.id === id), id);
  for (const section of prohibitedItemsSections) {
    assert.match(section.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(section.title.trim().length > 0, section.id);
    assert.ok((section.paragraphs?.length ?? 0) + (section.bullets?.length ?? 0) > 0, section.id);
    for (const link of section.links ?? []) {
      assert.ok(link.label.trim().length > 0, section.id);
      assert.match(link.href, /^(?:\/|https:\/\/|mailto:)/, section.id);
    }
  }
});

test("General rule covers prohibited commerce and marketplace safety without certifying every listing", () => {
  const text = `${prohibitedItemsIntro} ${copy("scope")} ${copy("responsibility")}`;
  for (const conduct of [/list/i, /offer/i, /request/i, /advertis/i, /buy/i, /sell/i]) assert.match(text, conduct);
  for (const risk of [/illegal|unlawful/i, /unsafe/i, /fraud/i, /counterfeit/i, /stolen/i, /authori[sz]ation/i, /TAKEME.*policy|policy.*TAKEME/i]) assert.match(text, risk);
  assert.match(text, /seller.*responsib|responsib.*seller/i);
  assert.match(text, /lawful|lawfully/i);
  assert.match(text, /truthful|accurate/i);
  assert.match(allCopy(), /not.*(?:pre.approv|inspect|authenticat)|does not.*(?:pre.approv|inspect|authenticat)|is not.*(?:pre.approv|inspect|authenticat)/i);
});

test("Stolen and fraudulent goods include property, accounts, fake vouchers and documents", () => {
  const text = copy("stolen-fraud");
  for (const category of [/stolen.*(?:goods|property)|(?:goods|property).*stolen/i, /fraud/i, /credential/i, /voucher|code/i, /forged|fake.*document/i, /fake.*(?:ID|identification)/i]) assert.match(text, category);
  assert.match(copy("digital"), /hacked account/i);
  assert.match(text, /must not|prohibit|not allowed|do not/i);
});

test("Counterfeit and IP rules preserve unlawful scope and authenticity evidence checks", () => {
  const text = copy("counterfeit-ip");
  for (const category of [/counterfeit/i, /brand/i, /unauthori[sz]ed replica/i, /pirat/i, /copyright/i, /trademark/i, /intellectual.property/i]) assert.match(text, category);
  assert.match(text, /unlawful|infring|illegal/i);
  assert.match(text, /authenticity.*evidence|evidence.*authenticity/i);
  assert.match(text, /may.*request|request.*document|request.*evidence/i);
});

test("Weapons rules cover firearms, ammunition, explosives and unlawful accessories with legal review", () => {
  const text = copy("weapons");
  for (const category of [/firearm/i, /ammunition/i, /explosive/i, /weapon/i, /accessor/i, /serious harm/i]) assert.match(text, category);
  assert.match(text, /regulated|unlawful|prohibited/i);
  assert.match(text, legalReview);
  assert.doesNotMatch(text, /instructions? to (?:assemble|modify|acquire)|how to (?:assemble|modify|acquire)/i);
});

test("Drug and medicine rules distinguish unlawful restricted sales from seller duties", () => {
  const text = copy("drugs-medicines");
  for (const category of [/illegal drugs/i, /controlled substances/i, /paraphernalia/i, /prescription/i, /restricted medicine/i]) assert.match(text, category);
  assert.match(text, /unlawful|illegally|lawful authori[sz]ation/i);
  assert.match(text, /lawful/i);
  assert.match(text, /accurate|truthful/i);
  assert.match(text, legalReview);
});

test("Dangerous-goods policy covers hazardous substances and recalls without inventing regulator rules", () => {
  const text = copy("hazardous");
  for (const category of [/toxic/i, /hazardous.*chemical|chemical.*hazardous/i, /radioactive/i, /pesticide/i, /precursor/i, /recall/i]) assert.match(text, category);
  assert.match(text, /regulated|authori[sz]ation|legal/i);
  assert.match(text, legalReview);
});

test("Alcohol, tobacco and nicotine retain reviewed restriction qualifiers without declaring universal illegality", () => {
  const text = copy("alcohol-tobacco");
  for (const category of [/alcohol/i, /tobacco/i, /nicotine/i]) assert.match(text, category);
  assert.match(text, /where unlawful|unlawful or age.restricted|age.restricted/i);
  assert.match(text, legalReview);
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (/(?:all|every) (?:alcohol|tobacco|nicotine)[^.]* (?:is|are) (?:always )?(?:illegal|unlawful)/i.test(sentence)) assert.match(sentence, /not a claim|does not claim|not.*always/i);
  }
  assert.match(text, /platform|marketplace/i);
});

test("Health and consumable rules cover unsafe claims and goods while leaving lawful-sale responsibility with sellers", () => {
  const text = copy("health-consumables");
  for (const category of [/food|consumab/i, /cosmetic/i, /health/i, /unsafe/i, /recall/i, /medical claim/i, /adulterat/i, /supplement/i, /authori[sz]ation/i]) assert.match(text, category);
  assert.match(text, /lawful/i);
  assert.match(text, /accurate|truthful/i);
  assert.match(text, legalReview);
});

test("Sexual and exploitative rules expressly prohibit CSAM and trafficking in professional terms", () => {
  const text = copy("exploitation");
  for (const category of [/pornography/i, /explicit sexual/i, /sexual services/i, /human trafficking/i, /human remains/i, /body parts/i, /child sexual abuse material|CSAM/i, /sexual exploitation.*minor|minor.*sexual exploitation/i]) assert.match(text, category);
  assert.match(text, /prohibit|must not|not allowed/i);
});

test("Extremist and wildlife rules preserve unlawful scope without unverified species lists", () => {
  const extremist = copy("extremism");
  for (const category of [/extremist/i, /terrorist/i, /propaganda/i, /merchandise/i, /fundrais/i]) assert.match(extremist, category);
  assert.match(extremist, /unlawful|illegal|where.*law/i);
  const wildlife = copy("wildlife");
  for (const category of [/protected wildlife/i, /endangered/i, /ivory/i, /environmental contraband/i]) assert.match(wildlife, category);
  assert.match(wildlife, /unlawful|illegal|where.*prohibit/i);
  assert.match(wildlife, legalReview);
});

test("Digital and services restrictions address unlawful offers without expanding V1 commerce", () => {
  const digital = copy("digital");
  for (const category of [/malware/i, /spyware/i, /stolen[^.]*credential/i, /hacked account/i, /piracy|pirat/i, /fraudulent.*(?:key|access)|(?:key|access).*fraudulent/i, /surveillance/i, /stolen digital/i]) assert.match(digital, category);
  assert.match(digital, /unlawful|illegal/i);
  assert.match(digital, /not.*(?:support|introduc|launch)|does not.*(?:support|introduc|launch)|no.*dedicated.*digital/i);
  const services = copy("gambling-services");
  for (const category of [/gambling/i, /pyramid/i, /Ponzi/i, /fraudulent/i, /illegal services/i]) assert.match(services, category);
  assert.match(services, /does not.*(?:expand|introduc)|not.*(?:expand|introduc)|goods.*primar|primar.*goods/i);
});

test("Listing manipulation rules forbid disguises, misleading categories and off-platform evasion", () => {
  const text = copy("evasion");
  for (const method of [/disguis/i, /categor/i, /title/i, /image/i, /redirect/i, /elsewhere|off.platform/i, /code word/i, /evad|evasion|bypass/i]) assert.match(text, method);
  assert.match(text, /must not|do not|prohibit/i);
});

test("Enforcement permits proportionate restrictions, documents and lawful evidence handling without automatic police promises", () => {
  const text = copy("enforcement");
  for (const action of [/remove|hide/i, /listing ability|listing.*restrict|restrict.*listing/i, /suspend|account.*restrict|restrict.*account/i, /document|evidence.*authentic/i, /investigat.*report|report.*investigat/i, /preserv.*evidence|evidence.*preserv/i, /authorit/i]) assert.match(text, action);
  assert.match(text, /may/i);
  assert.match(text, /reasonabl|necessary/i);
  assert.match(text, /required by law|lawfully|required.*law|law.*required/i);
  assert.match(text, legalReview);
  assert.match(text, /not.*automatic|does not.*automatic|no.*automatic/i);
  assert.doesNotMatch(text, /(?:every|all) (?:violation|case|report)[^.]*automatically[^.]*police/i);
});

test("Reports and removal concerns use the real support path without promising a new appeal system", () => {
  const text = copy("reports");
  assert.match(text, /support\.takeme@gmail\.com/);
  assert.match(text, /Report|reporting|report a/i);
  assert.match(text, /(?:incorrect|error|mistake)|removed.*wrong|wrong.*removed/i);
  assert.match(text, /contact.*support|support.*contact/i);
  assert.match(text, /no.*guarantee|not.*guarantee|does not.*(?:guarantee|promise)/i);
  const links = prohibitedItemsSections.find(section => section.id === "reports")?.links ?? [];
  assert.ok(links.some(link => link.href === "mailto:support.takeme@gmail.com"));
  assert.ok(links.some(link => link.href === "/help#safety"));
});

test("Terms V1 incorporates the policy through the correct bidirectional route without independent consent", () => {
  const terms = termsSections.find(section => section.id === "prohibited-items");
  const referencedTerms = terms ?? termsSections.find(section => section.links?.some(link => link.href === "/help/prohibited-items"));
  assert.ok(referencedTerms);
  assert.match([...referencedTerms.paragraphs ?? []].join(" "), /TAKEME Prohibited Items Policy/);
  assert.ok(referencedTerms.links?.some(link => link.href === "/help/prohibited-items"));
  assert.match(copy("terms-contact"), /forms part of|part of/i);
  assert.match(copy("terms-contact"), /Terms of Service/);
  assert.match(copy("terms-contact"), /1\.0/);
  assert.ok(prohibitedItemsSections.find(section => section.id === "terms-contact")?.links?.some(link => link.href === "/terms"));
  assert.equal(prohibitedItemsPolicy.version, productionReleasePolicy.termsVersion);
  assert.equal(prohibitedItemsPolicy.publicationApproved, false);
});

test("Regulated scope, reporting and evidence duties remain explicit legal-review inputs", () => {
  for (const id of ["weapons", "drugs-medicines", "hazardous", "alcohol-tobacco", "health-consumables", "wildlife", "enforcement"]) assert.match(copy(id), legalReview, id);
  assert.match(allCopy(), /intermediar|operator.*obligation|marketplace.*obligation/i);
  assert.match(allCopy(), /retention|retain/i);
  assert.match(allCopy(), /reporting.*(?:dut|obligation)|(?:dut|obligation).*reporting/i);
  assert.match(prohibitedItemsReviewNotice, /draft|review/i);
  assert.match(prohibitedItemsReviewNotice, /not.*published|unpublished|not in effect/i);
  assert.doesNotMatch(`${allCopy()} ${prohibitedItemsIntro} ${prohibitedItemsReviewNotice}`, /staging|synthetic demo/i);
  assert.doesNotMatch(allCopy(), /(?:Effective|Last updated)(?: date)?:?\s*\d{4}-\d{2}-\d{2}/i);
});

test("Listing policy does not claim unavailable V1 payment, shipping, seller or media services", () => {
  const reserved = /Stripe(?: Connect)?|integrated payments?|protected checkout|seller payouts?|\bAWB\b|Seller Centre|short.video commerce|live commerce|native push|push notifications?/i;
  for (const section of prohibitedItemsSections) {
    for (const paragraph of [...section.paragraphs ?? [], ...section.bullets ?? []]) {
      for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
        if (reserved.test(sentence)) assert.match(sentence, /future|unless|if introduced|not currently|does not(?: currently)?|do not(?: currently)?|not active|not available|not implemented|no active|not payment.card/i, `Unsupported active feature in ${section.id}`);
      }
    }
  }
  assert.doesNotMatch(allCopy(), /TAKEME (?:currently )?(?:processes|holds|transfers) (?:your |buyer )?(?:payments|funds)/i);
});

test("Prohibited Items metadata and route remain closed by the existing production publication gate", () => {
  const production = { nodeEnv: "production", useEmulators: "false", projectId: "takeme-52b80" };
  assert.equal(canPublishProductionLegal(production), false);
  assert.equal(canPreviewLegalDraft(production), false);
  assert.equal(canPreviewLegalDraft({ nodeEnv: "development", useEmulators: "true", projectId: "demo-takeme" }), true);
  const metadata = buildProhibitedItemsMetadata(false);
  assert.deepEqual(metadata.title, { absolute: "TAKEME Prohibited Items Policy" });
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  assert.equal(metadata.alternates?.canonical, "/help/prohibited-items");
  assert.equal(metadata.openGraph?.title, prohibitedItemsPolicy.title);
  assert.equal(metadata.openGraph?.url, "/help/prohibited-items");
  const route = source("../src/app/help/prohibited-items/page.tsx");
  assert.match(route, /requireLegalInformation\(\)/);
  assert.match(route, /buildProhibitedItemsMetadata\(isProductionLegalPublication\(\)\)/);
  assert.match(route, /policy="terms"/);
  assert.match(route, /reviewNotice=\{prohibitedItemsReviewNotice\}/);
});

test("Policy route uses the existing accessible responsive legal renderer for complete draft content", () => {
  const route = source("../src/app/help/prohibited-items/page.tsx");
  assert.match(route, /title=\{prohibitedItemsPolicy\.title\}/);
  assert.match(route, /intro=\{prohibitedItemsIntro\}/);
  assert.match(route, /sections=\{prohibitedItemsSections\}/);
  assert.match(route, /PolicySections sections=\{prohibitedItemsSections\}/);
  const renderer = source("../src/components/public-information/public-information.tsx");
  assert.match(renderer, /aria-labelledby=\{section\.id\}/);
  assert.match(renderer, /<h2 id=\{section\.id\}/);
  assert.match(renderer, /tabIndex=\{-1\}/);
  assert.match(renderer, /<details className=\{styles\.mobileToc\}>/);
  assert.match(renderer, /<aside className=\{styles\.desktopToc\}>/);
  const css = source("../src/components/public-information/public-information.module.css");
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /\.mobileToc\s*\{[^}]*display:\s*block/);
  assert.match(css, /\.desktopToc\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.article\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/);
});
