import assert from "node:assert/strict";
import test from "node:test";
import { planLegalLaunchDate } from "../functions/src/legal-launch-date-plan.ts";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { termsDocument } from "../src/content/terms.ts";
import { privacyDocument } from "../src/content/privacy.ts";
import { bmPrivacyDocument } from "../src/content/privacy-bm.ts";
import { prohibitedItemsPolicy } from "../src/content/marketplace-rules.ts";

test("no owner-supplied launch date leaves both proposed dates pending", () => {
  for (const value of [null, undefined]) {
    assert.deepEqual(planLegalLaunchDate(value), {
      status: "pending", effectiveDate: null, lastUpdated: null,
    });
  }
});

test("one exact calendar input prepares the shared V1 effective and updated date without applying it", () => {
  for (const value of ["0001-01-01", "0099-12-31", "2000-02-29", "2024-02-29", "2099-12-31", "9999-12-31"]) {
    assert.deepEqual(planLegalLaunchDate(value), {
      status: "prepared-not-applied", effectiveDate: value, lastUpdated: value,
    });
  }
});

test("date preparation rejects malformed input, impossible dates and non-leap centuries", () => {
  for (const value of [
    "", " 2099-01-01", "2099-01-01 ", "2099-1-01", "2099-01-1", "2099/01/01",
    "2099-01-01T00:00:00Z", "2099-01-01\n", "0000-01-01", "1900-02-29", "2100-02-29",
    "2025-02-29", "2024-02-30", "2099-04-31", "2099-00-01", "2099-13-01", "2099-01-00",
    "2099-01-32", 20990101, true, {}, [], new Date("2099-01-01T00:00:00Z"),
  ]) assert.throws(() => planLegalLaunchDate(value), /exact valid calendar date/);
});

test("date proposals are readonly and contain no publication or policy activation decisions", () => {
  for (const value of [null, "2099-01-01"]) {
    const plan = planLegalLaunchDate(value);
    assert.equal(Object.isFrozen(plan), true);
    assert.deepEqual(Object.keys(plan).sort(), ["status", "effectiveDate", "lastUpdated"].sort());
    assert.equal(Reflect.set(plan, "effectiveDate", "2099-01-02"), false);
    assert.equal(Reflect.set(plan, "publicationApproved", true), false);
  }
});

test("preparing a date changes none of the eight existing legal dates or central approval gates", () => {
  const readinessBefore = JSON.stringify(legalPublicationReadiness);
  const policyBefore = JSON.stringify(productionReleasePolicy);
  const plan = planLegalLaunchDate("2099-01-01");
  assert.equal(plan.status, "prepared-not-applied");
  for (const document of [termsDocument, privacyDocument, bmPrivacyDocument, prohibitedItemsPolicy]) {
    assert.equal(document.version, "1.0");
    assert.equal(document.effectiveDate, legalPublicationReadiness.effectiveDate);
    assert.equal(document.lastUpdated, legalPublicationReadiness.lastUpdated);
    assert.equal(document.effectiveDate, "2026-10-12");
    assert.equal(document.lastUpdated, "2026-10-12");
  }
  assert.equal(JSON.stringify(legalPublicationReadiness), readinessBefore);
  assert.equal(JSON.stringify(productionReleasePolicy), policyBefore);
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(legalPublicationReadiness.finalContentApproved, false);
  assert.equal(legalPublicationReadiness.bmPrivacyNoticeApproved, false);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(prohibitedItemsPolicy.publicationApproved, false);
});
