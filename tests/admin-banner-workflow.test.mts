import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as contract from "../functions/src/editorial-domain.ts";
const source = readFileSync(
  new URL("../apps/admin/src/lib/banner-workflow.ts", import.meta.url),
  "utf8",
);
const compiledModule = { exports: {} as Record<string, unknown> };
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
new Function("require", "module", "exports", output)(
  (name: string) => {
    assert.equal(name, "@contracts/editorial-domain");
    return contract;
  },
  compiledModule,
  compiledModule.exports,
);
const workflow = compiledModule.exports as {
  categoryDestination: (id: string) => string;
  destinationType: (v: string) => string;
  customDestination: (v: string) => string;
  readyBanner: (b: contract.Banner, p: boolean) => contract.Banner;
  CATEGORY_LABELS: Record<string, string>;
  scheduleLabel: (s: string, e: string) => string;
};
test("friendly categories use the existing marketplace taxonomy exactly", () => {
  assert.deepEqual(
    Object.keys(workflow.CATEGORY_LABELS).sort(),
    [...contract.CATEGORY_IDS].sort(),
  );
  for (const id of contract.CATEGORY_IDS)
    assert.equal(workflow.categoryDestination(id), `/explore?category=${id}`);
  assert.throws(() => workflow.categoryDestination("invented"));
});
test("all six destinations are recognized and unsafe custom links are refused", () => {
  for (const [path, type] of [
    ["/explore?category=electronics", "Category"],
    ["/listings/example", "Product"],
    ["/sellers/example", "Seller"],
    ["/#collection_example", "Collection"],
    ["/explore", "Explore"],
    ["/help", "Custom link"],
  ])
    assert.equal(workflow.destinationType(path), type);
  assert.equal(
    workflow.customDestination("https://takeme.my/explore?sort=newest"),
    "/explore?sort=newest",
  );
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,x",
    "//evil.test",
    "https://evil.test",
    "https://takeme.my.evil.test/",
    "/explore%2f%2fevil",
    "/admin",
    "/\\evil",
  ])
    assert.throws(() => workflow.customDestination(value));
});
test("paired publication requires both artworks and a chosen destination", () => {
  const banner = {
    ...(contract.newContent("banners") as contract.Banner),
    title: "Electronics",
    assetId: "desktop",
    mobileAssetId: "mobile",
    destination: "/explore",
  };
  assert.equal(workflow.readyBanner(banner, true).alt, "Electronics");
  assert.throws(
    () => workflow.readyBanner({ ...banner, mobileAssetId: null }, true),
    /both/,
  );
  assert.throws(
    () => workflow.readyBanner({ ...banner, destination: "" }, true),
    /destination/,
  );
  assert.equal(
    workflow.readyBanner({ ...banner, mobileAssetId: null }, false).assetId,
    "desktop",
  );
  assert.ok(
    workflow
      .scheduleLabel("2026-10-09T01:00:00.000Z", "2026-10-11T15:59:00.000Z")
      .includes("9:00"),
  );
});

// Render the actual public component to check schedule/pause empty slots, not a copy of its logic.
test("public Home hides empty manual banner slots while preserving automatic content and collection anchors", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createRequire } = await import("node:module");
  const requireRuntime = createRequire(import.meta.url);
  const text = readFileSync(new URL("../src/components/home/published-home.tsx", import.meta.url), "utf8");
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} as { PublishedHome?: import("react").ComponentType<Record<string, unknown>> } };
  const empty = () => createElement("div", null, "automatic-content");
  new Function("require", "module", "exports", js)((name: string) => {
    if (name === "react/jsx-runtime") return requireRuntime(name);
    if (name === "next/link") return (props: Record<string, unknown>) => createElement("a", props, props.children as import("react").ReactNode);
    if (name === "@/data/categories") return { getCategoryName: (id: string) => id };
    return new Proxy({}, { get: () => empty });
  }, loaded, loaded.exports);
  const Component = loaded.exports.PublishedHome!;
  const base = { sectionId: "empty-hero", type: "hero", source: "MANUAL", title: "Paused banner", banners: [], products: [], sellers: [], categories: [], cta: null, announcement: null };
  const html = renderToStaticMarkup(createElement(Component, { page: null, homepage: { categories: [], sections: [base, { ...base, sectionId: "fresh", type: "fresh", source: "AUTOMATIC" }, { ...base, sectionId: "collection_safe", type: "products", title: "Picks", products: [{ id: "p", title: "Product", price: 2 }] }] } }));
  assert.doesNotMatch(html, /Paused banner/);
  assert.match(html, /automatic-content/);
  assert.match(html, /id="collection_safe"/);
  assert.match(html, /TAKEME marketplace/);
});
