"use client";

import { LogOut, Menu, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { logout } from "@/lib/firebase/auth";
import { Logo } from "./logo";

const links = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/#categories", label: "Categories" },
  { href: "/messages", label: "Messages" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/92 backdrop-blur-xl">
      <div className="page-shell flex h-[4.5rem] items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {links.slice(0, 3).map((link) => (
            <Link key={link.href} href={link.href} className="nav-link" aria-current={pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href)) ? "page" : undefined}>{link.label}</Link>
          ))}
        </nav>
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <Link href="/explore" className="flex h-11 w-full max-w-sm items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm text-[var(--takeme-gray)] shadow-xs transition hover:border-[var(--takeme-green)] hover:shadow-sm">
            <Search size={17} />
            <span>Search listings</span>
          </Link>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/sell" className="button-primary h-11 px-5">Sell an item</Link>
          {!loading && user ? (
            <div className="flex items-center gap-1">
              <Link href="/profile" className="icon-button" aria-label="Profile"><UserRound size={19} /></Link>
              <button className="icon-button" aria-label="Sign out" onClick={() => void logout()}><LogOut size={18} /></button>
            </div>
          ) : (
            <Link href="/login" className="button-secondary h-11 px-4">Log in</Link>
          )}
        </div>
        <button className="icon-button md:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Toggle menu">
          {open ? <X size={20} /> : <Menu size={21} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-gray-200 bg-white px-5 py-4 md:hidden">
          <nav className="mx-auto grid max-w-7xl gap-1" aria-label="Mobile menu">
            {links.map((link) => (
            <Link key={link.href} href={link.href} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-[var(--takeme-charcoal)] hover:bg-[var(--takeme-light-green)] hover:text-[var(--takeme-dark-green)]" onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link href={user ? "/profile" : "/login"} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--takeme-charcoal)] hover:bg-[var(--takeme-light-green)] hover:text-[var(--takeme-dark-green)]" onClick={() => setOpen(false)}>
              {user ? <UserRound size={17} /> : null}{user ? "Your profile" : "Log in or register"}
            </Link>
            {user && <button className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-[var(--takeme-charcoal)] hover:bg-[var(--takeme-light-green)] hover:text-[var(--takeme-dark-green)]" onClick={() => { setOpen(false); void logout(); }}><LogOut size={17} /> Log out</button>}
          </nav>
        </div>
      )}
    </header>
  );
}
