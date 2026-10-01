/** Native document-unload protection; React owns registration/cleanup per effect. */
export function registerUnsavedListingWarning(target: EventTarget, dirty: boolean, photoChanged: boolean, busy: boolean) {
  if ((!dirty && !photoChanged) || busy) return;
  const warn = (event: Event) => {
    event.preventDefault();
    (event as BeforeUnloadEvent).returnValue = "";
  };
  target.addEventListener("beforeunload", warn);
  return () => target.removeEventListener("beforeunload", warn);
}
