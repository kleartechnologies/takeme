import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { privacyDocument, privacySections } from "../src/content/privacy.ts";
import { bmPrivacyDocument, bmPrivacySections } from "../src/content/privacy-bm.ts";
import { privacyNotices } from "../src/content/privacy-notices.ts";
import { legalSectionParagraphs } from "../src/content/operator-disclosure.ts";
import { legalPublicationReadiness, v1AddressPublicationDisposition } from "../functions/src/legal-publication.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { canPublishProductionLegal, resolveLegalDocumentState } from "../src/lib/public-information.ts";
import { releaseProofPrefix } from "../src/lib/release-proof.ts";
import { buildPrivacyMetadata } from "../src/lib/privacy-metadata.ts";
import { buildBmPrivacyMetadata } from "../src/lib/privacy-bm-metadata.ts";

function visibleCopy(sections: typeof privacySections) {
  return sections.flatMap(section => [section.title, ...legalSectionParagraphs(section), ...section.bullets ?? [], ...section.links?.map(link => link.label) ?? []]).join(" ");
}
const english = visibleCopy(privacySections);
const bm = visibleCopy(bmPrivacySections);

test("EN public Privacy uses the approved neutral introduction and BM availability statement", () => {
  assert.ok(english.includes("This Privacy Notice explains how TAKEME collects, uses, discloses, stores and protects personal data in connection with the TAKEME marketplace and related services."));
  assert.ok(english.includes("A Bahasa Melayu version of this Privacy Notice is also available."));
  assert.doesNotMatch(english, /owner draft|not approved for publication|pending publication|publication remains separately gated|final English Privacy (?:legal )?approval|final BM (?:Privacy wording|notice)/i);
  assert.doesNotMatch(english, /This draft|in this draft|Terms of Service draft/);
});

test("BM public Privacy removes document-status language without removing listing drafts", () => {
  assert.ok(bm.includes("Notis Privasi ini menerangkan cara TAKEME mengumpulkan, menggunakan, mendedahkan, menyimpan dan melindungi data peribadi"));
  assert.ok(bm.includes("Versi Bahasa Inggeris bagi Notis Privasi ini juga tersedia."));
  assert.doesNotMatch(bm, /draf pemilik|belum diluluskan untuk penerbitan|penerbitan belum diluluskan|Draf ini|oleh draf ini|Baca draf Terma|kelulusan muktamad Privasi Bahasa Inggeris/i);
  assert.match(english, /drafts are account-managed content/);
  assert.match(bm, /draf ialah kandungan yang diurus melalui akaun/);
});

test("Privacy publication keeps dates, versions, operator and contact details with bilingual structure", () => {
  for (const document of [privacyDocument, bmPrivacyDocument]) {
    assert.equal(document.version, "1.0");
    assert.equal(document.effectiveDate, "2026-10-12");
    assert.equal(document.lastUpdated, "2026-10-12");
    assert.equal(document.operator.name, "TAKEME TECHNOLOGIES");
    assert.equal(document.operator.registrationNumber, "KT0622373-U");
    assert.equal(document.operator.privacyLegalEmail, "support.takeme@gmail.com");
    assert.equal(document.minimumAge, 18);
  }
  assert.match(english, /2026-10-12/);
  assert.match(bm, /2026-10-12/);
  assert.deepEqual(bmPrivacySections.map(section => section.id), privacySections.map(section => section.id));
  for (const [index, section] of bmPrivacySections.entries()) {
    assert.equal(section.paragraphs?.length, privacySections[index].paragraphs?.length);
    assert.deepEqual(section.links?.map(link => link.href), privacySections[index].links?.map(link => link.href));
  }
  assert.equal(privacyNotices.bm.href, "/privacy/bm");
  assert.equal(privacyNotices.en.href, "/privacy");
});

test("substantive legal caveats and bounded retention survive the status-copy cleanup", () => {
  for (const id of ["compliance", "fraud", "providers", "transfers", "retention", "deletion", "holds", "security", "rights", "storage"]) {
    assert.match(privacySections.find(section => section.id === id)?.paragraphs?.join(" ") ?? "", /LEGAL REVIEW REQUIRED/, id);
    assert.match(bmPrivacySections.find(section => section.id === id)?.paragraphs?.join(" ") ?? "", /SEMAKAN UNDANG-UNDANG DIPERLUKAN/, id);
  }
  for (const term of [/30 days/, /90 days/, /12 calendar months/, /180 days/, /Pseudonymised records are not necessarily anonymous/, /No country is named without verification/]) assert.match(english, term);
  for (const term of [/30 hari/, /90 hari/, /12 bulan kalendar/, /180 hari/, /berpseudonim tidak semestinya tanpa nama/, /Tiada negara dinamakan tanpa pengesahan/]) assert.match(bm, term);
});

test("internal counsel/address disposition remains truthful and never becomes public placeholder copy", () => {
  assert.equal(v1AddressPublicationDisposition.legalCounselStatus, "OUTSTANDING");
  assert.equal(v1AddressPublicationDisposition.addressPublicationDecision, "NOT_PUBLISHED_FOR_V1");
  for (const copy of [english, bm]) assert.doesNotMatch(copy, /OUTSTANDING|NOT_PUBLISHED_FOR_V1|OWNER INPUT REQUIRED|INPUT PEMILIK DIPERLUKAN|LEGAL COUNSEL APPROVED/);
});

test("neutral Privacy copy cannot grant publication, while prepublication still retains draft/noindex gates", () => {
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(canPublishProductionLegal({ nodeEnv: "production", useEmulators: "false", projectId: "takeme-52b80" }), false);
  assert.deepEqual(buildPrivacyMetadata(false).robots, { index: false, follow: false });
  assert.deepEqual(buildBmPrivacyMetadata(false).robots, { index: false, follow: false });
  assert.match(privacyDocument.reviewNotice, /owner draft|not.*published/i);
  assert.match(bmPrivacyDocument.reviewNotice, /Draf pemilik|belum diterbitkan/);
  const renderer = readFileSync(new URL("../src/components/public-information/public-information.tsx", import.meta.url), "utf8");
  assert.match(renderer, /const review = policyPage && !document\.production/);
  assert.match(renderer, /\{review && <p className=\{styles\.review\}/);
  for (const route of ["../src/app/privacy/page.tsx", "../src/app/privacy/bm/page.tsx"]) {
    assert.match(readFileSync(new URL(route, import.meta.url), "utf8"), /PrivacyLanguages current=/);
  }
});

test("publication-enabled fixture keeps final version/date presentation without inventing counsel approval", () => {
  const policy = { ...productionReleasePolicy, publicationApproved: true };
  const readiness = { ...legalPublicationReadiness, publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, productionRoutesReviewed: true };
  const proof = { format: 1, purpose: "production-build", target: "production", projectId: "takeme-52b80", siteUrl: "https://takeme.my", useEmulators: false,
    firebase: { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "takeme-52b80", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "takeme-52b80.firebaseapp.com", NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "takeme-52b80.firebasestorage.app" }, policy };
  const runtime = { nodeEnv: "production", useEmulators: "false", projectId: "takeme-52b80", buildProof: releaseProofPrefix + Buffer.from(JSON.stringify(proof)).toString("base64") };
  const state = resolveLegalDocumentState("privacy", runtime, readiness, policy);
  assert.equal(state.production, true);
  assert.equal(state.version, "1.0");
  assert.equal(state.effectiveDate, "2026-10-12");
  assert.equal(state.lastUpdated, "2026-10-12");
  assert.equal(readiness.addressDisposition?.legalCounselStatus, "OUTSTANDING");
});
