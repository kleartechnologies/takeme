import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatPublicLocation, makePublicLocation, parseLegacyGeneralLocation, parsePublicLocation } from "../src/lib/general-location.ts";

test("general location is structured and renders only district/city and state", () => {
  const location = makePublicLocation("  Jitra ", "Kedah");
  assert.deepEqual(location, { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" });
  assert.equal(formatPublicLocation(location!), "Jitra, Kedah");
  assert.deepEqual(parseLegacyGeneralLocation("Jitra, Kedah"), location);
});

test("street address, postcode, coordinates and extra fields cannot become public location", () => {
  for (const city of ["No 40 Jalan Halban 06000 Jitra", "Taman Seri Halban", "6.2134, 100.4234", "Unit 3", ""]) {
    assert.equal(makePublicLocation(city, "Kedah"), null);
  }
  assert.equal(parseLegacyGeneralLocation("No 40 Jalan Halban Taman Seri Halban 06000 Jitra Kedah"), null);
  assert.equal(parsePublicLocation({ districtOrCity: "Jitra", state: "Kedah", country: "Malaysia", address: "private" }), null);
});

test("meet-up settings explain that removal does not alter existing listing snapshots", () => {
  const source = readFileSync(new URL("../src/components/profile/locations-settings.tsx", import.meta.url), "utf8");
  assert.match(source, /Removing a saved place won’t change existing listings that use it/);
  assert.match(source, /Edit those listings separately/);
});
