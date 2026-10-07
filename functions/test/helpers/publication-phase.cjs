"use strict";
const assert = require("node:assert/strict");
const { productionReleasePolicy, validateProductionPolicy } = require("../../lib/release-policy");
const { legalPublicationReadiness, validateLegalPublication } = require("../../lib/legal-publication");

// Test expectations only. This selector is never read by runtime or deployment code.
// Preparation is the checked-in default; a private publication RC must select its
// phase explicitly instead of inferring approval from the source under test.
function expectedSourcePhase(env = process.env) {
  const phase = env.TAKEME_FUNCTIONS_TEST_SOURCE_PHASE ?? "pre-publication";
  assert.ok(["pre-publication", "publication-enabled-rc"].includes(phase), "Unknown Functions test source phase.");
  return phase;
}
function assertSourcePhase() {
  const publicationEnabled = expectedSourcePhase() === "publication-enabled-rc";
  assert.deepEqual(productionReleasePolicy, {
    publicationApproved: publicationEnabled, termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18,
  });
  for (const key of ["publicationApproved", "finalContentApproved", "bmPrivacyNoticeApproved", "productionRoutesReviewed"]) {
    assert.equal(legalPublicationReadiness[key], publicationEnabled);
  }
  assert.equal(legalPublicationReadiness.effectiveDate, "2026-10-12");
  assert.equal(legalPublicationReadiness.lastUpdated, "2026-10-12");
  assert.equal(legalPublicationReadiness.address, "pending");
  assert.deepEqual(legalPublicationReadiness.addressDisposition, {
    addressPublicationDecision: "NOT_PUBLISHED_FOR_V1", ownerApproved: true, legalCounselStatus: "OUTSTANDING",
  });
  assert.equal(validateProductionPolicy().length === 0, publicationEnabled);
  assert.equal(validateLegalPublication().length === 0, publicationEnabled);
  return publicationEnabled;
}
module.exports = { expectedSourcePhase, assertSourcePhase };
