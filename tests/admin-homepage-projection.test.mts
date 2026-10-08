import test from "node:test";
import assert from "node:assert/strict";
import {
  parseHomepage,
  currentHomepage,
} from "../functions/src/homepage-projection.ts";
const section = {
  sectionId: "products",
  type: "products",
  title: "Selected products",
  source: "MANUAL",
  startAt: null,
  endAt: null,
  products: [
    {
      id: "item",
      title: "Camera",
      price: 12,
      priceLabel: "Price",
      imageUrl: "",
      sellerId: "seller",
      endAt: null,
    },
  ],
  sellers: [],
  categories: [],
  banners: [],
  announcement: null,
  cta: null,
};
const projection = () => ({
  schemaVersion: 1,
  version: 1,
  sections: [section],
  categories: [],
});
test("public homepage rejects accidental admin data and invalid references instead of passing them through", () => {
  assert.ok(parseHomepage(projection()));
  for (const extra of [
    { internalDescription: "private" },
    { createdBy: "admin" },
    { assetIds: ["private"] },
    { draftVersion: 2 },
  ])
    assert.equal(parseHomepage({ ...projection(), ...extra }), null);
  for (const product of [
    { ...section.products[0], email: "private" },
    { ...section.products[0], id: "../private" },
    { ...section.products[0], sellerId: "seller/path" },
    { ...section.products[0], price: NaN },
    { ...section.products[0], imageUrl: "https://evil.test/x" },
  ])
    assert.equal(
      parseHomepage({
        ...projection(),
        sections: [{ ...section, products: [product] }],
      }),
      null,
    );
  assert.equal(
    parseHomepage({ ...projection(), sections: Array(17).fill(section) }),
    null,
  );
  assert.equal(
    parseHomepage({
      ...projection(),
      sections: [
        { ...section, cta: { label: "Go", destination: "//evil.test" } },
      ],
    }),
    null,
  );
});
test("public schedules and ended featured auctions use authoritative time without browser auth", () => {
  const now = Date.parse("2026-10-08T00:00:00Z"),
    endAt = new Date(now).toISOString();
  assert.equal(
    currentHomepage(
      {
        ...projection(),
        sections: [{ ...section, startAt: new Date(now + 1).toISOString() }],
      },
      now,
    )?.sections.length,
    0,
  );
  assert.equal(
    currentHomepage({ ...projection(), sections: [{ ...section, endAt }] }, now)
      ?.sections.length,
    0,
  );
  assert.equal(
    currentHomepage(
      {
        ...projection(),
        sections: [
          { ...section, products: [{ ...section.products[0], endAt }] },
        ],
      },
      now,
    )?.sections[0].products.length,
    0,
  );
  assert.equal(currentHomepage(null, now), null);
});
