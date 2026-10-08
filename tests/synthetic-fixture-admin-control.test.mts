import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const req = createRequire(import.meta.url);
const source = readFileSync(new URL("../apps/admin/src/app/(room)/operations/synthetic-fixture-cleanup/page.tsx", import.meta.url), "utf8");
function harness(state = "allowed") {
  const values: unknown[] = [false, false, "", ""], ref = { current: false };
  let position = 0;
  const calls: unknown[] = [];
  let respond: () => Promise<unknown> = async () => ({ listingId: "6dV9mQnbYPa51UKXOTOu", status: "removed", mediaComplete: true, historicalReferencesPreserved: true, alreadyRemoved: false });
  const m = { exports: {} as { default: () => unknown } };
  const mocks: Record<string, unknown> = {
    react: { useState: () => { const i = position++; return [values[i], (value: unknown) => { values[i] = value; }]; }, useRef: () => ref },
    "@admin/components/session": { useAdminSession: () => ({ state }) },
    "@admin/lib/firebase": { call: async (...args: unknown[]) => { calls.push(args); return respond(); } },
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2017 } }).outputText;
  new Function("require", "module", "exports", code)((name: string) => mocks[name] ?? req(name), m, m.exports);
  function render() {
    position = 0;
    const elements: Array<{ type: string; props: Record<string, unknown> }> = [];
    function walk(value: unknown) {
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (value && typeof value === "object" && "props" in value) {
        const element = value as { type: string; props: Record<string, unknown> }; elements.push(element); walk(element.props.children);
      }
    }
    walk(m.exports.default()); return elements;
  }
  return { render, values, ref, calls, setResponse(fn: () => Promise<unknown>) { respond = fn; } };
}
const button = (h: ReturnType<typeof harness>) => h.render().find(e => e.type === "button")!;
const click = (h: ReturnType<typeof harness>) => (button(h).props.onClick as () => void)();
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
test("direct internal route inherits Admin gates and has no generic navigation or arbitrary ID input", () => {
  const layout = readFileSync(new URL("../apps/admin/src/app/(room)/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /await readAdminSession\(\)/); assert.match(layout, /<AdminGate>/);
  assert.doesNotMatch(readFileSync(new URL("../apps/admin/src/components/session.tsx", import.meta.url), "utf8"), /synthetic-fixture-cleanup/);
  const h = harness(); assert.equal(h.render().filter(e => e.type === "input").length, 1);
  assert.equal(h.render().find(e => e.type === "input")?.props.type, "checkbox"); assert.equal(h.calls.length, 0);
});
test("signed-out/denied/loading sessions and unconfirmed fixture cannot invoke cleanup", () => {
  for (const state of ["signed-out", "denied", "loading", "allowed"]) {
    const h = harness(state); if (state !== "allowed") h.values[0] = true;
    assert.equal(button(h).props.disabled, true); click(h); assert.equal(h.calls.length, 0);
  }
});
test("confirmed action sends only the fixed approved ID and suppresses simultaneous submissions", async () => {
  const h = harness(); h.values[0] = true;
  let release!: (value: unknown) => void;
  h.setResponse(() => new Promise(resolve => { release = resolve; }));
  click(h); click(h); assert.deepEqual(h.calls, [["cleanupApprovedSyntheticFixture", { listingId: "6dV9mQnbYPa51UKXOTOu" }]]);
  assert.equal(button(h).props.disabled, true);
  release({ listingId: "6dV9mQnbYPa51UKXOTOu", status: "removed", mediaComplete: true, historicalReferencesPreserved: true, alreadyRemoved: false });
  await settle(); assert.match(String(h.values[2]), /Cleanup complete/); assert.equal(h.ref.current, false);
});
test("retry reports already-clean state and failed/incomplete result stays an explicit error", async () => {
  const h = harness(); h.values[0] = true;
  h.setResponse(async () => ({ listingId: "6dV9mQnbYPa51UKXOTOu", status: "removed", mediaComplete: true, historicalReferencesPreserved: true, alreadyRemoved: true }));
  click(h); await settle(); assert.match(String(h.values[2]), /Already clean/);
  for (const result of [{ listingId: "other", status: "removed", mediaComplete: true }, { listingId: "6dV9mQnbYPa51UKXOTOu", status: "removed", mediaComplete: false }]) {
    h.setResponse(async () => result); click(h); await settle(); assert.equal(h.values[2], ""); assert.match(String(h.values[3]), /Stop and review/);
  }
  h.setResponse(async () => { throw new Error("No current authority"); }); click(h); await settle(); assert.equal(h.ref.current, false); assert.match(String(h.values[3]), /Stop and review/);
});
