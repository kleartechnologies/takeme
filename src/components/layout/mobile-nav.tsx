"use client";

import { Compass, Home, MessageCircle, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/sell", label: "Sell", icon: Plus, featured: true },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" aria-label="Bottom navigation">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon, featured }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold ${featured ? "-mt-5" : ""} ${active ? "text-[var(--takeme-dark-green)]" : "text-[var(--takeme-gray)]"}`}>
              <span className={featured ? "grid size-12 place-items-center rounded-full bg-[var(--takeme-green)] text-[var(--takeme-charcoal)] shadow-[0_8px_20px_rgb(0_200_83_/_0.22)]" : "grid size-7 place-items-center"}>
                <Icon size={featured ? 22 : 19} strokeWidth={featured ? 2.5 : 2} />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
