import assert from "node:assert/strict";
import test from "node:test";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { termsDocument, termsSections } from "../src/content/terms.ts";
import { privacyDocument, privacySections } from "../src/content/privacy.ts";
import { bmPrivacyDocument, bmPrivacySections } from "../src/content/privacy-bm.ts";
import { prohibitedItemsPolicy, prohibitedItemsSections } from "../src/content/marketplace-rules.ts";
import { currentV1LaunchApprovals, prepareV1PolicyRecord, reviewV1ReleasePreparation } from "../src/lib/v1-legal-launch-gate.ts";
import { operatorDisclosureDecision } from "../src/content/operator-disclosure.ts";

test("owner-approved RC date reaches all eight fields without publication or counsel approval", () => {
  for (const document of [termsDocument, privacyDocument, bmPrivacyDocument, prohibitedItemsPolicy]) {
    assert.equal(document.version, "1.0");
    assert.equal(document.effectiveDate, "2026-10-12");
    assert.equal(document.lastUpdated, "2026-10-12");
    assert.equal(document.businessAddress, null);
  }
  assert.equal(currentV1LaunchApprovals.owner.launchDate, true);
  assert.ok(Object.values(currentV1LaunchApprovals.counsel).every(value => value === false));
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(prohibitedItemsPolicy.publicationApproved, false);
  assert.equal(operatorDisclosureDecision.kind, "not-published-for-v1");
  assert.deepEqual(reviewV1ReleasePreparation(), []);
});

test("dated RC paragraphs cannot still claim their dates are unresolved", () => {
  const en = [termsSections, privacySections, prohibitedItemsSections].flat().flatMap(section => section.paragraphs ?? []).join(" ");
  const bm = bmPrivacySections.flatMap(section => section.paragraphs ?? []).join(" ");
  assert.doesNotMatch(en, /Both dates remain unresolved|No launch date is set by this draft/);
  assert.doesNotMatch(bm, /Kedua-dua tarikh masih belum ditetapkan/);
  assert.match(en, /2026-10-12/);
  assert.match(bm, /2026-10-12/);
  assert.match(en, /LEGAL REVIEW REQUIRED/);
  assert.match(bm, /SEMAKAN UNDANG-UNDANG DIPERLUKAN/);
});

test("future bootstrap stays exactly six fields and does not activate its actual source", () => {
  assert.deepEqual(prepareV1PolicyRecord(), { releaseTarget: "production", projectId: "takeme-52b80", publicationApproved: true,
    termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18 });
  assert.equal(productionReleasePolicy.publicationApproved, false);
});
