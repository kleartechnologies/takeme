"use client";

import { Bell, Heart, LogOut, Menu, MessageSquare, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { logout } from "@/lib/firebase/auth";
import { trackMarketplaceIntent } from "@/lib/services/intelligence";
import { useUnreadCount } from "@/lib/use-unread-count";
import { Logo } from "./logo";

const menuLinks = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/for-you", label: "For You" },
  { href: "/categories", label: "Categories" },
  { href: "/explore?type=auction", label: "Auctions" },
  { href: "/sell", label: "Sell something" },
  { href: "/saved", label: "Saved listings" },
  { href: "/saved-searches", label: "Saved searches" },
  { href: "/following", label: "Following" },
  { href: "/updates", label: "Updates" },
  { href: "/messages", label: "Messages" },
];

function SearchForm({ hideOnMobile = false }: { hideOnMobile?: boolean }) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = query.trim();
    if (search.length >= 2) trackMarketplaceIntent({ type: "SEARCH", query: search, context: "home" });
    router.push(search ? `/explore?q=${encodeURIComponent(search)}` : "/explore");
  }
  return <form onSubmit={submit} role="search" className={`${hideOnMobile ? "hidden lg:flex" : "flex"} h-11 min-w-0 flex-1 items-center rounded-full border border-gray-200 bg-[var(--takeme-off-white)] shadow-sm transition focus-within:border-[var(--takeme-green)] focus-within:ring-2 focus-within:ring-[var(--takeme-green)]/15 lg:max-w-lg`}>
    <button type="submit" aria-label="Search TAKEME" className="grid size-11 shrink-0 place-items-center text-[var(--takeme-gray)]"><Search size={19} /></button>
    <label className="min-w-0 flex-1"><span className="sr-only">Search listing titles</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search TAKEME" className="h-11 w-full min-w-0 bg-transparent pr-3 text-sm text-[var(--takeme-charcoal)] outline-none placeholder:text-[var(--takeme-gray)]" /></label>
  </form>;
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const pathname = usePathname();
  const unreadCount = useUnreadCount();
  if (pathname.startsWith("/admin")) return null;
  const accountHref = user ? "/profile" : "/login?next=/profile";

  return <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/95 backdrop-blur-xl">
    <div className="page-shell flex h-14 min-w-0 items-center gap-2 lg:h-[4.25rem] lg:gap-5">
      <div className="-ml-1 shrink-0 lg:hidden"><button type="button" className="icon-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="marketplace-menu" aria-label={open ? "Close menu" : "Open menu"}>{open ? <X size={21} /> : <Menu size={21} />}</button></div>
      <div className="hidden items-center gap-2 lg:flex"><Logo compact /><Link href="/" className="text-lg font-extrabold tracking-[-0.04em] text-[var(--takeme-dark-green)]">TAKEME</Link></div>
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden"><Logo compact /><Link href="/" className="truncate text-base font-extrabold tracking-[-0.04em] text-[var(--takeme-dark-green)]">TAKEME</Link></div>
      <SearchForm hideOnMobile />
      <nav className="hidden shrink-0 items-center gap-2 lg:flex" aria-label="Main navigation">
        <Link href="/explore" className="nav-link" aria-current={pathname === "/explore" ? "page" : undefined}>Explore</Link>
        <Link href="/for-you" className="nav-link" aria-current={pathname === "/for-you" ? "page" : undefined}>For You</Link>
        <Link href="/saved" className="icon-button" aria-label="Saved listings" aria-current={pathname === "/saved" ? "page" : undefined}><Heart size={20} /></Link>
        <Link href="/sell" className="button-primary h-10 px-5">Sell</Link>
        <Link href="/updates" className="icon-button relative" aria-label={unreadCount ? `Updates, ${unreadCount} unread` : "Updates"} aria-current={pathname === "/updates" ? "page" : undefined}><Bell size={19} />{unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-700 px-1 text-[10px] leading-5 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}</Link>
        <Link href="/messages" className="icon-button" aria-label="Messages" aria-current={pathname.startsWith("/messages") ? "page" : undefined}><MessageSquare size={19} /></Link>
        <Link href={accountHref} aria-label={user ? "Me, your profile" : "Me, log in"} className="icon-button"><UserRound size={20} /></Link>
        {user && <button type="button" onClick={() => void logout()} aria-label="Sign out" className="icon-button"><LogOut size={18} /></button>}
      </nav>
      <div className="-mr-1 flex shrink-0 items-center lg:hidden"><Link href="/saved" aria-label="Saved listings" className="icon-button"><Heart size={20} /></Link><Link href="/updates" aria-label={unreadCount ? `Updates, ${unreadCount} unread` : "Updates"} className="icon-button relative"><Bell size={20} />{unreadCount > 0 && <span className="absolute right-0 top-0 size-2.5 rounded-full bg-red-600" />}</Link></div>
    </div>
    {pathname === "/" && <div className="page-shell pb-2 lg:hidden"><SearchForm /></div>}
    {open && <nav id="marketplace-menu" className="border-t border-gray-200 bg-white px-5 py-3 lg:hidden" aria-label="Mobile menu"><div className="mx-auto grid max-w-7xl gap-0.5">
      {menuLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold hover:bg-[var(--takeme-light-green)] hover:text-[var(--takeme-dark-green)]">{link.label}</Link>)}
      <Link href={accountHref} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold hover:bg-[var(--takeme-light-green)] hover:text-[var(--takeme-dark-green)]">{user ? "My Listings" : "Log in or register"}</Link>
      {user && <button type="button" onClick={() => { setOpen(false); void logout(); }} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold hover:bg-[var(--takeme-light-green)] hover:text-[var(--takeme-dark-green)]"><LogOut size={17} /> Sign out</button>}
    </div></nav>}
  </header>;
}
