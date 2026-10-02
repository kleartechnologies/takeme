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
    <nav className={`${pathname === "/" || pathname === "/explore" || pathname.startsWith("/profile") || pathname.startsWith("/sellers/") ? "home-bottom-nav " : ""}fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgb(31_41_55_/_0.06)] backdrop-blur-xl lg:hidden`} aria-label="Bottom navigation">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon, featured }) => {
          const active = pathname === href || (href === "/profile" && pathname.startsWith("/profile/")) || (href === "/explore" && (pathname === "/" || pathname.startsWith("/listings/")));
          const content = <><span className={featured ? "grid size-14 place-items-center rounded-full bg-[var(--takeme-dark-green)] text-white shadow-[0_6px_18px_rgb(0_200_83_/_0.24)]" : "grid size-7 place-items-center"}><Icon size={featured ? 31 : 23} strokeWidth={featured ? 2 : 1.8} /></span><span>{label}</span></>;
          const className = `flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold min-[375px]:text-[11px] ${featured ? "-mt-6" : ""} ${active ? "text-[var(--takeme-dark-green)]" : "text-[var(--takeme-gray)]"}`;
          return <Link key={label} href={href} aria-current={active ? "page" : undefined} className={className}>{content}</Link>;
        })}
      </div>
    </nav>
  );
}
