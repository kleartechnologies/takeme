"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

/** Shared, keyboard-accessible presentation for existing marketplace actions. */
export function ActionSheet({ title, description, children, onClose, busy = false, fallbackFocus }: { title: string; description?: string; children: React.ReactNode; onClose: () => void; busy?: boolean; fallbackFocus?: () => HTMLElement | null }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialog = useRef<HTMLElement>(null);
  const closeState = useRef({ busy, onClose, fallbackFocus });
  useEffect(() => { closeState.current = { busy, onClose, fallbackFocus }; }, [busy, onClose, fallbackFocus]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled])")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !closeState.current.busy) { event.preventDefault(); closeState.current.onClose(); }
      if (event.key !== "Tab") return;
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? [])].filter((element) => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); dialog.current?.focus(); }
      // A pending submit can temporarily disable the focused button, leaving
      // focus on the document. Keep the next keyboard step within this modal.
      else if (!dialog.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previous?.isConnected) previous?.focus();
      else closeState.current.fallbackFocus?.()?.focus();
    };
  }, []);
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--takeme-charcoal)]/50 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={busy} tabIndex={-1} className="action-sheet w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[var(--takeme-shadow-md)] sm:rounded-[2rem] sm:p-7">
      <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />
      <div className="flex items-start justify-between gap-3"><h2 id={titleId} className="pt-2 text-xl font-bold tracking-tight">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close dialog" className="icon-button shrink-0"><X size={21} /></button></div>
      {description && <p id={descriptionId} className="mt-1 text-sm leading-6 text-[var(--takeme-gray)]">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  </div>;
}
