const assert = require("node:assert/strict");
const test = require("node:test");
const { messageRequestIdentity, messageRetryDecision, normalizeMessageBody, MESSAGE_REQUEST_RETENTION_MS } = require("../lib/message-request.js");
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
