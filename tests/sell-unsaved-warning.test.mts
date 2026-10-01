import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { registerUnsavedListingWarning } from "../src/lib/unsaved-listing-warning.ts";

class WindowStub extends EventTarget {
  listeners = new Set<EventListenerOrEventListenerObject>();
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (type === "beforeunload" && listener) this.listeners.add(listener);
    super.addEventListener(type, listener);
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (type === "beforeunload" && listener) this.listeners.delete(listener);
    super.removeEventListener(type, listener);
  }
  unload() {
    const event = new Event("beforeunload", { cancelable: true });
    Object.defineProperty(event, "returnValue", { value: undefined, writable: true });
    this.dispatchEvent(event);
    return event as unknown as BeforeUnloadEvent;
  }
}

test("native warning is armed only for field/photo changes and requests browser confirmation", () => {
  for (const [dirty, photos, busy, expected] of [[false, false, false, false], [true, false, false, true], [false, true, false, true], [true, true, false, true], [true, true, true, false]]) {
    const target = new WindowStub();
    const cleanup = registerUnsavedListingWarning(target, dirty, photos, busy);
    const event = target.unload();
    assert.equal(event.defaultPrevented, expected);
    assert.equal(target.listeners.size, expected ? 1 : 0);
    if (expected) assert.equal(event.returnValue, "");
    cleanup?.();
    assert.equal(target.listeners.size, 0);
    assert.equal(target.unload().defaultPrevented, false);
  }
});

test("effect cleanup prevents duplicates, disarms on successful navigation/revert and rearms on failure", () => {
  const target = new WindowStub();
  let cleanup: ReturnType<typeof registerUnsavedListingWarning>;
  const renderEffect = (dirty: boolean, photos: boolean, busy: boolean) => {
    cleanup?.(); // React cleans the prior effect before dependencies change.
    cleanup = registerUnsavedListingWarning(target, dirty, photos, busy);
    assert.ok(target.listeners.size <= 1);
  };
  renderEffect(false, false, false);
  assert.equal(target.unload().defaultPrevented, false);
  renderEffect(true, true, false);
  renderEffect(true, true, false); // Strict-mode cleanup/remount.
  assert.equal(target.listeners.size, 1);
  renderEffect(true, true, true); // Save/publish navigates while busy.
  assert.equal(target.unload().defaultPrevented, false);
  renderEffect(true, true, false); // Failed save retains edits.
  assert.equal(target.unload().defaultPrevented, true);
  renderEffect(false, false, false); // Revert fields/remove newly-added photos.
  assert.equal(target.unload().defaultPrevented, false);
  renderEffect(true, false, false);
  cleanup?.(); // Unmount/discard the local form; unrelated navigation is clean.
  assert.equal(target.unload().defaultPrevented, false);
});

test("Sell wires the native effect to actual dirty/photo/busy state and all authoritative success paths navigate", () => {
  const source = readFileSync("src/components/forms/sell-form.tsx", "utf8");
  assert.match(source, /return registerUnsavedListingWarning\(window, isDirty, photoChanged, busy\)/);
  assert.match(source, /\[isDirty, photoChanged, busy\]/);
  assert.equal((source.match(/shouldValidate: true, shouldDirty: true/g) ?? []).length, 2);
  assert.match(source, /photos\.some\(\(photo, index\) => photo.file \|\| photo.url !== listing\?\.imageUrls\[index\]\)/);
  assert.match(source, /photos.length !== \(listing\?\.imageUrls.length \?\? 0\)/);
  const submit = source.slice(source.indexOf("async function submit"), source.indexOf("return (", source.indexOf("async function submit")));
  assert.equal((submit.match(/router.push\(/g) ?? []).length, 3);
  assert.equal((submit.match(/setBusy\(false\)/g) ?? []).length, 1);
  assert.match(submit, /catch \(error\)[\s\S]*setBusy\(false\)/);
  assert.doesNotMatch(source, /window\.confirm|role="dialog"/);
});
