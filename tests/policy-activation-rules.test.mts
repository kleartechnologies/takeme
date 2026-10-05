import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  assertFirestorePolicyRules, assertStoragePolicyRules, demoReleasePolicy,
  productionReleasePolicy, renderPolicyRules, renderProductionPolicyRulesPreview,
  stagingReleasePolicy, validateProductionPolicy,
} from "../functions/src/release-policy.ts";
import { productionEnvironment } from "../functions/src/production-environment.ts";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";
import { releasePolicyFromMirror } from "../functions/src/policy-runtime.ts";

const productionContext = { target: "production" as const, projectId: productionEnvironment.projectId };
const mirror = () => ({ releaseTarget: "production", projectId: productionEnvironment.projectId,
  publicationApproved: true, termsVersion: productionReleasePolicy.termsVersion,
  privacyVersion: productionReleasePolicy.privacyVersion, minimumAge: 18 });
const section = (rules: string, name: string) => {
  const match = new RegExp(`function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n    \\}`).exec(rules);
  assert.ok(match, `The ${name} security rule must exist.`);
  return match[1];
};

test("ordinary generated production acceptance and mirror branches stay closed during preparation", () => {
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(productionReleasePolicy.termsVersion, "1.0");
  assert.equal(productionReleasePolicy.privacyVersion, "1.0");
  assert.equal(productionReleasePolicy.minimumAge, 18);
  for (const name of ["configuredAcceptance", "configuredReleasePolicy"]) {
    assert.match(section(renderPolicyRules(), name), /\|\| false\);$/);
  }
});

test("read-only preview uses central final identifiers and exact production identity without changing source", () => {
  const before = JSON.stringify({ policy: productionReleasePolicy, legal: legalPublicationReadiness });
  const preview = renderProductionPolicyRulesPreview();
  assert.match(section(preview, "configuredAcceptance"), /request\.auth\.token\.aud == "takeme-52b80" && acceptance\.termsVersion == "1\.0" && acceptance\.privacyVersion == "1\.0"/);
  assert.match(section(preview, "configuredReleasePolicy"), /policy\.minimumAge == 18/);
  assert.match(section(preview, "configuredReleasePolicy"), /policy\.releaseTarget == 'production' && policy\.projectId == "takeme-52b80"/);
  assert.match(section(preview, "configuredReleasePolicy"), /policy\.projectId == request\.auth\.token\.aud/);
  assert.equal(JSON.stringify({ policy: productionReleasePolicy, legal: legalPublicationReadiness }), before);
  assert.equal(legalPublicationReadiness.effectiveDate, null);
  assert.equal(legalPublicationReadiness.lastUpdated, null);
  assert.equal(Object.isFrozen(productionReleasePolicy), true);
});

test("ordinary release rule assertions refuse final-rule preview while publication is false", () => {
  for (const verify of [assertFirestorePolicyRules, assertStoragePolicyRules]) {
    assert.doesNotThrow(() => verify(renderPolicyRules()));
    assert.throws(() => verify(renderProductionPolicyRulesPreview()), /differ from the approved central release configuration/);
  }
});

test("production rule mirror schema is the exact same six-field model as the trusted runtime", () => {
  const production = section(renderProductionPolicyRulesPreview(), "configuredReleasePolicy");
  const expected = Object.keys(mirror()).sort();
  for (const method of ["hasAll", "hasOnly"]) {
    const values = new RegExp(`policy\\.keys\\(\\)\\.${method}\\(\\[([^\\]]+)\\]\\)`).exec(production)?.[1];
    assert.ok(values, `Production must require ${method} schema validation.`);
    assert.deepEqual([...values.matchAll(/'([^']+)'/g)].map(value => value[1]).sort(), expected);
  }
  assert.ok(releasePolicyFromMirror(mirror(), productionContext));
  for (const field of expected) {
    const missing: Record<string, unknown> = mirror();
    delete missing[field];
    assert.equal(releasePolicyFromMirror(missing, productionContext), null);
  }
  assert.equal(releasePolicyFromMirror({ ...mirror(), extraApproval: true }, productionContext), null);
});

test("wrong production resource identity cannot use the final mirror or a legacy production bucket", () => {
  const preview = renderProductionPolicyRulesPreview();
  assert.doesNotMatch(section(preview, "configuredAcceptance"), /!request\.auth\.token\.aud\.matches|request\.auth\.token\.aud !=/);
  assert.equal(releasePolicyFromMirror({ ...mirror(), projectId: "foreign-project" }, productionContext), null);
  assert.equal(releasePolicyFromMirror(mirror(), { ...productionContext, projectId: "foreign-project" }), null);
  for (const generated of [renderPolicyRules(), preview]) {
    const bucket = section(generated, "configuredStorageBucket");
    assert.match(bucket, /request\.auth\.token\.aud == "takeme-52b80" && name == "takeme-52b80\.firebasestorage\.app"/);
    assert.match(bucket, /request\.auth\.token\.aud != "takeme-staging-822a5" && request\.auth\.token\.aud != "takeme-52b80"/);
    assert.doesNotMatch(bucket, /name == "takeme-52b80\.appspot\.com"/);
  }
});

test("preview retains the existing separate demo and staging acceptance and bucket semantics", () => {
  for (const generated of [renderPolicyRules(), renderProductionPolicyRulesPreview()]) {
    assert.match(generated, new RegExp(`request\\.auth\\.token\\.aud == 'demo-takeme' && acceptance\\.termsVersion == "${demoReleasePolicy.termsVersion}"`));
    assert.match(generated, new RegExp(`request\\.auth\\.token\\.aud == "takeme-staging-822a5" && acceptance\\.termsVersion == "${stagingReleasePolicy.termsVersion}"`));
    assert.match(section(generated, "configuredStorageBucket"), /request\.auth\.token\.aud == "takeme-staging-822a5" && name == "takeme-staging-822a5\.firebasestorage\.app"/);
    assert.match(section(generated, "configuredStorageBucket"), /name in \[request\.auth\.token\.aud \+ '\.appspot\.com', request\.auth\.token\.aud \+ '\.firebasestorage\.app'\]/);
  }
});

test("final-identifier validation refuses malformed and nonproduction versions even for preparation", () => {
  for (const field of ["termsVersion", "privacyVersion"] as const) {
    for (const value of [null, "", " ", " 1.0", "1.0 ", "1. 0", "1.0-draft", "1.0-staging", "demo-1.0", "test-final"]) {
      assert.ok(validateProductionPolicy({ ...productionReleasePolicy, publicationApproved: true, [field]: value }).length, `${field} must refuse ${String(value)}.`);
      assert.equal(releasePolicyFromMirror({ ...mirror(), [field]: value }, productionContext), null);
    }
  }
  assert.deepEqual(validateProductionPolicy({ ...productionReleasePolicy, publicationApproved: true }), []);
});

test("rule templates preserve immutable/private history, public browsing and exact Storage safety gates", async () => {
  const firestore = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  const storage = await readFile(new URL("../storage.rules", import.meta.url), "utf8");
  assert.match(firestore, /function marketplaceEligible\(\) \{[\s\S]*?releasePolicies\/current/);
  assert.match(firestore, /match \/releasePolicies\/\{id\} \{ allow get: if id == 'current'; allow list, write: if false; \}/);
  assert.match(firestore, /match \/categories\/\{categoryId\} \{ allow read: if true;/);
  assert.match(firestore, /match \/privateUserAddresses\/\{uid\} \{\s*allow get: if owns\(uid\) \|\| isAdmin\(\);\s*allow list: if false;/);
  assert.match(firestore, /match \/conversations\/\{conversationId\} \{\s*allow read, write: if false;/);
  assert.doesNotMatch(firestore, /match \/private\/\{[^}]*\}|match \/policyAcceptances\//);
  assert.match(storage, /request\.resource\.size > 0 && request\.resource\.size <= 8 \* 1024 \* 1024/);
  assert.match(storage, /contentType\.matches\('image\/\(jpeg\|png\|webp\)'\)/);
  assert.match(storage, /permit\.path == path/);
  assert.match(storage, /permit\.contentType == request\.resource\.contentType/);
  assert.match(storage, /permit\.sizeBytes == request\.resource\.size/);
  assert.match(storage, /request\.time < permit\.expiresAt/);
  assert.equal((storage.match(/allow update: if false;/g) ?? []).length, 2);
  assert.equal((storage.match(/allow create: if resource == null/g) ?? []).length, 2);
  assert.doesNotMatch(storage, /match \/(?:evidence|accountDeletionEvidence|transactionDisputes)/);
});
