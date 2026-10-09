import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaPhotoProgress, mediaPhotoFailure } from "../src/lib/media-photo-state.ts";
import { photoPreparationIssue } from "../src/lib/consumer-photo.ts";

test("a mixed eight-photo batch reports actual readiness while editing remains possible", () => {
  const photos = [{}, {}, {}, { preparing: true }, { preparing: true }, { preparing: true }, { preparing: true }, { failed: true }];
  assert.deepEqual(mediaPhotoProgress(photos), { total: 8, ready: 3, pending: 4, failed: 1, label: "3 of 8 photos ready" });
  assert.deepEqual(mediaPhotoProgress([...photos].reverse()), mediaPhotoProgress(photos));
  assert.notEqual(photoPreparationIssue(photos), "");
  photos[7] = {};
  assert.equal(mediaPhotoProgress(photos).ready, 4);
  assert.notEqual(photoPreparationIssue(photos), "");
  for (let i = 3; i < 7; i++) photos[i] = {};
  assert.equal(mediaPhotoProgress(photos).label, "8 of 8 photos ready");
  assert.equal(photoPreparationIssue(photos), "");
});

test("missing or failed photos never count as ready; removal preserves successful photos", () => {
  assert.deepEqual(mediaPhotoProgress([{}, { failed: true }], 1), { total: 3, ready: 1, pending: 0, failed: 2, label: "1 of 3 photos ready" });
  assert.equal(mediaPhotoProgress([{}]).label, "1 of 1 photos ready");
  assert.equal(photoPreparationIssue([{}]), "");
  assert.equal(mediaPhotoProgress([]).total, 0);
});

test("explicit transient failures permit a manual retry; security and unknown failures do not", () => {
  for (const code of ["media/network", "media/timeout", "media/unavailable", "functions/unavailable", "firestore/unavailable", "storage/retry-limit-exceeded"])
    assert.equal(mediaPhotoFailure(new Error("private details", { cause: { code } })).retryable, true);
  for (const code of ["functions/permission-denied", "firestore/permission-denied", "storage/unauthorized", "media/invalid", "functions/failed-precondition", undefined]) {
    const result = mediaPhotoFailure({ code, message: "secret backend response" });
    assert.equal(result.retryable, false);
    assert.equal(result.message.includes("secret"), false);
  }
});

test("raw HEIC produces the exact friendly fallback without a blind byte retry", () => {
  assert.deepEqual(mediaPhotoFailure(new Error("internal representation", { cause: { code: "media/unsupported" } })), {
    retryable: false,
    message: "We couldn’t prepare this photo. Try selecting it again or choose another photo.",
  });
  assert.equal(mediaPhotoProgress([{}, {}, {}, { preparing: true }]).label, "3 of 4 photos ready");
});
