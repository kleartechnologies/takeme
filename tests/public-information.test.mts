import assert from "node:assert/strict";
import test from "node:test";
import { canPreviewLegalDraft, isPublicInformationPath, legalDraft } from "../src/lib/public-information.ts";

test("unfinished policy/contact drafts are restricted to the authorised demo development environment", () => {
  assert.equal(canPreviewLegalDraft({ nodeEnv: "development", useEmulators: "true", projectId: "demo-takeme" }), true);
  for (const runtime of [
    { nodeEnv: "production", useEmulators: "true", projectId: "demo-takeme" },
    { nodeEnv: "test", useEmulators: "true", projectId: "demo-takeme" },
    { nodeEnv: "development", useEmulators: "false", projectId: "demo-takeme" },
    { nodeEnv: "development", useEmulators: "true", projectId: "other-project" },
    {},
  ]) assert.equal(canPreviewLegalDraft(runtime), false);
  assert.equal(legalDraft.publicationApproved, false);
});

test("public information chrome applies only to exact public routes", () => {
  for (const path of ["/privacy", "/privacy-policy", "/terms", "/help", "/help/prohibited-items", "/contact", "/account-deletion"]) assert.equal(isPublicInformationPath(path), true, path);
  for (const path of ["/", "/profile", "/profile/settings", "/profile/settings/privacy", "/explore", "/saved", "/messages", "/updates", "/help/tiers", "/contact-other", "/terms-other", "/account-deletion-other"]) assert.equal(isPublicInformationPath(path), false, path);
});
