import test from "node:test";
import ts from "typescript";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const read = (p: string) =>
  readFileSync(new URL("../" + p, import.meta.url), "utf8");
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : /\.(ts|tsx)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}
test("dedicated admin source imports only its own application and pure editorial contracts", () => {
  for (const file of sources(
    fileURLToPath(new URL("../apps/admin/src", import.meta.url)),
  )) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(
      text,
      /from ["']@\/|UnreadCountProvider|AccountSetupGuard|BottomNav|PublicFeedProvider/,
    );
    for (const match of text.matchAll(/from ["'](@contracts\/[^"']+)/g))
      assert.ok(
        [
          "@contracts/editorial-domain",
          "@contracts/homepage-projection",
        ].includes(match[1]),
      );
  }
  assert.match(read("apps/admin/package.json"), /"build": "next build"/);
  assert.match(
    read("apps/admin/src/app/(room)/layout.tsx"),
    /await readAdminSession\(\)/,
  );
  assert.match(read("apps/admin/src/lib/server-session.ts"), /getAdminSession/);
  assert.match(
    read("apps/admin/src/app/api/session/route.ts"),
    /httpOnly: true/,
  );
  assert.match(
    read("apps/admin/src/app/api/session/route.ts"),
    /sameSite: "strict"/,
  );
});
test("future admin Worker has no domain, public preview or consumer bindings", () => {
  const parsed = ts.parseConfigFileTextToJson("wrangler.jsonc", read("apps/admin/wrangler.jsonc"));
  assert.equal(parsed.error, undefined);
  const w = parsed.config;
  assert.equal(w.name, "takeme-admin");
  assert.equal(w.workers_dev, false);
  assert.equal(w.preview_urls, false);
  assert.equal(w.routes, undefined);
  assert.equal(w.observability.logs.enabled, true);
  assert.equal(w.observability.redact_query_string, true);
  assert.equal(w.observability.traces.enabled, false);
  assert.deepEqual(w.services, [
    { binding: "WORKER_SELF_REFERENCE", service: "takeme-admin" },
  ]);
});
