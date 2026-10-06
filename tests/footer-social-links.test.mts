import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { marketplaceOperator, marketplaceSocialLinks } from "../src/content/operator.ts";
import { isAuthPath } from "../src/lib/auth-routing.ts";
import { isSettingsUtilityPath } from "../src/lib/settings-routes.ts";
import { isPublicInformationPath } from "../src/lib/public-information.ts";

// Render the actual TSX with only Next's route hooks and legal availability stubbed.
// No browser, SDK, network, compiled output or third-party test package is required.
const runtimeRequire = createRequire(import.meta.url);
function loadTsx<T>(path: string, mocks: Record<string, unknown>): T {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2017, esModuleInterop: true,
  } });
  const compiledModule = { exports: {} };
  const require = (name: string) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "react/jsx-runtime") return runtimeRequire(name);
    throw new Error(`Unexpected component dependency: ${name}`);
  };
  new Function("require", "module", "exports", outputText)(require, compiledModule, compiledModule.exports);
  return compiledModule.exports as T;
}
const { FooterSocialLinks } = loadTsx<{ FooterSocialLinks: ComponentType<{ className?: string }> }>(
  "../src/components/layout/footer-social-links.tsx", { "@/content/operator": { marketplaceSocialLinks } },
);
const Link = (props: Record<string, unknown>) => createElement("a", props, props.children as ReactNode);
const Logo = () => createElement("a", { href: "/", "aria-label": "TAKEME home" }, "TAKEME");
let legalAvailable = true;
const information = loadTsx<{ PublicInformationFooter: ComponentType; PublicInformationLinks: ComponentType<{ className?: string }> }>(
  "../src/components/public-information/public-information.tsx", {
    "next/link": Link, "@/components/layout/logo": { Logo },
    "@/components/layout/footer-social-links": { FooterSocialLinks },
    "@/lib/public-information": { isLegalInformationAvailable: () => legalAvailable },
    "./public-information.module.css": { footer: "footer", footerInner: "footerInner", footerTop: "footerTop", footerBottom: "footerBottom", footerLinks: "footerLinks" },
  },
);
let pathname = "/help/tiers";
const { Footer } = loadTsx<{ Footer: ComponentType }>("../src/components/layout/footer.tsx", {
  "next/link": Link, "next/navigation": { usePathname: () => pathname },
  "@/lib/auth-routing": { isAuthPath }, "@/lib/settings-routes": { isSettingsUtilityPath },
  "@/lib/public-information": { isPublicInformationPath },
  "@/components/public-information/public-information": information,
  "./logo": { Logo }, "./footer-social-links": { FooterSocialLinks },
});
const render = (component: ComponentType) => renderToStaticMarkup(createElement(component));
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll("&amp;", "&"));

test("central public business configuration has exactly the two approved social URLs and labels", () => {
  assert.deepEqual(marketplaceSocialLinks, [
    { platform: "Facebook", href: "https://www.facebook.com/share/1DtJU64hm6/?mibextid=wwXIfr", label: "Follow TAKEME on Facebook" },
    { platform: "TikTok", href: "https://www.tiktok.com/@takeme.my?_r=1&_t=ZS-9AIhtj5yr4i", label: "Follow TAKEME on TikTok" },
  ]);
  assert.deepEqual(marketplaceOperator, { name: "TAKEME TECHNOLOGIES", registrationNumber: "KT0622373-U", supportEmail: "support.takeme@gmail.com", privacyLegalEmail: "support.takeme@gmail.com" });
});

test("social footer renders a heading and two labelled new-tab links with decorative brand icons", () => {
  const html = render(FooterSocialLinks);
  assert.match(html, /<h2[^>]*>Follow TAKEME<\/h2>/);
  assert.match(html, /<nav aria-label="TAKEME social media"/);
  const anchors = [...html.matchAll(/<a\b([^>]+)>(.*?)<\/a>/g)];
  assert.equal(anchors.length, 2, "No placeholder platforms");
  assert.deepEqual(hrefs(html), marketplaceSocialLinks.map(link => link.href));
  anchors.forEach(([ , attributes, children ], index) => {
    assert.ok(attributes.includes(`aria-label="${marketplaceSocialLinks[index].label}"`));
    assert.match(attributes, /target="_blank"/);
    assert.match(attributes, /rel="noopener noreferrer"/);
    assert.match(children, /<svg[^>]*aria-hidden="true"[^>]*focusable="false"/);
    assert.match(children, /<path d="[^"]+"/);
  });
  assert.equal(new Set([...html.matchAll(/<path d="([^"]+)"/g)].map(match => match[1])).size, 2);
});

test("both footer variants preserve existing navigation and copy when adding socials", () => {
  legalAvailable = true;
  const publicHtml = render(information.PublicInformationFooter);
  assert.deepEqual(hrefs(publicHtml), ["#public-content", "/help", "/contact", "/terms", "/privacy", "/account-deletion", ...marketplaceSocialLinks.map(link => link.href)]);
  assert.match(publicHtml, /TAKEME · Buy\. Sell\. Find\./);
  pathname = "/help/tiers";
  const html = render(Footer);
  assert.deepEqual(hrefs(html), ["/", "/explore", "/sell", "/profile", "/help/tiers", "/help", "/contact", "/terms", "/privacy", "/account-deletion", ...marketplaceSocialLinks.map(link => link.href)]);
  for (const copy of ["Same Stuff. A Brighter Tomorrow.", "Buy. Sell. Give. Reuse.", "Marketplace status", "payments are not processed by TAKEME yet."]) assert.ok(html.includes(copy));
});

test("socials do not bypass legal publication or change route-specific footer visibility", () => {
  legalAvailable = false;
  assert.deepEqual(hrefs(render(information.PublicInformationFooter)), ["#public-content", "/help", "/account-deletion", ...marketplaceSocialLinks.map(link => link.href)]);
  for (const path of ["/login", "/register", "/sell", "/messages", "/messages/synthetic", "/profile/settings", "/admin"]) {
    pathname = path; assert.equal(render(Footer), "", path);
  }
  pathname = "/explore";
  assert.match(render(Footer), /class="hidden lg:block /, "Existing mobile marketplace visibility is preserved");
  pathname = "/help";
  assert.match(render(Footer), /Follow TAKEME/);
  legalAvailable = true;
});
