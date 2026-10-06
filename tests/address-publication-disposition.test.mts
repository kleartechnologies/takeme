import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import test from "node:test";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { isOwnerApprovedAddressOmission, legalPublicationReadiness, validateLegalPublication, v1AddressPublicationDisposition } from "../functions/src/legal-publication.ts";
import { planProductionPolicyBootstrap } from "../functions/src/production-policy-bootstrap.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { legalOperatorDisclosure, legalSectionParagraphs, operatorDisclosureDecision, validateOperatorDisclosure, type OperatorDisclosureDecision } from "../src/content/operator-disclosure.ts";
import { termsDocument, termsSections } from "../src/content/terms.ts";
import { privacyDocument, privacySections } from "../src/content/privacy.ts";
import { bmPrivacyDocument, bmPrivacySections } from "../src/content/privacy-bm.ts";
import { prohibitedItemsIntro, prohibitedItemsPolicy, prohibitedItemsReviewNotice, prohibitedItemsSections } from "../src/content/marketplace-rules.ts";
import { currentV1LaunchApprovals } from "../src/lib/v1-legal-launch-gate.ts";

const candidateReadiness = { ...legalPublicationReadiness, publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, productionRoutesReviewed: true };
const candidatePolicy = { ...productionReleasePolicy, publicationApproved: true };
const runtime = { env: { TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: "takeme-52b80", GCLOUD_PROJECT: "takeme-52b80",
  TAKEME_STORAGE_BUCKETS: "takeme-52b80.firebasestorage.app", TAKEME_ENABLE_PRODUCTION_DELETION: "false" },
  appProjectId: "takeme-52b80", appStorageBucket: "takeme-52b80.firebasestorage.app" };

test("the V1 omission is an explicit owner decision with truthful outstanding counsel status", () => {
  assert.deepEqual(v1AddressPublicationDisposition, { addressPublicationDecision: "NOT_PUBLISHED_FOR_V1", ownerApproved: true, legalCounselStatus: "OUTSTANDING" });
  assert.ok(Object.isFrozen(v1AddressPublicationDisposition));
  assert.equal(legalPublicationReadiness.address, "pending", "Do not turn the owner decision into a legal not-required conclusion");
  assert.equal(operatorDisclosureDecision.counselApproved, false);
  assert.ok(Object.values(currentV1LaunchApprovals.counsel).every(value => value === false));
  assert.equal(currentV1LaunchApprovals.issues.addressDisclosure.status, "explicitly-accepted");
  assert.deepEqual(validateOperatorDisclosure(), []);
  assert.deepEqual(validateLegalPublication(candidateReadiness), []);
  assert.deepEqual(planProductionPolicyBootstrap(runtime, candidatePolicy, candidateReadiness).record, {
    releaseTarget: "production", projectId: "takeme-52b80", publicationApproved: true, termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18,
  });
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.throws(() => planProductionPolicyBootstrap(runtime), /publication/);
});

test("an approved publishable address remains supported independently of the omission decision", () => {
  const address: OperatorDisclosureDecision = { kind: "address", text: "Synthetic public correspondence test address",
    bmText: "Alamat surat-menyurat sintetik untuk ujian", ownerApprovedForPublicUse: true, counselApproved: true };
  assert.deepEqual(validateOperatorDisclosure(address), []);
  assert.equal(legalOperatorDisclosure(address).businessAddress, address.text);
  assert.deepEqual(validateLegalPublication({ ...candidateReadiness, address: "approved", addressDisposition: undefined }), []);
  assert.deepEqual(legalSectionParagraphs({ paragraphs: ["Contact"], addressParagraphs: [address.text!] }, address), ["Contact", address.text]);
});

test("unresolved, invented and malformed omission states fail closed before any policy store is accessed", () => {
  const invalid: unknown[] = [undefined, null, true, [], {}, "NOT_PUBLISHED_FOR_V1",
    { ...v1AddressPublicationDisposition, ownerApproved: false },
    { ...v1AddressPublicationDisposition, ownerApproved: "true" },
    { ...v1AddressPublicationDisposition, addressPublicationDecision: "not_published_for_v1" },
    { ...v1AddressPublicationDisposition, addressPublicationDecision: "NOT_REQUIRED_BY_LAW" },
    { ...v1AddressPublicationDisposition, legalCounselStatus: "APPROVED" },
    { ...v1AddressPublicationDisposition, address: "invented" },
    Object.assign(Object.create(v1AddressPublicationDisposition), { a: 1, b: 2, c: 3 })];
  for (const value of invalid) {
    assert.equal(isOwnerApprovedAddressOmission(value), false);
    const readiness = { ...candidateReadiness, addressDisposition: value as typeof v1AddressPublicationDisposition };
    assert.ok(validateLegalPublication(readiness).length);
    assert.throws(() => planProductionPolicyBootstrap(runtime, candidatePolicy, readiness), /address/i);
  }
  for (const address of ["not-required", "invented", null]) {
    const readiness = { ...candidateReadiness, address, addressDisposition: undefined } as unknown as typeof candidateReadiness;
    assert.ok(validateLegalPublication(readiness).some(issue => /address/i.test(issue)));
  }
  assert.ok(validateLegalPublication({ ...candidateReadiness, address: "approved" }).length, "Conflicting address publication decisions are not accepted");
  for (const patch of [{ text: "Invented address" }, { bmText: "Invented address" }, { counselApproved: true },
    { ownerApprovedForPublicUse: false }, { addressDisposition: undefined }, { kind: "unresolved" as const }]) {
    const decision = { ...operatorDisclosureDecision, ...patch };
    assert.ok(validateOperatorDisclosure(decision).length);
    assert.equal(legalOperatorDisclosure(decision).businessAddress, null);
    assert.deepEqual(legalSectionParagraphs({ paragraphs: ["Contact"], addressParagraphs: ["[ADDRESS REQUIRED]"] }, decision), ["Contact"]);
  }
});

test("all approved non-address legal wording, section order, lists and links match the reviewed checkpoint", () => {
  // SHA-256 of the approved 67e8971 section models, excluding only the address
  // block authorised for omission in this task. No legal prose is regenerated.
  const reviewed: [typeof termsSections, string][] = [
    [termsSections, "29ed594a2ff84c08dbe9c04b6befbb46e74b56f2fb3e964abead2925da07d067"],
    [privacySections, "05f6ccb422500301e708416ca4413ac55a36496bf439ffcad0f5ba91d7a1eae6"],
    [bmPrivacySections, "5e6c01a427eced752c1240ec9e277a4cee7c9715326322c411c3bdf69b34ad1a"],
    [prohibitedItemsSections, "bf4d6387ac86c7d7bfa2b0ce87d4cad68371807e9ccd09ee75bdc73f6b02ef34"],
  ];
  for (const [sections, hash] of reviewed) {
    const prose = sections.map(section => ({ id: section.id, title: section.title, paragraphs: section.paragraphs ?? [], bullets: section.bullets ?? [], links: section.links ?? [] }));
    assert.equal(createHash("sha256").update(JSON.stringify(prose)).digest("hex"), hash);
  }
  for (const document of [termsDocument, privacyDocument, bmPrivacyDocument, prohibitedItemsPolicy]) {
    assert.equal(document.version, "1.0");
    assert.equal(document.effectiveDate, "2026-10-12");
    assert.equal(document.lastUpdated, "2026-10-12");
    assert.equal(document.businessAddress, null);
  }
});

// Render the real legal pages and shared renderer. Only Next routing/publication
// hooks are fixture inputs; no credentials, browser, SDK, cloud calls or build.
const runtimeRequire = createRequire(import.meta.url);
function loadTsx<T>(file: string, mocks: Record<string, unknown>): T {
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2017, esModuleInterop: true },
  });
  const compiled = { exports: {} };
  const require = (name: string) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "react/jsx-runtime") return runtimeRequire(name);
    throw new Error(`Unexpected legal renderer dependency: ${name}`);
  };
  new Function("require", "module", "exports", outputText)(require, compiled, compiled.exports);
  return compiled.exports as T;
}
const Link = (props: Record<string, unknown>) => createElement("a", props, props.children as ReactNode);
const information = loadTsx<Record<string, ComponentType>>("../src/components/public-information/public-information.tsx", {
  "next/link": Link, "@/components/layout/logo": { Logo: () => null },
  "@/components/layout/footer-social-links": { FooterSocialLinks: () => null },
  "@/content/operator-disclosure": { legalSectionParagraphs },
  "@/lib/public-information": { isLegalInformationAvailable: () => true, isProductionLegalPublication: () => true,
    legalDocumentState: () => ({ version: "1.0", production: true, lastUpdated: "2026-10-12", effectiveDate: "2026-10-12" }) },
  "./public-information.module.css": {},
});
const common = { "@/components/public-information/public-information": information,
  "@/components/public-information/legal-preview": { requireLegalInformation: () => {} },
  "@/lib/public-information": { isProductionLegalPublication: () => true },
  "@/components/public-information/privacy-languages": { PrivacyLanguages: () => null } };
const pages: [string, Record<string, unknown>][] = [
  ["../src/app/terms/page.tsx", { "@/content/terms": { termsDocument, termsSections }, "@/lib/terms-metadata": { buildTermsMetadata: () => ({}) } }],
  ["../src/app/privacy/page.tsx", { "@/content/privacy": { privacyDocument, privacySections }, "@/lib/privacy-metadata": { buildPrivacyMetadata: () => ({}) } }],
  ["../src/app/privacy/bm/page.tsx", { "@/content/privacy-bm": { bmPrivacyDocument, bmPrivacySections },
    "@/lib/privacy-notice": { canRenderBmPrivacyNotice: () => true }, "@/lib/privacy-bm-metadata": { buildBmPrivacyMetadata: () => ({}) },
    "next/navigation": { notFound: () => { throw new Error("Unexpected missing BM route"); } } }],
  ["../src/app/help/prohibited-items/page.tsx", { "@/content/marketplace-rules": { prohibitedItemsIntro, prohibitedItemsPolicy, prohibitedItemsReviewNotice, prohibitedItemsSections },
    "@/lib/prohibited-items-metadata": { buildProhibitedItemsMetadata: () => ({}) } }],
];

test("all four actual public legal routes omit the address block while preserving contacts and V1 dates", () => {
  for (const [file, mocks] of pages) {
    const { default: Page } = loadTsx<{ default: ComponentType }>(file, { ...common, ...mocks });
    const html = renderToStaticMarkup(createElement(Page));
    assert.match(html, /TAKEME TECHNOLOGIES/);
    assert.match(html, /KT0622373-U/);
    assert.match(html, /support\.takeme@gmail\.com/);
    assert.match(html, /dateTime="2026-10-12"/i);
    assert.doesNotMatch(html, /Business or publishable address:|Business\/correspondence address:|Business or correspondence address:|Alamat perniagaan\/surat-menyurat:/);
    assert.doesNotMatch(html, /\[ADDRESS REQUIRED\]|OWNER INPUT REQUIRED|INPUT PEMILIK DIPERLUKAN|NOT_PUBLISHED_FOR_V1|>null</);
  }
});
