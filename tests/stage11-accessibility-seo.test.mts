import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("saved-search deletion uses the shared named dialog and explicit guarded confirmation", () => {
  const saved = source("src/components/engagement/saved-searches-view.tsx");
  assert.doesNotMatch(saved, /window\.confirm|\bconfirm\(/);
  assert.match(saved, /onClick=\{\(\) => setPendingDelete\(item\)\}/);
  assert.match(saved, /ActionSheet title="Delete saved search\?" description=/);
  assert.match(saved, /onClick=\{\(\) => setPendingDelete\(null\)\}[^>]*>Cancel/);
  assert.match(saved, /onClick=\{\(\) => void remove\(pendingDelete\)\}/);
  assert.match(saved, /if \(deleting\.current\) return/);
  assert.match(saved, /current\.filter\(\(entry\) => entry\.id !== item\.id\)/);
  assert.match(saved, /busy=\{busy === pendingDelete.id\}/);
});

test("private route trees explicitly discourage indexing, including nested account/admin pages", () => {
  for (const route of ["admin", "profile", "messages", "transactions", "saved-searches", "notification-preferences", "sell", "listings/[id]/edit", "listings/[id]/promote"]) {
    assert.match(source(`src/app/${route}/layout.tsx`), /robots: \{ index: false, follow: false \}/);
  }
});

test("small auth control and auction badge retain accessible target/contrast treatment", () => {
  assert.match(source("src/components/auth/auth-form.tsx"), /grid size-11 place-items-center/);
  assert.match(source("src/components/listings/listing-card.tsx"), /bg-orange-700 text-white/);
  assert.match(source("src/components/forms/sell-form.tsx"), /aria-label="Meet-up location \(optional\)"/);
  assert.match(source("src/app/globals.css"), /\.form-field > select:focus-visible, \.form-field > textarea:focus-visible \{ outline: 3px solid var\(--takeme-dark-green\)/);
  assert.match(source("src/components/listings/listing-detail-view.tsx"), /text-xs font-semibold text-\[var\(--takeme-gray\)\]">\{label\}/);
});

test("configured text/button color pairs meet normal-text contrast", () => {
  const css = source("src/app/globals.css");
  const auction = source("src/components/listings/auction-panel.tsx");
  assert.match(auction, /bg-red-50 p-4 text-red-800/, "Auction countdown retains high-contrast state styling");
  const token = (name: string) => css.match(new RegExp(`--takeme-${name}: #(\\w{6})`))![1];
  const luminance = (hex: string) => {
    const rgb = hex.match(/../g)!.map((part) => parseInt(part, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  for (const [foreground, background] of [[token("gray"), "ffffff"], [token("gray"), token("light-green")], [token("charcoal"), token("green")], ["ffffff", token("dark-green")], [token("dark-green"), token("light-green")], ["ffffff", "c2410c"], ["991b1b", "fef2f2"]]) {
    const a = luminance(foreground), b = luminance(background);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `${foreground}/${background}`);
  }
  for (const background of [token("charcoal"), token("dark-green")]) {
    const blended = background.match(/../g)!.map((part) => Math.round(255 * 0.8 + parseInt(part, 16) * 0.2).toString(16).padStart(2, "0")).join("");
    assert.ok((luminance(blended) + 0.05) / (luminance(background) + 0.05) >= 4.5, `gradient helper text/${background}`);
  }
});

test("consumer ID links and action-sheet accessibility contracts are retained", () => {
  assert.match(source("src/components/profile/profile-view.tsx"), /href=\{`\/listings\/\$\{listing.id\}\/edit`\}/);
  assert.match(source("src/components/profile/profile-view.tsx"), /Resume draft/);
  assert.match(source("src/components/profile/profile-view.tsx"), /mt-1 flex min-h-11 items-center truncate font-semibold/);
  assert.match(source("src/components/profile/profile-view.tsx"), /aria-label=\{`View \$\{listing.title\}`\}/);
  const sheet = source("src/components/ui/action-sheet.tsx");
  for (const marker of ["aria-modal=\"true\"", "aria-busy={busy}", "event.key === \"Escape\"", "event.key !== \"Tab\"", "previous?.focus()", "document.removeEventListener"]) assert.ok(sheet.includes(marker));
  const bid = source("src/components/listings/auction-panel.tsx");
  assert.match(bid, /status === "ended" \|\| status === "cancelled"\s*\? "No bids were placed\."/);
  for (const marker of ["isHighestBidder", "isOutbid", "isWinner", "Ending soon", "disabled={busy", "finally { setBusy(false); }", "role=\"alert\""]) assert.ok(bid.includes(marker));
  const offer = source("src/components/transactions/listing-deal-panel.tsx");
  for (const marker of ["disabled={busy}", "finally { setBusy(false); }", "role=\"alert\"", "No payment was taken"]) assert.ok(offer.includes(marker));
});

test("literal consumer links resolve to application routes", () => {
  function walk(dir: URL): URL[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? entry.name === "admin" ? [] : walk(new URL(`${entry.name}/`, dir)) : entry.name.endsWith(".tsx") ? [new URL(entry.name, dir)] : []);
  }
  const paths = new Set<string>();
  for (const file of walk(new URL("../src/components/", import.meta.url))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/href="([^"]+)"/g)) {
      if (match[1].startsWith("#")) {
        assert.ok(text.includes(`id="${match[1].slice(1)}"`), `${file}: unresolved anchor ${match[1]}`);
        continue;
      }
      assert.ok(match[1].startsWith("/"), `${file}: unexpected external literal href ${match[1]}`);
      const route = match[1].split(/[?#]/)[0];
      paths.add(route);
      assert.ok(existsSync(new URL(`../src/app${route === "/" ? "" : route}/page.tsx`, import.meta.url)), `${file}: unresolved ${route}`);
    }
  }
  for (const path of ["/", "/explore", "/saved", "/saved-searches", "/updates", "/messages", "/profile", "/sell", "/profile/locations", "/notification-preferences"]) assert.ok(paths.has(path), path);
});
