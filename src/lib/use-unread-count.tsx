"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { getUnreadCount } from "@/lib/services/engagement";

const UnreadCountContext = createContext(0);

export function UnreadCountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [summary, setSummary] = useState({ uid: "", count: 0 });
  useEffect(() => {
    if (!user || pathname.startsWith("/admin")) return;
    let active = true;
    const refresh = () => { getUnreadCount().then((data) => { if (active) setSummary({ uid: user.uid, count: data.unreadCount }); }).catch(() => {}); };
    refresh();
    const visibility = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("takeme:notifications-changed", refresh);
    return () => { active = false; document.removeEventListener("visibilitychange", visibility); window.removeEventListener("takeme:notifications-changed", refresh); };
  }, [user, pathname]);
  return <UnreadCountContext.Provider value={user && summary.uid === user.uid && !pathname.startsWith("/admin") ? summary.count : 0}>{children}</UnreadCountContext.Provider>;
}

export function useUnreadCount() { return useContext(UnreadCountContext); }
