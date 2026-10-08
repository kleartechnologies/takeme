import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const global = source("src/app/globals.css");

test("consumer composite inputs transfer keyboard focus to their actual shell", () => {
  assert.match(global, /\.control-shell:has\(:is\(input, select, textarea\):focus-visible\)/);
  assert.match(global, /\.input-shell:has\(input:focus-visible\)\s*\{ outline: 2px solid var\(--takeme-dark-green\)/);
  // Only field children surrender their outline; independently focusable shell
  // buttons must retain the global indicator, including in forced colors.
  assert.match(global, /\.control-shell :is\(input, select, textarea\):focus-visible/);
  assert.doesNotMatch(global, /\.control-shell[^{}]*button[^{}]*\{[^}]*outline:\s*none/);
  assert.match(global, /(?<![\w-]):focus-visible \{ outline: 2px solid var\(--takeme-dark-green\); outline-offset: 2px; \}/);
});

test("both Search routes and sorting opt into shell focus without duplicate rings", () => {
  const header = source("src/components/layout/header.tsx");
  const explore = source("src/components/listings/explore-browser.tsx");
  assert.match(header, /control-shell.*rounded-full/);
  assert.doesNotMatch(header, /focus-within:ring/);
  assert.match(header, /aria-label="Search TAKEME" className="icon-button shrink-0"/);
  assert.match(explore, /explore-search-field control-shell/);
  assert.match(explore, /explore-sort control-shell/);
});

test("offer and bid amount outlines have explicit visible wrapper replacements", () => {
  for (const [file, shell] of [
    ["src/components/messages/messaging.module.css", "sheetAmount"],
    ["src/components/listings/auction.module.css", "stepper"],
  ]) {
    const css = source(file);
    assert.match(css, new RegExp(`\\.${shell}:has\\(input:focus-visible\\) \\{ outline:\\s*2px solid var\\(--takeme-dark-green\\)`));
    assert.match(css, new RegExp(`\\.${shell} input:focus-visible \\{ outline:\\s*none; \\}`));
  }
});

test("clipped navigation rows and scrolling chips keep the outline inside their control", () => {
  assert.match(source("src/components/settings/settings.module.css"), /\.shell \.row:focus-visible \{ outline-offset: -3px; \}/);
  assert.match(source("src/components/updates/updates.module.css"), /\.filters button:focus-visible,\.row:focus-visible \{ outline-offset:-3px; \}/);
  assert.match(source("src/components/updates/updates.module.css"), /\.filters button\[aria-pressed=true\]:focus-visible \{ outline-color:#fff; \}/);
  assert.match(global, /\.explore-chips button:focus-visible \{ outline-offset: -3px; \}/);
  assert.match(source("src/components/saved/saved.module.css"), /\.tabs a:focus-visible \{ outline:2px.*outline-offset:-4px/);
});

test("auth and visually hidden photo inputs retain a high-contrast keyboard indicator", () => {
  const auth = source("src/components/auth/auth.module.css");
  assert.match(auth, /\.field input:focus-visible, \.field select:focus-visible \{ outline: 2px solid var\(--takeme-dark-green\)/);
  assert.match(auth, /\.check input:focus-visible \{ outline: 2px solid var\(--takeme-dark-green\)/);
  const sell = source("src/components/forms/sell.module.css");
  for (const selector of ["addPhoto", "replacePhoto"]) assert.match(sell, new RegExp(`\\.${selector}:has\\(input:focus-visible\\) \\{ outline:2px solid`));
  assert.doesNotMatch(sell, /\.(?:addPhoto|replacePhoto):focus-within/);
});

test("pointer/disabled control polish preserves geometry and legal social-link radii", () => {
  assert.doesNotMatch(global, /\.button-primary[^{}]*:hover[^}]*translateY/);
  for (const name of ["button-primary", "button-secondary", "icon-button"]) assert.ok(global.includes(`.${name}:not(:disabled):hover`));
  const legal = source("src/components/public-information/public-information.module.css");
  assert.doesNotMatch(legal, /focus-visible[^{}]*\{[^}]*border-radius/);
  assert.match(source("src/components/layout/footer-social-links.tsx"), /rounded-full/);
  // The dedicated Admin app imports its own stylesheet; consumer globals never
  // enter that app. This patch requires no Admin deployment or provider change.
  assert.doesNotMatch(source("apps/admin/src/app/layout.tsx"), /(?:\.\.\/|@\/)?.*src\/app\/globals\.css/);
});
