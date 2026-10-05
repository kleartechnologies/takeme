const assert = require("node:assert/strict");
const test = require("node:test");
const { messageRequestIdentity, messageRequestIdentityForSend, messageRetryDecision, normalizeMessageBody,
  legacyMessageTransitionUntil, assertMessageTransitionStillActive, LEGACY_MESSAGE_MAX_WINDOW_MS,
  MESSAGE_REQUEST_RETENTION_MS } = require("../lib/message-request.js");
const key = "synthetic-request-key-0001", body = "Is this available?";
const identity = messageRequestIdentity("buyer", "conversation", key, body);

test("message keys are bounded and hashes frame authenticated sender, conversation and action", () => {
  for (const value of [undefined, null, 123, "short", " ".repeat(16), "a".repeat(129), "key/with/path-1234567"]) assert.throws(() => messageRequestIdentity("buyer", "conversation", value, body));
  assert.match(identity.requestId, /^[a-f0-9]{64}$/);
  assert.match(identity.messageId, /^m_[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(identity).includes(key), false);
  assert.deepEqual(messageRequestIdentity("buyer", "conversation", key, body), identity);
  assert.notEqual(messageRequestIdentity("seller", "conversation", key, body).messageId, identity.messageId);
  assert.notEqual(messageRequestIdentity("buyer", "other", key, body).messageId, identity.messageId);
  assert.notEqual(messageRequestIdentity("a|b", "c", key, body).messageId, messageRequestIdentity("a", "b|c", key, body).messageId);
});

test("canonical content is validated and conflicting key reuse never becomes a new send", () => {
  assert.equal(normalizeMessageBody("  Is\tthis  available?\n\n\n  "), body);
  for (const value of [null, 1, "  ", "x".repeat(2001)]) assert.throws(() => normalizeMessageBody(value));
  assert.equal(messageRetryDecision(undefined, undefined, "buyer", body, identity), "new");
  const message = { senderId: "buyer", body }, receipt = { bodyHash: identity.bodyHash, messageId: identity.messageId };
  assert.equal(messageRetryDecision(message, receipt, "buyer", body, identity), "retry");
  assert.throws(() => messageRetryDecision(message, receipt, "buyer", "Changed", messageRequestIdentity("buyer", "conversation", key, "Changed")), /different content/);
  assert.throws(() => messageRetryDecision({ senderId: "other", body }, undefined, "buyer", body, identity), /different content/);
  assert.throws(() => messageRetryDecision(undefined, receipt, "buyer", body, identity), /unavailable/);
});

test("receipt expiry or cleanup cannot recreate a retained message", () => {
  assert.equal(MESSAGE_REQUEST_RETENTION_MS, 24 * 60 * 60_000);
  const message = { senderId: "buyer", body };
  assert.equal(messageRetryDecision(message, { messageId: identity.messageId, bodyHash: identity.bodyHash, expiresAt: 0 }, "buyer", body, identity), "retry");
  assert.equal(messageRetryDecision(message, undefined, "buyer", body, identity), "retry");
});

const syntheticNow = Date.parse("2030-01-02T00:00:00.000Z");
const deadline = "2030-01-03T00:00:00.000Z";
const runtime = (target = "demo") => {
  const projectId = target === "production" ? "takeme-52b80" : target === "staging" ? "takeme-staging-822a5" : "demo-takeme";
  return { appProjectId: projectId, env: { GCLOUD_PROJECT: projectId, TAKEME_FIREBASE_PROJECT_ID: projectId,
    TAKEME_RELEASE_TARGET: target, TAKEME_ENABLE_LEGACY_MESSAGE_SEND: "true", TAKEME_LEGACY_MESSAGE_SEND_UNTIL: deadline,
    ...(target === "demo" ? { FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" } : {}) } };
};

test("legacy message transition defaults off and needs exact trusted target identity", () => {
  for (const target of ["demo", "staging", "production"]) {
    const selected = runtime(target);
    assert.equal(legacyMessageTransitionUntil(selected, syntheticNow), Date.parse(deadline));
    for (const changes of [
      { TAKEME_ENABLE_LEGACY_MESSAGE_SEND: undefined }, { TAKEME_ENABLE_LEGACY_MESSAGE_SEND: "false" },
      { TAKEME_ENABLE_LEGACY_MESSAGE_SEND: "TRUE" }, { TAKEME_LEGACY_MESSAGE_SEND_UNTIL: undefined },
      { TAKEME_RELEASE_TARGET: undefined }, { TAKEME_FIREBASE_PROJECT_ID: "wrong-project" },
      { GCLOUD_PROJECT: "wrong-project" }, { GOOGLE_CLOUD_PROJECT: "wrong-project" },
      { FIREBASE_CONFIG: "not-json" }, { FIREBASE_CONFIG: "[]" }, { FIREBASE_CONFIG: '{"projectId":"wrong-project"}' },
    ]) assert.equal(legacyMessageTransitionUntil({ ...selected, env: { ...selected.env, ...changes } }, syntheticNow), null);
    assert.equal(legacyMessageTransitionUntil({ ...selected, appProjectId: undefined }, syntheticNow), null);
    assert.equal(legacyMessageTransitionUntil({ ...selected, appProjectId: "other-project" }, syntheticNow), null);
  }
  assert.equal(legacyMessageTransitionUntil(runtime("unknown"), syntheticNow), null);
  const prod = runtime("production");
  assert.equal(legacyMessageTransitionUntil({ ...prod, env: { ...prod.env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" } }, syntheticNow), null);
  assert.equal(legacyMessageTransitionUntil({ ...prod, env: { ...prod.env, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false" } }, syntheticNow), Date.parse(deadline));
  const demo = runtime();
  assert.equal(legacyMessageTransitionUntil({ ...demo, env: { ...demo.env, FIREBASE_AUTH_EMULATOR_HOST: "not-loopback:9099" } }, syntheticNow), null);
});

test("legacy transition is finite, canonical UTC, and denies before its window or at expiry", () => {
  assert.equal(LEGACY_MESSAGE_MAX_WINDOW_MS, 7 * 24 * 60 * 60_000);
  const selected = runtime(), until = Date.parse(deadline);
  assert.equal(legacyMessageTransitionUntil(selected, until - LEGACY_MESSAGE_MAX_WINDOW_MS), until);
  assert.equal(legacyMessageTransitionUntil(selected, until - LEGACY_MESSAGE_MAX_WINDOW_MS - 1), null);
  assert.equal(legacyMessageTransitionUntil(selected, until - 1), until);
  assert.equal(legacyMessageTransitionUntil(selected, until), null);
  assert.equal(legacyMessageTransitionUntil(selected, until + 1), null);
  for (const value of ["", "not-a-date", "2030-02-30T00:00:00.000Z", "2030-01-03", "2030-01-03T00:00:00+00:00", "2030-01-03T00:00:00.000Z "]) {
    assert.equal(legacyMessageTransitionUntil({ ...selected, env: { ...selected.env, TAKEME_LEGACY_MESSAGE_SEND_UNTIL: value } }, syntheticNow), null);
  }
  for (const value of [NaN, Infinity]) assert.equal(legacyMessageTransitionUntil(selected, value), null);
});

test("only truly missing keys use unique server requests; invalid explicit keys never downgrade", () => {
  const selected = runtime(), sends = Array.from({ length: 4 }, () => messageRequestIdentityForSend("buyer", "conversation", {}, body, selected, syntheticNow));
  assert.equal(new Set(sends.map(send => send.messageId)).size, sends.length);
  assert.equal(new Set(sends.map(send => send.bodyHash)).size, 1);
  for (const send of sends) {
    assert.match(send.messageId, /^m_[a-f0-9]{64}$/);
    assert.equal(send.legacyUntilMs, Date.parse(deadline));
    assert.equal(messageRetryDecision(undefined, undefined, "buyer", body, send), "new");
    assert.equal(messageRetryDecision({ senderId: "buyer", body }, { messageId: send.messageId, bodyHash: send.bodyHash }, "buyer", body, send), "retry");
  }
  for (const value of [undefined, null, "", "short", 123, "a".repeat(129)]) {
    assert.throws(() => messageRequestIdentityForSend("buyer", "conversation", { idempotencyKey: value }, body, selected, syntheticNow));
  }
  assert.throws(() => messageRequestIdentityForSend("buyer", "conversation", {}, body, { ...selected, env: {} }, syntheticNow));
  assert.throws(() => messageRequestIdentityForSend("buyer", "conversation", {}, body, selected, Date.parse(deadline)));
});

test("new keyed sends keep deterministic scopes and retries independently of legacy configuration", () => {
  for (const selected of [runtime(), { appProjectId: undefined, env: {} }]) {
    const send = messageRequestIdentityForSend("buyer", "conversation", { idempotencyKey: key }, body, selected, syntheticNow);
    assert.equal(send.messageId, identity.messageId);
    assert.equal(send.legacyUntilMs, null);
    assert.equal(messageRetryDecision({ senderId: "buyer", body }, undefined, "buyer", body, send), "retry");
    assert.notEqual(messageRequestIdentityForSend("seller", "conversation", { idempotencyKey: key }, body, selected, syntheticNow).messageId, send.messageId);
    assert.notEqual(messageRequestIdentityForSend("buyer", "other", { idempotencyKey: key }, body, selected, syntheticNow).messageId, send.messageId);
    assert.throws(() => messageRetryDecision({ senderId: "buyer", body }, undefined, "buyer", "Different", messageRequestIdentityForSend("buyer", "conversation", { idempotencyKey: key }, "Different", selected, syntheticNow)), /different content/);
    assert.doesNotThrow(() => assertMessageTransitionStillActive(send, Date.parse(deadline)));
  }
});

test("an expired legacy transaction attempt is refused before message writes", () => {
  const send = messageRequestIdentityForSend("buyer", "conversation", {}, body, runtime(), syntheticNow);
  assert.doesNotThrow(() => assertMessageTransitionStillActive(send, Date.parse(deadline) - 1));
  assert.throws(() => assertMessageTransitionStillActive(send, Date.parse(deadline)), /Refresh TAKEME/);
  assert.throws(() => assertMessageTransitionStillActive(send, NaN), /Refresh TAKEME/);
});
