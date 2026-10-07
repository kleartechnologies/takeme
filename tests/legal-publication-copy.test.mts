import assert from "node:assert/strict";
import test from "node:test";
import { termsDocument, termsSections } from "../src/content/terms.ts";
import { prohibitedItemsIntro, prohibitedItemsPolicy, prohibitedItemsReviewNotice, prohibitedItemsSections } from "../src/content/marketplace-rules.ts";
import { legalSectionParagraphs } from "../src/content/operator-disclosure.ts";
import { legalPublicationReadiness, v1AddressPublicationDisposition } from "../functions/src/legal-publication.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { buildTermsMetadata } from "../src/lib/terms-metadata.ts";
import { buildProhibitedItemsMetadata } from "../src/lib/prohibited-items-metadata.ts";

const publicText = (sections: typeof termsSections) => sections.flatMap(section => [section.title, ...legalSectionParagraphs(section), ...section.bullets ?? [], ...section.links?.map(link => link.label) ?? []]).join(" ");
const terms = publicText(termsSections);
const prohibited = prohibitedItemsIntro + " " + publicText(prohibitedItemsSections);
const statusCopy = /owner draft|conservative owner draft|publication remains separately gated|unpublished|not in effect|pending publication|pending approval|This draft|this draft|Terms draft|unresolved draft section|Draft Status/;

test("Terms public copy has no document drafting or publication-status language", () => {
  assert.doesNotMatch(terms, statusCopy);
  assert.match(terms, /Terms v1\.0/);
  assert.match(terms, /The launch date is 2026-10-12\./);
  assert.match(terms, /TAKEME TECHNOLOGIES/);
  assert.match(terms, /KT0622373-U/);
  assert.match(terms, /support\.takeme@gmail\.com/);
  assert.ok(termsSections.find(section => section.id === "privacy")?.links?.some(link => link.href === "/privacy"));
  assert.ok(termsSections.find(section => section.id === "rules")?.links?.some(link => link.href === "/help/prohibited-items"));
});

test("Prohibited Items public copy identifies the active policy without draft-status labels", () => {
  assert.doesNotMatch(prohibited, statusCopy);
  assert.match(prohibited, /This Prohibited Items Policy sets out products, listings and activities that are prohibited or restricted on TAKEME\./);
  assert.match(prohibited, /Terms of Service version 1\.0/);
  assert.match(prohibited, /2026-10-12/);
  assert.match(prohibited, /TAKEME TECHNOLOGIES/);
  assert.match(prohibited, /KT0622373-U/);
  assert.match(prohibited, /support\.takeme@gmail\.com/);
  assert.equal(prohibitedItemsSections.find(section => section.id === "terms-contact")?.title, "18. Terms Linkage and Contact");
  for (const href of ["/terms", "/privacy", "mailto:support.takeme@gmail.com"]) assert.ok(prohibitedItemsSections.find(section => section.id === "terms-contact")?.links?.some(link => link.href === href));
});

test("seller, retention, liability and indemnity safeguards survive neutral document references", () => {
  for (const id of ["sellers", "retention", "liability", "indemnity"]) assert.match(termsSections.find(section => section.id === id)?.paragraphs?.join(" ") ?? "", /LEGAL REVIEW REQUIRED/, id);
  assert.match(terms, /No clause excludes liability or consumer rights that cannot lawfully be excluded\./);
  assert.match(terms, /These Terms do not add a liability cap or a broader exclusion of platform responsibilities\./);
  assert.match(terms, /No additional indemnity, defence obligation or open-ended reimbursement obligation is imposed by this section\./);
  assert.match(terms, /These Terms do not change retention periods, create an indefinite evidence store or automatically extend production deletion schedules\./);
  assert.match(terms, /three years under applicable Malaysian electronic-trade rules/);
  assert.match(terms, /exact seller disclosure fields; individual vs business seller requirements/);
});

test("Prohibited Items legal caveats and enforcement limits remain explicit", () => {
  for (const id of ["weapons", "drugs-medicines", "hazardous", "alcohol-tobacco", "health-consumables", "wildlife", "enforcement"]) assert.match(prohibitedItemsSections.find(section => section.id === id)?.paragraphs?.join(" ") ?? "", /LEGAL REVIEW REQUIRED/, id);
  assert.match(prohibited, /This policy does not create indefinite retention or change backend cleanup schedules\./);
  assert.match(prohibited, /These are policy rights, not a promise that every moderation, investigation or appeal action is automated\./);
  assert.match(prohibited, /TAKEME does not promise automatic police reporting in every case\./);
});

test("neutral public copy cannot activate publication or alter date, version, address or counsel state", () => {
  for (const document of [termsDocument, prohibitedItemsPolicy]) {
    assert.equal(document.version, "1.0");
    assert.equal(document.effectiveDate, "2026-10-12");
    assert.equal(document.lastUpdated, "2026-10-12");
    assert.equal(document.businessAddress, null);
    assert.equal(document.businessAddressStatus, "NOT_PUBLISHED_FOR_V1");
  }
  assert.equal(v1AddressPublicationDisposition.legalCounselStatus, "OUTSTANDING");
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(prohibitedItemsPolicy.publicationApproved, false);
  for (const copy of [terms, prohibited]) assert.doesNotMatch(copy, /OUTSTANDING|NOT_PUBLISHED_FOR_V1|OWNER INPUT REQUIRED|LEGAL COUNSEL APPROVED/);
});

test("prepublication still has review notices/noindex and explicit publication controls metadata", () => {
  assert.match(termsDocument.reviewNotice, /not in effect|has not been published/);
  assert.match(prohibitedItemsReviewNotice, /not in effect|has not been published/);
  for (const build of [buildTermsMetadata, buildProhibitedItemsMetadata]) {
    assert.deepEqual(build(false).robots, { index: false, follow: false });
    assert.deepEqual(build(true).robots, { index: true, follow: true });
  }
});
