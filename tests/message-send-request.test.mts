import assert from "node:assert/strict";
import test from "node:test";
import { pendingMessageSend } from "../src/lib/message-send-request.ts";

test("an uncertain same normalized send retains its key until confirmed", () => {
  let keys = 0;
  const createKey = () => `request-${++keys}`;
  const initial = pendingMessageSend(null, "buyer", "conversation", "  Is  this available?  ", createKey);
  assert.equal(initial.body, "Is this available?");
  assert.equal(pendingMessageSend(initial, "buyer", "conversation", "Is\tthis available?", createKey), initial);
  assert.equal(keys, 1);
  // Clearing the confirmed attempt permits intentionally sending the same text again.
  assert.notEqual(pendingMessageSend(null, "buyer", "conversation", initial.body, createKey).idempotencyKey, initial.idempotencyKey);
});

test("edited content, conversation and signed-in identity start distinct logical sends", () => {
  let keys = 0;
  const createKey = () => `request-${++keys}`;
  const initial = pendingMessageSend(null, "buyer", "first", "Question", createKey);
  for (const [sender, conversation, body] of [["buyer", "first", "Changed question"], ["buyer", "second", "Question"], ["seller", "first", "Question"]]) {
    assert.notEqual(pendingMessageSend(initial, sender!, conversation!, body!, createKey).idempotencyKey, initial.idempotencyKey);
  }
  assert.equal(keys, 4);
});
