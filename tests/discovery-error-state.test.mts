import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("discovery requires a server-confirmed, privacy-filtered public listing projection", () => {
  const service = readFileSync("src/lib/services/listings.ts", "utf8");
  const discovery = service.slice(service.indexOf("export async function getActiveListings"), service.indexOf("export async function getListing"));
  assert.match(discovery, /httpsCallable.*getPublicListingPage/);
  assert.doesNotMatch(discovery, /getDocs(?:FromServer)?\(query\(/);
});

test("Explore keeps loading, backend failure, and genuine empty results distinct", () => {
  const view = readFileSync("src/components/listings/explore-browser.tsx", "utf8");
  assert.match(view, /loading \? <div className="grid/);
  assert.match(view, /state\.error && <div role="alert"><ErrorState/);
  assert.match(view, /Retry listings/);
  assert.match(view, /!state\.error \? <EmptyState title=/);
});
