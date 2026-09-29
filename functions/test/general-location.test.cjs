const assert = require("node:assert/strict");
const test = require("node:test");
const { validatePublicLocation, displayPublicLocation, publishableLocation, isPublicListingSafe } = require("../lib/general-location.js");

const publicLocation = { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" };

test("server accepts only structured general Malaysian locations", () => {
  assert.equal(displayPublicLocation(validatePublicLocation(publicLocation)), "Jitra, Kedah");
  for (const bad of [
    { ...publicLocation, districtOrCity: "No 40 Jalan Halban 06000 Jitra" },
    { ...publicLocation, latitude: 6.27 },
    { ...publicLocation, country: "Unknown" },
    "No 40 Jalan Halban Taman Seri Halban 06000 Jitra Kedah",
  ]) assert.equal(validatePublicLocation(bad), null);
});

test("publish gate denies precise legacy fields even with a valid public area", () => {
  const safe = { publicLocation, location: "Jitra, Kedah", privacyVersion: 2 };
  assert.deepEqual(publishableLocation(safe), publicLocation);
  assert.equal(isPublicListingSafe(safe), true);
  for (const field of ["latitude", "longitude", "address", "fullAddress", "street", "unitNumber", "privateAddress", "exactAddress"]) {
    assert.equal(publishableLocation({ ...safe, [field]: "private" }), null);
    assert.equal(isPublicListingSafe({ ...safe, [field]: "private" }), false);
  }
  assert.equal(publishableLocation({ ...safe, location: "No 40 Jalan Halban" }), null);
  assert.equal(isPublicListingSafe({ ...safe, location: "No 40 Jalan Halban" }), false);
  assert.equal(isPublicListingSafe({ ...safe, privacyVersion: 1 }), false);
});
