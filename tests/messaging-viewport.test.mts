import assert from "node:assert/strict";
import test from "node:test";
import { messagingViewportHeight } from "../src/lib/messaging-viewport.ts";

test("wrapped staging banner and measured bottom navigation leave the 430px composer above navigation", () => {
  const height = messagingViewportHeight({ shellTop: 48, viewportHeight: 932, bottomNavigationTop: 872.5 });
  assert.equal(height, 824.5);
  assert.equal(48 + height, 872.5);
  // The previous 872px shell extended 47.5px into navigation, obscuring its composer.
  assert.ok(48 + (932 - 60) > 872.5);
});

test("tablet and desktop bounds include the banner and actual header instead of assuming a fixed offset", () => {
  assert.equal(messagingViewportHeight({ shellTop: 32, viewportHeight: 1024, bottomNavigationTop: 964.5 }), 932.5);
  assert.equal(messagingViewportHeight({ shellTop: 32 + 68, viewportHeight: 900 }), 800);
  assert.equal(messagingViewportHeight({ shellTop: 68, viewportHeight: 900 }), 832);
});

test("safe-area navigation and shrinking or panned keyboard viewports bound the composer", () => {
  assert.equal(messagingViewportHeight({ shellTop: 48, viewportHeight: 844, bottomNavigationTop: 750 }), 702);
  assert.equal(messagingViewportHeight({ shellTop: 48, viewportHeight: 500, bottomNavigationTop: 784 }), 452);
  assert.equal(messagingViewportHeight({ shellTop: 48, viewportHeight: 500, viewportOffsetTop: 35, bottomNavigationTop: 784 }), 487);
  assert.equal(messagingViewportHeight({ shellTop: 48, viewportHeight: 500, bottomNavigationTop: 440 }), 392);
  assert.equal(messagingViewportHeight({ shellTop: 110, viewportHeight: 80 }), 0);
});
