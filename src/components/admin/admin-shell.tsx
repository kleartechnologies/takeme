"use client";

import { getIdTokenResult } from "firebase/auth";
import { BarChart3, ClipboardList, LayoutDashboard, ListFilter, Megaphone, MessageSquareWarning, Settings2, ShieldCheck, Sparkles, Star, UsersRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: UsersRound },
  { href: "/admin/listings", label: "Listings", icon: ListFilter },
  { href: "/admin/transactions", label: "Transactions", icon: ClipboardList },
  { href: "/admin/revenue", label: "GMV", icon: WalletCards },
  { href: "/admin/intelligence", label: "Intelligence", icon: Sparkles },
  { href: "/admin/engagement", label: "Engagement", icon: BarChart3 },
  { href: "/admin/promotions", label: "Promotions", icon: Megaphone },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/reports", label: "Reports", icon: MessageSquareWarning },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (loading || !configured) return;
    if (!user) { router.replace(`/login?next=${encodeURIComponent(pathname)}`); return; }
    let active = true;
    getIdTokenResult(user, true).then((token) => { if (active) setAllowed(token.claims.admin === true); }).catch(() => { if (active) setAllowed(false); });
    return () => { active = false; };
  }, [user, loading, configured, pathname, router]);
  if (!configured) return <main className="mx-auto max-w-xl p-6"><h1 className="text-xl font-bold">Admin unavailable</h1><p className="mt-2 text-sm">Firebase is not configured for this environment.</p></main>;
  if (loading || !user || allowed === null) return <main className="grid min-h-screen place-items-center bg-[var(--takeme-off-white)]"><p className="text-sm text-[var(--takeme-gray)]">Checking administrator access…</p></main>;
  if (!allowed) return <main className="grid min-h-screen place-items-center bg-[var(--takeme-off-white)] p-5"><div className="max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm"><ShieldCheck className="mx-auto text-[var(--takeme-dark-green)]" size={36} /><h1 className="mt-4 text-2xl font-bold">Administrator access required</h1><p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">This account does not have the Firebase administrator claim. No dashboard data was loaded.</p><Link href="/" className="button-secondary mt-5 min-h-11 px-5">Back to marketplace</Link></div></main>;
  return <div className="min-h-screen bg-[#f5f7f6] lg:flex">
    <aside className="hidden w-62 shrink-0 bg-[#19352a] text-white lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto"><Link href="/admin" className="flex min-h-20 items-center gap-3 px-6 text-lg font-extrabold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[var(--takeme-green)] text-[#19352a]"><BarChart3 size={20} /></span>TAKEME <span className="text-xs font-semibold text-green-200">ADMIN</span></Link><nav className="space-y-1 px-3 pb-6" aria-label="Admin sections">{links.map(({ href, label, icon: Icon }) => { const active = pathname === href || href !== "/admin" && pathname.startsWith(`${href}/`); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold ${active ? "bg-[var(--takeme-green)] text-[#19352a]" : "text-green-50 hover:bg-white/10"}`}><Icon size={18} />{label}</Link>; })}<Link href="/" className="mt-6 flex min-h-11 items-center rounded-xl px-4 text-sm text-green-100 underline">← Marketplace</Link></nav></aside>
    <div className="min-w-0 flex-1"><header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-7 lg:px-9"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--takeme-dark-green)]">Marketplace operations</p><p className="mt-1 text-sm text-[var(--takeme-gray)]">Private analytics · {user.email}</p></div><Link href="/" className="text-xs font-semibold text-[var(--takeme-dark-green)] underline lg:hidden">Marketplace</Link></div><nav className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden" aria-label="Admin sections">{links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center rounded-full px-3 text-xs font-semibold ${pathname === href ? "bg-[var(--takeme-dark-green)] text-white" : "bg-stone-100 text-stone-600"}`}>{label}</Link>)}</nav></header><main className="min-w-0 px-4 py-6 sm:px-7 lg:px-9 lg:py-9">{children}</main></div>
  </div>;
}
