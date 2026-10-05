"use client";

import { Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PROTECTED_WRITE_MAINTENANCE_EVENT, PROTECTED_WRITE_MAINTENANCE_MESSAGE } from "@/lib/protected-write-maintenance";
import styles from "./protected-write-notice.module.css";

/** Nonmodal feedback preserves the current screen, form and keyboard context. */
export function ProtectedWriteNotice() {
  const [visible, setVisible] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const show = () => {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setVisible(true);
    };
    window.addEventListener(PROTECTED_WRITE_MAINTENANCE_EVENT, show);
    return () => window.removeEventListener(PROTECTED_WRITE_MAINTENANCE_EVENT, show);
  }, []);
  function dismiss() {
    setVisible(false);
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
  }
  if (!visible) return null;
  return <aside className={styles.notice} aria-label="Marketplace system update">
    <Info size={21} aria-hidden="true" className={styles.icon} />
    <div className={styles.content}><div role="status" aria-live="polite" aria-atomic="true"><strong>Short system update</strong><p>{PROTECTED_WRITE_MAINTENANCE_MESSAGE}</p></div><button type="button" className={styles.browse} onClick={dismiss}>Continue browsing</button></div>
    <button type="button" className="icon-button shrink-0" aria-label="Dismiss system update notice" onClick={dismiss}><X size={19} /></button>
  </aside>;
}
