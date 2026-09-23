"use client";

import { Bell, Compass, Heart, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

const items = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/saved", label: "Saved", icon: Heart },
  { href: "/sell", label: "Sell", icon: Plus, featured: true },
  { href: "", label: "Updates", icon: Bell, unavailable: true },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  if (pathname.startsWith("/admin")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden" aria-label="Bottom navigation">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon, featured, unavailable }) => {
          const active = !unavailable && pathname === href;
          const content = <><span className={featured ? "grid size-12 place-items-center rounded-full bg-[var(--takeme-green)] text-[var(--takeme-charcoal)] shadow-[0_8px_20px_rgb(0_200_83_/_0.22)]" : "grid size-7 place-items-center"}><Icon size={featured ? 22 : 19} strokeWidth={featured ? 2.5 : 2} /></span><span>{label === "Profile" ? "Me" : label}</span></>;
          const className = `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold ${featured ? "-mt-5" : ""} ${active ? "text-[var(--takeme-dark-green)]" : unavailable ? "text-gray-400" : "text-[var(--takeme-gray)]"}`;
          return unavailable ? <button key={label} type="button" disabled title={`${label} is not available yet`} aria-label={`${label} is not available yet`} className={`${className} cursor-not-allowed`}>{content}</button> : <Link key={label} href={label === "Profile" && !user ? "/login?next=/profile" : href} aria-current={active ? "page" : undefined} className={className}>{content}</Link>;
        })}
      </div>
    </nav>
  );
}
