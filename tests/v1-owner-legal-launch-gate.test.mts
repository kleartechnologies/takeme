import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";
import { legalLaunchDateInput, planV1LegalDates, prepareV1LegalDateSource, validateV1LegalDates, v1LegalDocumentIds } from "../functions/src/legal-launch-date-plan.ts";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { releasePolicyFromMirror } from "../functions/src/policy-runtime.ts";
import { bmLegalOperatorDisclosure, legalOperatorDisclosure, operatorDisclosureDecision, validateOperatorDisclosure } from "../src/content/operator-disclosure.ts";
import { termsDocument } from "../src/content/terms.ts";
import { privacyDocument } from "../src/content/privacy.ts";
import { bmPrivacyDocument } from "../src/content/privacy-bm.ts";
import { prohibitedItemsPolicy } from "../src/content/marketplace-rules.ts";
import { counselApprovalItems, currentV1LaunchApprovals, externalLegalIssueIds, finalLegalRoutes, ownerApprovalItems, pendingV1LaunchApprovals, prepareV1PolicyRecord, reviewV1PublicationGate, reviewV1ReleasePreparation, type V1PublicationGateInputs } from "../src/lib/v1-legal-launch-gate.ts";
import { ownerApprovedPreparationItems, ownerApprovedV1ProductDecisions, v1OwnerDocumentApproval, v1OwnerLegalDocuments } from "../functions/src/v1-owner-approvals.ts";
import { canPublishProductionLegal } from "../src/lib/public-information.ts";
import { buildTermsMetadata } from "../src/lib/terms-metadata.ts";
import { buildPrivacyMetadata } from "../src/lib/privacy-metadata.ts";
import { buildBmPrivacyMetadata } from "../src/lib/privacy-bm-metadata.ts";
import { buildProhibitedItemsMetadata } from "../src/lib/prohibited-items-metadata.ts";

const repository = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = "functions/src/legal-publication.ts";
// Synthetic test date and disclosure only, never an owner launch decision.
const syntheticDate = "2099-02-28";
const inputs = { [legalLaunchDateInput]: syntheticDate };
const documents = { terms: termsDocument, privacyEn: privacyDocument, privacyBm: bmPrivacyDocument, prohibitedItems: prohibitedItemsPolicy };
const sourceDates = Object.fromEntries(v1LegalDocumentIds.map(id => [id, {
  effectiveDate: documents[id].effectiveDate, lastUpdated: documents[id].lastUpdated,
}])) as V1PublicationGateInputs["sourceDates"];
const approvedAlternative = { kind: "reviewed-alternative" as const, text: "Synthetic reviewed alternative for offline tests only", bmText: "Teks sintetik untuk ujian luar talian sahaja", ownerApprovedForPublicUse: true, counselApproved: true };

function readyFixture(): V1PublicationGateInputs {
  return {
    approvals: {
      owner: Object.fromEntries(ownerApprovalItems.map(key => [key, key !== "domainCutover"])) as V1PublicationGateInputs["approvals"]["owner"],
      counsel: Object.fromEntries(counselApprovalItems.map(key => [key, true])) as V1PublicationGateInputs["approvals"]["counsel"],
      issues: Object.fromEntries(externalLegalIssueIds.map(key => [key, { status: "resolved", reviewReference: "synthetic-test-review" }])) as V1PublicationGateInputs["approvals"]["issues"],
    },
    launchDate: syntheticDate, disclosure: approvedAlternative, sourceDates: planV1LegalDates(inputs).documents,
    verifiedRoutes: Object.fromEntries(finalLegalRoutes.map(route => [route, true])),
    finalFrontendArtifactVerified: true, policyRulesArtifactsRegenerated: true,
  };
}

test("all four actual documents preserve central V1 identity, unresolved dates and public operator details", () => {
  for (const document of Object.values(documents)) {
    assert.equal(document.version, "1.0");
    assert.equal(document.effectiveDate, "2026-10-12");
    assert.equal(document.lastUpdated, "2026-10-12");
    assert.equal(document.operator.name, "TAKEME TECHNOLOGIES");
    assert.equal(document.operator.registrationNumber, "KT0622373-U");
    assert.equal(document.operator.supportEmail, "support.takeme@gmail.com");
    assert.equal(document.businessAddress, null);
    assert.equal(document.businessAddressStatus, "LEGAL REVIEW / OWNER INPUT REQUIRED");
  }
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(prohibitedItemsPolicy.publicationApproved, false);
});

test("current owner-approved documents and nine preparation decisions remain separate from counsel and launch authority", () => {
  assert.deepEqual(Object.keys(v1OwnerLegalDocuments).sort(), Object.keys(documents).sort());
  for (const [id, approval] of Object.entries(v1OwnerLegalDocuments)) {
    assert.equal(approval.version, documents[id as keyof typeof documents].version);
    assert.equal(approval.version, "1.0");
    assert.equal(approval.ownerStatus, "owner-approved");
    assert.equal(approval.counselStatus, "outstanding");
  }
  assert.deepEqual(Object.keys(ownerApprovedPreparationItems).sort(), ["terms", "privacyEn", "privacyBm", "prohibitedItems", "productPolicyModel", "publicBrowsingMigration",
    "immutableAcceptanceHistory", "protectedWriteMaintenance", "productionActivationRunbook"].sort());
  for (const key of Object.keys(ownerApprovedPreparationItems) as (keyof typeof ownerApprovedPreparationItems)[]) assert.equal(currentV1LaunchApprovals.owner[key], true);
  assert.ok(Object.values(ownerApprovedV1ProductDecisions).every(value => value === true));
  assert.ok(Object.values(currentV1LaunchApprovals.counsel).every(value => value === false));
  assert.equal(currentV1LaunchApprovals.owner.launchDate, true);
  assert.ok(Object.values(currentV1LaunchApprovals.issues).every(issue => issue.status === "pending" && issue.reviewReference === null));
  for (const key of ["addressDisclosure", "retention", "productionActivation", "domainCutover"] as const) assert.equal(currentV1LaunchApprovals.owner[key], false);
  for (const version of [null, "1.0-draft", "1.0-staging", "2.0"]) assert.equal(v1OwnerDocumentApproval(version).ownerStatus, "not-approved");
});

test("deferred address and outstanding counsel permit engineering preparation while final publication remains closed", () => {
  assert.equal(operatorDisclosureDecision.kind, "unresolved");
  assert.equal(operatorDisclosureDecision.text, null);
  assert.equal(operatorDisclosureDecision.bmText, null);
  assert.deepEqual(reviewV1ReleasePreparation(), []);
  assert.ok(reviewV1ReleasePreparation(pendingV1LaunchApprovals).length);
  const publicationIssues = reviewV1PublicationGate({ ...readyFixture(), approvals: currentV1LaunchApprovals, launchDate: null,
    sourceDates, disclosure: operatorDisclosureDecision, verifiedRoutes: {}, finalFrontendArtifactVerified: false, policyRulesArtifactsRegenerated: false });
  assert.ok(publicationIssues.some(issue => /Counsel/.test(issue)));
  assert.ok(publicationIssues.some(issue => /address/.test(issue)));
  assert.ok(publicationIssues.some(issue => /productionActivation/.test(issue)));
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(legalPublicationReadiness.finalContentApproved, false);
  assert.equal(legalPublicationReadiness.bmPrivacyNoticeApproved, false);
});

test("recording owner approval publishes no address or legal route and does not supply an active runtime policy", () => {
  assert.equal(canPublishProductionLegal({ nodeEnv: "production", useEmulators: "false", projectId: "takeme-52b80" }), false);
  for (const metadata of [buildTermsMetadata(false), buildPrivacyMetadata(false), buildBmPrivacyMetadata(false), buildProhibitedItemsMetadata(false)]) {
    assert.deepEqual(metadata.robots, { index: false, follow: false });
  }
  const context = { target: "production" as const, projectId: "takeme-52b80" };
  assert.equal(releasePolicyFromMirror(undefined, context), null);
  assert.equal(releasePolicyFromMirror({ releaseTarget: context.target, projectId: context.projectId, ...productionReleasePolicy }, context), null);
  assert.equal(operatorDisclosureDecision.text, null);
  for (const document of Object.values(documents)) assert.equal(document.businessAddress, null);
});

test("only the named owner date input prepares all eight fields, with no implicit fallback", () => {
  for (const fallback of [{}, { launchDate: syntheticDate }, { STAGING_LAUNCH_DATE: syntheticDate }]) {
    const plan = planV1LegalDates(fallback);
    assert.equal(plan.status, "pending");
    for (const pair of Object.values(plan.documents)) assert.deepEqual(pair, { effectiveDate: null, lastUpdated: null });
  }
  const plan = planV1LegalDates(inputs);
  assert.deepEqual(validateV1LegalDates(plan.documents, syntheticDate), []);
  for (const pair of Object.values(plan.documents)) assert.deepEqual(pair, { effectiveDate: syntheticDate, lastUpdated: syntheticDate });
  assert.ok(Object.values(plan.documents).every(Object.isFrozen));
  assert.ok(validateV1LegalDates({ ...plan.documents, privacyBm: { effectiveDate: syntheticDate, lastUpdated: "2099-03-01" } }, syntheticDate).length);
  assert.ok(validateV1LegalDates(sourceDates, syntheticDate).length);
  for (const value of ["2099-02-29", "2100-02-29", "2099-4-1", "2099-04-31", " 2099-01-01", "", true]) {
    assert.throws(() => planV1LegalDates({ [legalLaunchDateInput]: value }), /valid calendar date/);
  }
});

test("the exact proposed source change propagates through actual legal modules in an isolated copy without approving publication", async () => {
  const original = await readFile(path.join(repository, sourcePath), "utf8");
  const pending = original.replace('effectiveDate: "2026-10-12", lastUpdated: "2026-10-12"', "effectiveDate: null, lastUpdated: null");
  const proposal = prepareV1LegalDateSource(pending, inputs);
  assert.equal(proposal.applied, false);
  assert.equal(proposal.proposedSource, pending.replace(proposal.before, proposal.after));
  assert.throws(() => prepareV1LegalDateSource(pending, {}), /supplied explicitly/);
  assert.throws(() => prepareV1LegalDateSource(proposal.proposedSource, inputs), /review changes/);
  assert.throws(() => prepareV1LegalDateSource(pending.replace("publicationApproved: false", "publicationApproved: true"), inputs), /review changes/);
  const directory = await mkdtemp(path.join(tmpdir(), "takeme-legal-date-offline-"));
  try {
    const files = [sourcePath, "functions/src/release-policy.ts", "functions/src/staging-environment.ts", "functions/src/production-environment.ts",
      "src/content/operator.ts", "src/content/operator-disclosure.ts", "src/content/terms.ts", "src/content/privacy.ts", "src/content/privacy-bm.ts", "src/content/marketplace-rules.ts"];
    for (const file of files) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await writeFile(path.join(directory, file), file === sourcePath ? proposal.proposedSource : await readFile(path.join(repository, file)));
    }
    for (const [file, key] of [["terms", "termsDocument"], ["privacy", "privacyDocument"], ["privacy-bm", "bmPrivacyDocument"], ["marketplace-rules", "prohibitedItemsPolicy"]]) {
      const loaded = (await import(pathToFileURL(path.join(directory, `src/content/${file}.ts`)).href))[key];
      assert.equal(loaded.effectiveDate, syntheticDate);
      assert.equal(loaded.lastUpdated, syntheticDate);
      assert.equal(loaded.version, "1.0");
    }
    assert.equal((await import(pathToFileURL(path.join(directory, sourcePath)).href)).legalPublicationReadiness.publicationApproved, false);
  } finally { await rm(directory, { recursive: true, force: true }); }
  assert.equal(await readFile(path.join(repository, sourcePath), "utf8"), original);
  assert.equal(legalPublicationReadiness.effectiveDate, "2026-10-12");
});

test("public disclosure needs explicit owner and counsel approval, and an alternative does not invent an address", () => {
  assert.ok(validateOperatorDisclosure().length);
  assert.deepEqual(legalOperatorDisclosure(), { businessAddress: null, businessAddressStatus: "LEGAL REVIEW / OWNER INPUT REQUIRED" });
  assert.deepEqual(legalOperatorDisclosure(approvedAlternative), { businessAddress: null, businessAddressStatus: approvedAlternative.text });
  assert.equal(bmLegalOperatorDisclosure(approvedAlternative), approvedAlternative.bmText);
  assert.equal(bmLegalOperatorDisclosure(), bmPrivacyDocument.localizedBusinessAddressStatus);
  for (const decision of [{ ...approvedAlternative, ownerApprovedForPublicUse: false }, { ...approvedAlternative, counselApproved: false },
    { ...approvedAlternative, text: null }, { ...approvedAlternative, bmText: null }, { ...approvedAlternative, text: " " }, { ...approvedAlternative, text: "\u0000test" }]) {
    assert.ok(validateOperatorDisclosure(decision).length);
    assert.equal(legalOperatorDisclosure(decision).businessAddressStatus, "LEGAL REVIEW / OWNER INPUT REQUIRED");
  }
  const address = { ...approvedAlternative, kind: "address" as const, text: "Synthetic public correspondence test address", bmText: "Alamat surat-menyurat sintetik untuk ujian" };
  assert.equal(legalOperatorDisclosure(address).businessAddress, address.text);
  assert.equal(operatorDisclosureDecision.text, null);
});

test("future payload is exact and accepted by the existing trusted policy schema without activating the source", () => {
  const record = prepareV1PolicyRecord();
  assert.deepEqual(record, { releaseTarget: "production", projectId: "takeme-52b80", publicationApproved: true, termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18 });
  const context = { target: "production" as const, projectId: "takeme-52b80" };
  assert.ok(releasePolicyFromMirror(record, context));
  for (const bad of [{ ...record, extra: true }, { ...record, projectId: "demo-takeme" }, { ...record, publicationApproved: false }, { ...record, minimumAge: 17 }, { ...record, termsVersion: "1.0-staging" }]) {
    assert.equal(releasePolicyFromMirror(bad, context), null);
  }
  assert.equal(productionReleasePolicy.publicationApproved, false);
});

test("every owner/counsel/legal-issue and artifact/route/date/disclosure condition fails closed independently", () => {
  assert.deepEqual(reviewV1PublicationGate(readyFixture()), []);
  for (const key of ownerApprovalItems.filter(key => key !== "domainCutover")) {
    const input = readyFixture(); input.approvals = { ...input.approvals, owner: { ...input.approvals.owner, [key]: false } };
    assert.ok(reviewV1PublicationGate(input).some(issue => issue.includes(key)));
  }
  for (const key of counselApprovalItems) {
    const input = readyFixture(); input.approvals = { ...input.approvals, counsel: { ...input.approvals.counsel, [key]: false } };
    assert.ok(reviewV1PublicationGate(input).some(issue => issue.includes(key)));
  }
  for (const key of externalLegalIssueIds) {
    const input = readyFixture(); input.approvals = { ...input.approvals, issues: { ...input.approvals.issues, [key]: { status: "explicitly-accepted", reviewReference: null } } };
    assert.ok(reviewV1PublicationGate(input).some(issue => issue.includes(key)));
  }
  for (const route of finalLegalRoutes) {
    const input = readyFixture(); input.verifiedRoutes = { ...input.verifiedRoutes, [route]: false };
    assert.ok(reviewV1PublicationGate(input).some(issue => issue.includes(route)));
  }
  for (const change of [{ launchDate: null }, { launchDate: "2099-02-29" }, { sourceDates }, { disclosure: operatorDisclosureDecision },
    { finalFrontendArtifactVerified: false }, { policyRulesArtifactsRegenerated: false }]) {
    assert.ok(reviewV1PublicationGate({ ...readyFixture(), ...change }).length);
  }
  assert.ok(reviewV1PublicationGate({ ...readyFixture(), approvals: pendingV1LaunchApprovals, launchDate: null, sourceDates,
    disclosure: operatorDisclosureDecision, verifiedRoutes: {}, finalFrontendArtifactVerified: false, policyRulesArtifactsRegenerated: false }).length);
  assert.ok(Object.values(pendingV1LaunchApprovals.owner).every(value => value === false));
  assert.ok(Object.values(pendingV1LaunchApprovals.counsel).every(value => value === false));
});

test("CLI creates a private outside-Git proposal only, rejects missing date/apply/overwrite/in-Git output", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "takeme-launch-proposal-offline-"));
  const original = await readFile(path.join(repository, sourcePath), "utf8");
  const fixture = path.join(directory, "source");
  await mkdir(fixture);
  for (const folder of ["src", "functions/src", "scripts"]) await cp(path.join(repository, folder), path.join(fixture, folder), { recursive: true });
  await writeFile(path.join(fixture, sourcePath), original.replace('effectiveDate: "2026-10-12", lastUpdated: "2026-10-12"', "effectiveDate: null, lastUpdated: null"));
  const run = (args: string[], date?: string) => spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--experimental-strip-types", "scripts/prepare-v1-legal-launch.mjs", ...args], {
    cwd: fixture, encoding: "utf8", env: { NODE_ENV: "test", PATH: process.env.PATH, ...(date === undefined ? {} : { [legalLaunchDateInput]: date }) },
  });
  try {
    const output = path.join(directory, "proposal.json");
    assert.notEqual(run(["--output", output]).status, 0);
    assert.notEqual(run(["--output", output], "2099-02-29").status, 0);
    assert.notEqual(run(["--output", output, "--apply"], syntheticDate).status, 0);
    assert.notEqual(run(["--output", path.join(repository, "proposal.json")], syntheticDate).status, 0);
    const result = run(["--output", output], syntheticDate);
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(await readFile(output, "utf8"));
    assert.equal(plan.publicationApproved, false); assert.equal(plan.applied, false);
    assert.equal(plan.cloudAccessed, false); assert.equal(plan.policyRecordWritten, false);
    assert.equal(plan.proposal.input, legalLaunchDateInput);
    assert.deepEqual(plan.proposal.documents, planV1LegalDates(inputs).documents);
    assert.deepEqual(plan.releasePreparationBlockers, []);
    for (const approval of Object.values(plan.ownerLegalContent) as { ownerStatus: string; counselStatus: string }[]) {
      assert.equal(approval.ownerStatus, "owner-approved"); assert.equal(approval.counselStatus, "outstanding");
    }
    assert.notEqual(run(["--output", output], syntheticDate).status, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
  assert.equal(await readFile(path.join(repository, sourcePath), "utf8"), original);
});
