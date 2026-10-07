interface SellHistoryState { scope: string; step: number }
interface HistorySurface {
  history: Pick<History, "state" | "pushState" | "replaceState" | "go">;
  location: Pick<Location, "href">;
  addEventListener(type: "popstate", listener: (event: PopStateEvent) => void): void;
  removeEventListener(type: "popstate", listener: (event: PopStateEvent) => void): void;
}
const KEY = "takemeSellStage";
/** Same-URL history preserves the Next router's state; no form data enters browser history. */
export function installSellHistory(target: HistorySurface, scope: string, initialStep: number,
  onStep: (step: number) => void, onExit: () => void, blocked: () => boolean) {
  const read = (): SellHistoryState | null => {
    const value = target.history.state?.[KEY];
    return value?.scope === scope && Number.isInteger(value.step) && value.step >= -1 && value.step <= 3 ? value : null;
  };
  const write = (step: number, replace = false) => target.history[replace ? "replaceState" : "pushState"](
    { ...target.history.state, [KEY]: { scope, step } }, "", target.location.href);
  let stage = initialStep;
  if (read()?.step === initialStep) stage = initialStep;
  else {
    write(-1, true);
    for (let step = 0; step <= initialStep; step++) write(step);
  }
  onStep(stage);
  const listener = () => {
    const state = read();
    if (!state) return;
    if (blocked()) { if (stage !== state.step) target.history.go(stage - state.step); return; }
    if (state.step === -1) { write(0); stage = 0; onStep(0); onExit(); return; }
    stage = state.step; onStep(stage);
  };
  target.addEventListener("popstate", listener);
  return {
    go(next: number) {
      if (blocked() || next === stage || next < 0 || next > 3) return;
      if (next < stage) target.history.go(next - stage);
      else { for (let step = stage + 1; step <= next; step++) write(step); stage = next; onStep(stage); }
    },
    cleanup() { target.removeEventListener("popstate", listener); },
  };
}
