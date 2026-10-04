"use client";
import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { messagingViewportHeight } from "@/lib/messaging-viewport";
import { MessagesInbox } from "./messages-inbox";
import styles from "./messaging.module.css";

export function MessagingShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user } = useAuth();
  const shell = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = shell.current;
    if (!element) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const measure = () => {
      const navigation = document.querySelector<HTMLElement>('nav[aria-label="Bottom navigation"]')?.getBoundingClientRect();
      const height = messagingViewportHeight({
        // Use the document top, so ordinary page scrolling cannot grow the shell.
        shellTop: element.getBoundingClientRect().top + window.scrollY,
        viewportHeight: viewport?.height ?? window.innerHeight,
        viewportOffsetTop: viewport?.offsetTop ?? 0,
        bottomNavigationTop: navigation && navigation.height > 0 ? navigation.top : undefined,
      });
      const value = `${height}px`;
      if (element.style.getPropertyValue("--messaging-available-height") !== value) element.style.setProperty("--messaging-available-height", value);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    // Body bounds change when the banner wraps, fonts settle or navigation mounts.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    for (const sibling of document.body.children) if (sibling !== element) observer.observe(sibling);
    window.addEventListener("resize", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
    };
  }, [path, user?.uid]);
  return <main ref={shell} key={user?.uid ?? "anonymous"} className={`${styles.shell} ${path === "/messages" ? styles.inboxRoute : styles.chatRoute}`}><aside className={styles.inboxPanel} aria-label="Your conversations"><MessagesInbox activeId={path.split("/")[2]} /></aside><div className={styles.chatPanel}>{children}</div></main>;
}
