import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { categories, getCategoryName } from "../src/data/categories.ts";
import { createFacetKey, createFacetKeys, validateListingInput } from "../src/lib/listing-validation.ts";

const originalIds = ["electronics", "fashion", "home-living", "games", "toys-hobbies", "sports", "automotive", "books", "collectibles", "tools", "baby-kids", "others"];
const newCategories = [
  { id: "baby-kids", name: "Baby & Kids", asset: "babies-kids.png" },
  { id: "tv-home-appliances", name: "TV & Home Appliances", asset: "tv-home appliances.png" },
  { id: "health-nutrition", name: "Health & Nutrition", asset: "health-nutritions.png" },
];

test("preserves existing category identifiers and adds the two new categories exactly once", () => {
  const ids = categories.map((category) => category.id);
  assert.equal(ids.length, 14);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of originalIds) assert.ok(ids.includes(id), `${id} remains supported`);
  for (const { id, name } of newCategories) assert.equal(getCategoryName(id), name);
});

test("category images resolve to supplied files and fallbacks remain explicit", () => {
  for (const category of categories) {
    if (category.icon.startsWith("/")) {
      assert.ok(existsSync(path.resolve("public", decodeURIComponent(category.icon).slice(1))), `${category.id} asset exists`);
    } else {
      assert.ok(["Wrench", "Shapes"].includes(category.icon), `${category.id} uses an existing fallback icon`);
    }
  }
  for (const { id, asset } of newCategories) assert.equal(categories.find((category) => category.id === id)?.icon, `/categories/${asset}`);
});

test("new category ids validate and produce matching Firestore facet keys", () => {
  for (const { id } of newCategories) {
    const listing = { title: "Category integration test", description: "A complete local listing description for testing.", categoryId: id, condition: "Good" as const, price: 100, listingType: "buy_now" as const, publicLocation: { districtOrCity: "Kuala Lumpur", state: "W.P. Kuala Lumpur", country: "Malaysia" as const } };
    assert.deepEqual(validateListingInput(listing), []);
    assert.ok(createFacetKeys({ ...listing, location: "Kuala Lumpur, W.P. Kuala Lumpur" }).includes(createFacetKey({ categoryId: id })));
  }
});
