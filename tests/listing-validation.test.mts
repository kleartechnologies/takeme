import assert from "node:assert/strict";
import test from "node:test";
import { createFacetKey, createFacetKeys, createSearchTokens, normalizeSearch, validateImageFiles, validateListingInput } from "../src/lib/listing-validation.ts";

const validInput = {
  title: "Fujifilm mirrorless camera",
  description: "A carefully used camera with charger and two batteries included.",
  categoryId: "electronics",
  condition: "Good" as const,
  price: 1280,
  listingType: "buy_now" as const,
  location: "Bangsar, Kuala Lumpur",
};

test("normalizes and tokenizes searchable titles", () => {
  assert.equal(normalizeSearch("  Sony  XM5!  "), "sony xm5");
  const tokens = createSearchTokens("Fujifilm Camera");
  assert.ok(tokens.includes("fuji"));
  assert.ok(tokens.includes("camera"));
  assert.ok(tokens.includes("fujifilm cam"));
});

test("builds every facet wildcard combination", () => {
  const keys = createFacetKeys({ categoryId: "electronics", condition: "Good", listingType: "buy_now", location: "Kuala Lumpur" });
  assert.equal(keys.length, 16);
  assert.ok(keys.includes(createFacetKey({ categoryId: "electronics", condition: "Good" })));
  assert.ok(keys.includes("*|*|*|*"));
});

test("accepts valid buy-now listing data", () => {
  assert.deepEqual(validateListingInput(validInput), []);
});

test("rejects invalid price and unavailable auctions", () => {
  const errors = validateListingInput({ ...validInput, price: 0, listingType: "auction" as never });
  assert.ok(errors.some((error) => error.includes("positive")));
  assert.ok(errors.some((error) => error.includes("Auctions")));
});

test("enforces image type and size constraints", () => {
  const valid = new File([new Uint8Array(128)], "camera.webp", { type: "image/webp" });
  const invalid = new File([new Uint8Array(128)], "notes.txt", { type: "text/plain" });
  assert.deepEqual(validateImageFiles([valid]), []);
  assert.ok(validateImageFiles([invalid])[0].includes("not a JPEG"));
});
