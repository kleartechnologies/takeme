"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  getIdTokenResult,
  onIdTokenChanged,
  signOut,
  type User,
} from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { auth, configured } from "@admin/lib/firebase";
interface Session {
  user: User | null;
  state: "loading" | "signed-out" | "denied" | "allowed" | "unavailable";
}
const Context = createContext<Session>({ user: null, state: "loading" });
export const useAdminSession = () => useContext(Context);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({
    user: null,
    state: configured ? "loading" : "unavailable",
  });
  useEffect(() => {
    if (!auth) return;
    let generation = 0;
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      const request = ++generation;
      if (!user) void fetch("/api/session", { method: "DELETE" });
      setSession({ user, state: user ? "loading" : "signed-out" });
      if (user)
        void getIdTokenResult(user)
          .then(async (token) => {
            if (token.claims.admin !== true) return false;
            const response = await fetch("/api/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: await user.getIdToken() }),
            });
            return response.ok;
          })
          .then((allowed) => {
            if (request === generation && auth?.currentUser?.uid === user.uid)
              setSession({ user, state: allowed ? "allowed" : "denied" });
          })
          .catch(() => {
            if (request === generation) setSession({ user, state: "denied" });
          });
    });
    return () => {
      generation++;
      unsubscribe();
    };
  }, []);
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
const groups = [
  { title: "", links: [["/", "Overview"]] },
  {
    title: "Content",
    links: [
      ["/content/homepage/current", "Homepage"],
      ["/content/banners", "Banners"],
      ["/content/campaigns", "Campaigns"],
      ["/content/collections", "Collections"],
      ["/content/announcements", "Announcements"],
    ],
  },
  {
    title: "Marketplace",
    links: [
      ["/marketplace/listings", "Listings"],
      ["/content/categories/current", "Categories"],
      ["/marketplace/auctions", "Auctions"],
      ["/marketplace/sellers", "Sellers"],
      ["/marketplace/users", "Users"],
    ],
  },
  { title: "Moderation", links: [["/marketplace/reports", "Reports"]] },
  { title: "", links: [["/settings", "Settings"]] },
];
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, state } = useAdminSession(),
    router = useRouter(),
    path = usePathname();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (state === "signed-out") router.replace("/login");
  }, [state, router]);
  if (state === "loading" || state === "signed-out")
    return (
      <main className="access" role="status">
        Checking administrator access…
      </main>
    );
  if (state !== "allowed")
    return (
      <main className="access">
        <h1>
          {configured
            ? "Administrator access required"
            : "Admin environment unavailable"}
        </h1>
        <p role="alert">
          {configured
            ? "This account cannot load control-room data. Contact the TAKEME owner."
            : "Configure the pinned Firebase environment before using this app."}
        </p>
        {auth && <button onClick={() => void signOut(auth!)}>Sign out</button>}
        <Link href="/login">Back to admin login</Link>
      </main>
    );
  return (
    <div className="room">
      <aside className={expanded ? "navigation expanded" : "navigation"}>
        <Link className="brand" href="/">
          TAKEME <span>CONTROL ROOM</span>
        </Link>
        <nav aria-label="Admin navigation">
          {groups.map((group, index) => (
            <div key={index}>
              {group.title && <p className="nav-group">{group.title}</p>}
              {group.links.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setExpanded(false)}
                  aria-current={
                    path === href ||
                    (href !== "/" && path.startsWith(href + "/"))
                      ? "page"
                      : undefined
                  }
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="menu"
            aria-label="Toggle navigation"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            ☰
          </button>
          <span>Marketplace operations</span>
          <span className="operator">
            Admin verified · {user?.uid.slice(0, 8)}
          </span>
          <button onClick={() => void signOut(auth!)}>Sign out</button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
