const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  parseContent,
  newContent,
  effectiveState,
  malaysiaTimestamp,
  malaysiaInput,
} = require("../lib/editorial-domain");
const {
  parseHomepage,
  currentHomepage,
} = require("../lib/homepage-projection");
const {
  adminAssetDimensions,
  assetFits,
} = require("../lib/admin-assets-domain");
const campaign = () => ({ ...newContent("campaigns"), title: "Weekend deals" });
test("editorial schemas reject unknown fields, excessive references, unsafe destinations and client timestamps", () => {
  assert.equal(parseContent("campaigns", campaign()).lifecycleStatus, "DRAFT");
  for (const change of [
    { admin: true },
    { productIds: Array(13).fill("x") },
    { productIds: ["x", "x"] },
    { destination: "//evil.test" },
    { destination: "/\\evil.test" },
    { destination: "/x%2f%2fevil.test" },
    { startAt: "2026-10-09T12:00" },
    { priority: -1 },
  ])
    assert.throws(() =>
      parseContent("campaigns", { ...campaign(), ...change }),
    );
  assert.throws(() =>
    parseContent("homepage", {
      ...newContent("homepage"),
      sections: Array(17).fill({}),
    }),
  );
  assert.throws(() =>
    parseContent("homepage", {
      title: "Home",
      sections: [
        {
          ...newContent("homepage").sections[0],
          source: "CAMPAIGN",
          campaignId: null,
        },
      ],
    }),
  );
});
test("server schedules preserve records, derive scheduled/live/ended exactly at boundaries", () => {
  const c = {
    ...campaign(),
    lifecycleStatus: "SCHEDULED",
    startAt: "2026-10-10T00:00:00.000Z",
    endAt: "2026-10-11T00:00:00.000Z",
  };
  assert.equal(effectiveState(c, Date.parse(c.startAt) - 1), "SCHEDULED");
  assert.equal(effectiveState(c, Date.parse(c.startAt)), "LIVE");
  assert.equal(effectiveState(c, Date.parse(c.endAt)), "ENDED");
  assert.equal(
    effectiveState({ ...c, lifecycleStatus: "DRAFT" }, Date.parse(c.startAt)),
    "DRAFT",
  );
});
test("Malaysia scheduling is independent of operator browser timezone", () => {
  assert.equal(
    malaysiaTimestamp("2026-10-10T09:00"),
    "2026-10-10T01:00:00.000Z",
  );
  assert.equal(malaysiaInput("2026-10-10T01:00:00.000Z"), "2026-10-10T09:00");
  assert.throws(() => malaysiaTimestamp("2026-02-30T09:00"));
});
test("public projection fails closed on private fields and filters scheduled sections", () => {
  const s = {
    sectionId: "deals",
    type: "products",
    title: "Deals",
    source: "MANUAL",
    startAt: "2026-10-10T00:00:00.000Z",
    endAt: "2026-10-11T00:00:00.000Z",
    products: [],
    sellers: [],
    categories: [],
    banners: [],
    announcement: null,
  };
  const p = { schemaVersion: 1, version: 1, sections: [s], categories: [] };
  assert.ok(parseHomepage(p));
  assert.equal(
    currentHomepage(p, Date.parse(s.startAt) - 1).sections.length,
    0,
  );
  assert.equal(currentHomepage(p, Date.parse(s.startAt)).sections.length, 1);
  assert.equal(currentHomepage(p, Date.parse(s.endAt)).sections.length, 0);
  assert.equal(parseHomepage({ ...p, adminUid: "operator" }), null);
  assert.equal(
    parseHomepage({
      ...p,
      sections: [{ ...s, internalDescription: "private" }],
    }),
    null,
  );
  assert.equal(
    parseHomepage({
      ...p,
      sections: [
        {
          ...s,
          products: [
            {
              id: "x",
              title: "x",
              price: 1,
              imageUrl: "https://evil.test/image",
              sellerId: "y",
              endAt: null,
            },
          ],
        },
      ],
    }),
    null,
  );
});
function png(width, height) {
  const { deflateSync } = require("node:zlib");
  function crc(b) {
    let c = 0xffffffff;
    for (const v of b) {
      c ^= v;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(t, d) {
    const b = Buffer.alloc(d.length + 12);
    b.writeUInt32BE(d.length);
    b.write(t, 4);
    d.copy(b, 8);
    b.writeUInt32BE(crc(b.subarray(4, -4)), b.length - 4);
    return b;
  }
  const h = Buffer.alloc(13);
  h.writeUInt32BE(width);
  h.writeUInt32BE(height, 4);
  h[8] = 8;
  h[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", h),
    chunk("IDAT", deflateSync(Buffer.alloc((width * 3 + 1) * height))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
test("PNG chunk checksums, pixels, size, dimensions and placement ratios are bounded", () => {
  const b = png(1200, 400);
  assert.deepEqual(adminAssetDimensions(b), { width: 1200, height: 400 });
  assert.ok(assetFits("desktop_hero", 1200, 400));
  assert.equal(assetFits("mobile_hero", 1200, 400), false);
  assert.throws(() => adminAssetDimensions(Buffer.from("not a png")));
  assert.throws(() => adminAssetDimensions(b.subarray(0, 33)));
  const corrupt = Buffer.from(b);
  corrupt[40] ^= 1;
  assert.throws(() => adminAssetDimensions(corrupt));
  assert.throws(() => adminAssetDimensions(png(3000, 400)));
  assert.throws(() =>
    adminAssetDimensions(Buffer.concat([b, Buffer.alloc(1)])),
  );
});
