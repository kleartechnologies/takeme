const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  newContent,
  parseContent,
  bannerState,
  transitionBanner,
  placeBanner,
  malaysiaTimestamp,
} = require("../lib/editorial-domain");
const now = Date.parse("2026-10-08T00:00:00.000Z");
const banner = () => ({
  ...newContent("banners"),
  title: "Electronics Week",
  assetId: "desktop",
  alt: "Electronics artwork",
  mobileAssetId: "mobile",
  destination: "/explore?category=electronics",
  startAt: null,
  endAt: null,
});
test("paired artwork retains legacy banner compatibility without migration", () => {
  const old = {
    ...newContent("banners"),
    title: "Existing banner",
    assetId: "desktop",
  alt: "Electronics artwork",
  };
  assert.deepEqual(parseContent("banners", old), old);
  assert.deepEqual(parseContent("banners", banner()), banner());
  assert.throws(() =>
    parseContent("banners", { ...banner(), mobileAssetId: "../unsafe" }),
  );
  assert.throws(() => parseContent("banners", { ...banner(), unknown: true }));
});
test("banner schedule and lifecycle boundaries are authoritative", () => {
  const b = {
    ...banner(),
    startAt: malaysiaTimestamp("2026-10-09T09:00"),
    endAt: malaysiaTimestamp("2026-10-11T23:59"),
  };
  const scheduled = transitionBanner(b, "schedule", now);
  assert.equal(bannerState(scheduled, now), "SCHEDULED");
  assert.equal(bannerState(scheduled, Date.parse(b.startAt)), "LIVE");
  assert.equal(bannerState(scheduled, Date.parse(b.endAt)), "ENDED");
  assert.equal(
    bannerState(transitionBanner(scheduled, "pause", now), now),
    "INACTIVE",
  );
  assert.equal(
    bannerState(transitionBanner(scheduled, "activate", now), now),
    "LIVE",
  );
  assert.throws(() =>
    transitionBanner(
      { ...b, startAt: new Date(now - 1).toISOString() },
      "schedule",
      now,
    ),
  );
  assert.throws(() =>
    transitionBanner({ ...b, endAt: b.startAt }, "schedule", now),
  );
});
test("duplicate is inactive with no inherited schedule, and reactivation clears expired end", () => {
  const ended = {
    ...banner(),
    enabled: true,
    startAt: new Date(now - 2000).toISOString(),
    endAt: new Date(now - 1000).toISOString(),
  };
  const duplicate = transitionBanner(ended, "duplicate", now);
  assert.equal(duplicate.enabled, false);
  assert.equal(duplicate.startAt, null);
  assert.equal(duplicate.endAt, null);
  assert.equal(duplicate.mobileAssetId, ended.mobileAssetId);
  const active = transitionBanner(ended, "activate", now);
  assert.equal(active.endAt, null);
  assert.equal(bannerState(active, now), "LIVE");
  assert.throws(() => transitionBanner(ended, "unsafe", now));
});
test("one logical banner is placed once without mutating previous sections", () => {
  const home = newContent("homepage"),
    old = JSON.stringify(home),
    b = transitionBanner(banner(), "publish", now);
  const once = placeBanner(home, "week", b);
  const twice = placeBanner(once, "week", b);
  assert.equal(
    once.sections.filter((s) => s.bannerIds.includes("week")).length,
    1,
  );
  assert.deepEqual(twice, once);
  assert.equal(JSON.stringify(home), old);
  assert.deepEqual(placeBanner(home, "inactive", banner()), home);
  const collection = placeBanner(home, "week", {
    ...b,
    destination: "/#collection_weekend",
  });
  assert.equal(
    collection.sections.find((s) => s.sectionId === "collection_weekend")
      .collectionId,
    "weekend",
  );
  assert.equal(
    collection.sections.find((s) => s.bannerIds.includes("week")).bannerIds
      .length,
    1,
  );
  const full = {
    ...home,
    sections: Array.from({ length: 16 }, (_, i) => ({
      ...home.sections[0],
      sectionId: "s" + i,
      order: i,
    })),
  };
  assert.throws(() => placeBanner(full, "overflow", b), /full/);
});
