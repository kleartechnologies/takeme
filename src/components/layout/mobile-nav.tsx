"use client";

import { Bell, Compass, Plus, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/for-you", label: "For You", icon: Sparkles },
  { href: "/sell", label: "Sell", icon: Plus, featured: true },
  { href: "/updates", label: "Updates", icon: Bell },
  { href: "/profile", label: "Me", icon: UserRound },
];

export function MobileNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden" aria-label="Bottom navigation">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon, featured }) => {
          const active = pathname === href || (href === "/explore" && pathname.startsWith("/listings/"));
          const content = <><span className={featured ? "grid size-12 place-items-center rounded-full bg-[var(--takeme-green)] text-[var(--takeme-charcoal)] shadow-[0_8px_20px_rgb(0_200_83_/_0.22)]" : "grid size-7 place-items-center"}><Icon size={featured ? 22 : 19} strokeWidth={featured ? 2.5 : 2} /></span><span>{label}</span></>;
          const className = `flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold ${featured ? "-mt-5" : ""} ${active ? "text-[var(--takeme-dark-green)]" : "text-[var(--takeme-gray)]"}`;
          return <Link key={label} href={href} aria-current={active ? "page" : undefined} className={className}>{content}</Link>;
        })}
      </div>
    </nav>
  );
}
