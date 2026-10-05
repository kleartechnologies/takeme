import assert from "node:assert/strict";
import test from "node:test";
import { canPreviewLegalDraft, canPublishProductionLegal, isPublicInformationPath, legalDraft } from "../src/lib/public-information.ts";
import { legalPublicationReadiness, type LegalPublicationReadiness } from "../src/lib/legal-publication.ts";
import { productionReleasePolicy, type ReleasePolicy } from "../functions/src/release-policy.ts";
import { releaseProofPrefix } from "../src/lib/release-proof.ts";
import { marketplaceOperator } from "../src/content/operator.ts";

test("unfinished policy/contact drafts are restricted to the authorised demo development environment", () => {
  assert.equal(canPreviewLegalDraft({ nodeEnv: "development", useEmulators: "true", projectId: "demo-takeme" }), true);
  for (const runtime of [
    { nodeEnv: "production", useEmulators: "true", projectId: "demo-takeme" },
    { nodeEnv: "test", useEmulators: "true", projectId: "demo-takeme" },
    { nodeEnv: "development", useEmulators: "false", projectId: "demo-takeme" },
    { nodeEnv: "development", useEmulators: "true", projectId: "other-project" },
    {},
  ]) assert.equal(canPreviewLegalDraft(runtime), false);
  assert.equal(legalDraft.publicationApproved, false);
});

test("production legal publication needs independent source approvals and a matching production build", () => {
  const policy: ReleasePolicy = { publicationApproved: true, termsVersion: "unit-approved-terms", privacyVersion: "unit-approved-privacy", minimumAge: 18 };
  const readiness: LegalPublicationReadiness = { publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, registration: "approved", address: "not-required", productionRoutesReviewed: true };
  const proof = { format: 1, purpose: "production-build", target: "production", projectId: "takeme-52b80", siteUrl: "https://takeme.my", useEmulators: false,
    firebase: { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "takeme-52b80", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "takeme-52b80.firebaseapp.com", NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "takeme-52b80.firebasestorage.app" }, policy };
  const encode = (value: unknown) => releaseProofPrefix + Buffer.from(JSON.stringify(value)).toString("base64");
  const runtime = { nodeEnv: "production", useEmulators: "false", projectId: "takeme-52b80", buildProof: encode(proof) };
  assert.equal(canPublishProductionLegal(runtime, readiness, policy), true);
  assert.equal(canPublishProductionLegal(runtime), false, "a test approval fixture cannot approve the real source");
  for (const key of ["publicationApproved", "finalContentApproved", "bmPrivacyNoticeApproved", "productionRoutesReviewed"] as const) {
    assert.equal(canPublishProductionLegal(runtime, { ...readiness, [key]: false }, policy), false, key);
  }
  assert.equal(canPublishProductionLegal(runtime, { ...readiness, address: "pending" }, policy), false);
  for (const altered of [
    { ...proof, purpose: "offline-qualification" }, { ...proof, target: "staging" },
    { ...proof, useEmulators: true }, { ...proof, siteUrl: "https://another.example" },
    { ...proof, policy: { ...policy, privacyVersion: "wrong" } },
    { ...proof, firebase: { ...proof.firebase, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "other.firebasestorage.app" } },
  ]) assert.equal(canPublishProductionLegal({ ...runtime, buildProof: encode(altered) }, readiness, policy), false);
  assert.equal(canPublishProductionLegal({ ...runtime, buildProof: undefined }, readiness, policy), false);
});

test("owner-confirmed registration is available without activating final policies or publication", () => {
  assert.equal(marketplaceOperator.registrationNumber, "KT0622373-U");
  assert.equal(legalPublicationReadiness.registration, "approved");
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(productionReleasePolicy.termsVersion, null);
  assert.equal(productionReleasePolicy.privacyVersion, null);
});

test("public information chrome applies only to exact public routes", () => {
  for (const path of ["/privacy", "/privacy-policy", "/terms", "/help", "/help/prohibited-items", "/contact", "/account-deletion"]) assert.equal(isPublicInformationPath(path), true, path);
  for (const path of ["/", "/profile", "/profile/settings", "/profile/settings/privacy", "/explore", "/saved", "/messages", "/updates", "/help/tiers", "/contact-other", "/terms-other", "/account-deletion-other"]) assert.equal(isPublicInformationPath(path), false, path);
});
