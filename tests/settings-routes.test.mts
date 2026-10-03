import assert from "node:assert/strict";
import test from "node:test";
import { isSettingsUtilityPath } from "../src/lib/settings-routes.ts";

test("focused account routes hide marketplace chrome", () => {
  for (const path of ["/profile/settings", "/profile/settings/edit", "/profile/settings/privacy", "/profile/settings/security", "/profile/settings/help", "/profile/settings/safety", "/profile/locations", "/notification-preferences"]) assert.equal(isSettingsUtilityPath(path), true, path);
});

test("approved marketplace screens and public information keep their existing chrome", () => {
  for (const path of ["/", "/explore", "/profile", "/profile/listings", "/profile/transactions", "/sellers/demo", "/messages", "/messages/demo", "/updates", "/saved", "/listings/demo", "/sell", "/account-deletion", "/terms", "/privacy-policy", "/profile/settings-other", "/profile/locations-other"]) assert.equal(isSettingsUtilityPath(path), false, path);
});
