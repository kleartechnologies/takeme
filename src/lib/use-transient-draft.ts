"use client";
import { useEffect, useRef, useState } from "react";
import { clearRecovery, readRecovery, saveRecovery, type RecoveryDraft } from "./transient-recovery";

/** Restores presentation only. No callable, upload or replay lives in this hook. */
export function useTransientDraft(scope: string, owner: string | null, draft: RecoveryDraft | null,
  onRestore: (value: RecoveryDraft) => void, enabled = true) {
  const callback = useRef(onRestore);
  const [ready, setReady] = useState("");
  const identity = `${owner ?? "guest"}:${scope}`;
  useEffect(() => { callback.current = onRestore; }, [onRestore]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const saved = readRecovery(scope, owner);
      if (saved) callback.current(saved);
      setReady(identity);
    });
    return () => { active = false; };
  }, [enabled, identity, scope, owner]);
  useEffect(() => {
    if (!enabled || ready !== identity) return;
    if (draft) saveRecovery(scope, owner, draft);
    else clearRecovery(scope);
  }, [enabled, ready, identity, scope, owner, draft]);
  return enabled && ready === identity;
}
