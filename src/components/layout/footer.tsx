"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";

export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname.startsWith("/messages")) return null;
  return (
    <footer className={`${pathname === "/" || pathname === "/explore" || pathname.startsWith("/profile") || pathname.startsWith("/sellers/") ? "hidden lg:block " : ""}border-t border-gray-200 bg-white pb-24 pt-7 text-[var(--takeme-gray)] lg:pb-10`}>
      <div className="page-shell grid gap-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="inline-flex rounded-xl bg-white p-1.5"><Logo compact /></div>
          <p className="mt-4 max-w-sm text-sm font-semibold text-[var(--takeme-charcoal)]">Same Stuff. A Brighter Tomorrow.</p>
          <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--takeme-gray)]">Buy. Sell. Give. Reuse.</p>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--takeme-charcoal)]">Marketplace</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm md:grid md:gap-2 [&>a]:flex [&>a]:min-h-11 [&>a]:items-center"><Link href="/explore">Explore</Link><Link href="/sell">Sell an item</Link><Link href="/profile">Your profile</Link><Link href="/help/tiers">How tiers work</Link></div>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--takeme-charcoal)]">Marketplace status</p>
          <p className="mt-3 text-sm leading-6 text-[var(--takeme-gray)]">Buy-now requests, offers and auctions can form agreed deals. Buyer-to-seller checkout and payments are not processed by TAKEME yet.</p>
        </div>
      </div>
    </footer>
  );
}
