const assert = require("node:assert/strict");
const test = require("node:test");
const { randomUUID } = require("node:crypto");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const { policyAcceptancePath, legacyAcceptanceHistory, assertAcceptanceHistory, assertProjectedAcceptance, newAcceptanceHistory } = require("../lib/policy-acceptance-history");
const { demoReleasePolicy } = require("../lib/release-policy");
const owner = "synthetic-history-owner", context = { target: "demo", projectId: "demo-takeme", policy: demoReleasePolicy };
const when = Timestamp.fromMillis(1000);
const legacy = () => ({ termsVersion: "historical-policy-1", privacyVersion: "historical-policy-2",
  termsAcceptedAt: when, privacyAcceptedAt: Timestamp.fromMillis(2000), age18ConfirmedAt: Timestamp.fromMillis(3000), acceptanceSource: "web" });
const committed = value => Object.fromEntries(Object.entries(value).map(([key, field]) => [key, field instanceof FieldValue ? when : field]));
const validate = (event, versions = demoReleasePolicy, uid = owner) => assertAcceptanceHistory(event, uid, event.acceptanceId, versions, context);

test("legacy identity binds exact owner, policy and original evidence in a valid private document path", () => {
  const previous = legacy(), first = legacyAcceptanceHistory(owner, previous).acceptanceId;
  assert.match(first, /^legacy-[a-f0-9]{64}$/); assert.equal(legacyAcceptanceHistory(owner, { ...previous }).acceptanceId, first);
  assert.notEqual(legacyAcceptanceHistory("another-owner", previous).acceptanceId, first);
  for (const field of ["termsVersion", "privacyVersion"]) assert.notEqual(legacyAcceptanceHistory(owner, { ...previous, [field]: "next-version" }).acceptanceId, first);
  for (const field of ["termsAcceptedAt", "privacyAcceptedAt", "age18ConfirmedAt"]) assert.notEqual(legacyAcceptanceHistory(owner, { ...previous, [field]: Timestamp.fromMillis(9000) }).acceptanceId, first);
  assert.notEqual(legacyAcceptanceHistory(owner, { ...previous, revokedAt: when }).acceptanceId, first);
  assert.equal(policyAcceptancePath(owner, first), `users/${owner}/private/policyAcceptances/events/${first}`);
  assert.equal(policyAcceptancePath(owner, first).split("/").length % 2, 0);
});

test("invalid owner identities and client-selected paths cannot select arbitrary history", () => {
  for (const uid of [undefined, null, 12, "", "owner/other", "x".repeat(129)]) assert.throws(() => policyAcceptancePath(uid, randomUUID()), { code: "failed-precondition" });
  for (const id of [undefined, null, 1, "", "arbitrary", "../other", "x".repeat(200), "LEGACY-" + "a".repeat(64)]) assert.throws(() => policyAcceptancePath(owner, id), { code: "failed-precondition" });
  for (const field of ["termsVersion", "privacyVersion"]) for (const value of [undefined, null, 1, "", " version", "version ", "ver sion"]) {
    assert.throws(() => legacyAcceptanceHistory(owner, { ...legacy(), [field]: value }), { code: "failed-precondition" });
  }
});

test("new events use server IDs, bounded policy evidence and server timestamp transforms", () => {
  const id = randomUUID(), event = newAcceptanceHistory(owner, id, demoReleasePolicy, context);
  assert.equal(event.acceptanceId, id); assert.equal(event.ownerId, owner); assert.equal(event.evidenceKind, "web-acceptance");
  assert.equal(event.minimumAgeConfirmed, 18); assert.equal(event.source, "web");
  for (const key of ["termsAcceptedAt", "privacyAcceptedAt", "ageConfirmedAt", "acceptedAt"]) assert.ok(event[key] instanceof FieldValue);
  for (const key of ["email", "ip", "userAgent", "password", "providerToken"]) assert.equal(Object.hasOwn(event, key), false);
  assert.doesNotThrow(() => validate(committed(event)));
  assert.notEqual(newAcceptanceHistory(owner, randomUUID(), demoReleasePolicy, context).acceptanceId, id);
});

test("legacy copies exact separate timestamps without claiming unknown time or provenance", () => {
  const previous = legacy(), event = legacyAcceptanceHistory(owner, previous);
  assert.equal(event.evidenceKind, "legacy-current");
  assert.ok(event.termsAcceptedAt.isEqual(previous.termsAcceptedAt)); assert.ok(event.privacyAcceptedAt.isEqual(previous.privacyAcceptedAt));
  assert.ok(event.ageConfirmedAt.isEqual(previous.age18ConfirmedAt));
  for (const field of ["acceptedAt", "projectId", "releaseTarget"]) assert.equal(Object.hasOwn(event, field), false);
  assert.doesNotThrow(() => validate(event, previous)); assert.doesNotThrow(() => assertProjectedAcceptance(event, previous));
  assert.equal(legacyAcceptanceHistory(owner, undefined), null); assert.equal(legacyAcceptanceHistory(owner, { profileCompletedAt: when }), null);
});

test("partial evidence, invalid source or revocation refuses migration; known revocation stays exact", () => {
  for (const [field, value] of [["termsVersion", null], ["privacyVersion", ""], ["termsAcceptedAt", "unknown"],
    ["privacyAcceptedAt", false], ["age18ConfirmedAt", undefined], ["acceptanceSource", "client"], ["revokedAt", true], ["revokedAt", false], ["revokedAt", ""], ["revokedAt", 0]]) {
    assert.throws(() => legacyAcceptanceHistory(owner, { ...legacy(), [field]: value }), { code: "failed-precondition" });
  }
  const revokedAt = Timestamp.fromMillis(4000), event = legacyAcceptanceHistory(owner, { ...legacy(), revokedAt });
  assert.ok(event.revokedAt.isEqual(revokedAt)); assert.doesNotThrow(() => validate(event, legacy()));
  const fresh = committed(newAcceptanceHistory(owner, randomUUID(), demoReleasePolicy, context, revokedAt));
  assert.ok(fresh.reacceptanceAfterRevokedAt.isEqual(revokedAt)); assert.doesNotThrow(() => validate(fresh));
});

test("null legacy revocation is absent and never becomes a fabricated revocation timestamp", () => {
  const event = legacyAcceptanceHistory(owner, { ...legacy(), revokedAt: null });
  assert.deepEqual(event, legacyAcceptanceHistory(owner, legacy()));
  assert.equal(Object.hasOwn(event, "revokedAt"), false); assert.doesNotThrow(() => validate(event, legacy()));
  assert.equal(legacyAcceptanceHistory(owner, { profileCompletedAt: when, revokedAt: null }), null);
});

test("malformed, colliding or copied events cannot be silently accepted or repaired", () => {
  const event = committed(newAcceptanceHistory(owner, randomUUID(), demoReleasePolicy, context));
  for (const patch of [{ ownerId: "another-owner" }, { schemaVersion: 2 },
    { termsVersion: "older" }, { privacyVersion: "older" }, { minimumAgeConfirmed: "18" }, { minimumAgeConfirmed: 17 },
    { source: "client" }, { acceptedAt: "client-time" }, { ageConfirmedAt: false }, { evidenceKind: "unknown" },
    { releaseTarget: "production" }, { projectId: "other-project" }, { extra: true }, { reacceptanceAfterRevokedAt: true },
    { privacyAcceptedAt: Timestamp.fromMillis(2000) }]) {
    assert.throws(() => validate({ ...event, ...patch }), { code: "failed-precondition" });
  }
  assert.throws(() => assertAcceptanceHistory({ ...event, acceptanceId: randomUUID() }, owner, event.acceptanceId, demoReleasePolicy, context));
  for (const field of Object.keys(event)) { const incomplete = { ...event }; delete incomplete[field]; assert.throws(() => assertAcceptanceHistory(incomplete, owner, event.acceptanceId, demoReleasePolicy, context)); }
  const previous = { ...legacy(), termsVersion: demoReleasePolicy.termsVersion, privacyVersion: demoReleasePolicy.privacyVersion,
    termsAcceptedAt: when, privacyAcceptedAt: when, age18ConfirmedAt: when };
  assert.doesNotThrow(() => assertProjectedAcceptance(event, previous));
  assert.throws(() => assertProjectedAcceptance(event, { ...previous, age18ConfirmedAt: Timestamp.fromMillis(2000) }));
});
