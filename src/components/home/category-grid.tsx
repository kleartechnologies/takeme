"use client";

import { Shapes, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { categories } from "@/data/categories";
import { trackMarketplaceIntent } from "@/lib/services/intelligence";

export function CategoryGrid({ compact = false, selectedId = "", visibleIds, title = "Browse categories" }: { compact?: boolean; selectedId?: string; visibleIds?: string[]; title?: string }) {
  return (
    <section id="categories" className="scroll-mt-24 pt-1 pb-1 md:pt-4 md:pb-3">
      {!compact && <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2><Link href="/categories" className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--takeme-dark-green)] sm:text-sm">See all</Link></div>}
      <div className="mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 sm:gap-3" role="region" aria-label="Categories; scroll horizontally for more" tabIndex={0}>
        {(visibleIds ? visibleIds.flatMap(id => categories.filter(category => category.id === id)) : categories).map((category) => {
          const Fallback = category.icon === "Wrench" ? Wrench : Shapes;
          return <Link key={category.id} href={`/explore?category=${category.id}`} onClick={() => trackMarketplaceIntent({ type: "CATEGORY_VIEW", categoryId: category.id, context: "home" })} aria-label={`Explore ${category.name}`} aria-current={selectedId === category.id ? "page" : undefined} className="group flex w-[78px] shrink-0 snap-start flex-col items-center rounded-xl p-1 text-center transition hover:bg-white focus-visible:bg-white aria-[current=page]:bg-[var(--takeme-light-green)] aria-[current=page]:text-[var(--takeme-dark-green)] sm:w-24"><span className="grid size-[68px] place-items-center sm:size-[76px]">{category.icon.startsWith("/") ? <Image src={category.icon} alt="" width={76} height={76} sizes="(max-width: 640px) 68px, 76px" loading="lazy" className="size-[68px] rounded-full object-contain transition group-hover:scale-105 sm:size-[76px]" /> : <span className="grid size-14 place-items-center rounded-full bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"><Fallback size={26} /></span>}</span><span className="mt-1 flex min-h-8 items-start justify-center text-[11px] font-semibold leading-4 text-[var(--takeme-charcoal)] sm:text-xs">{category.name}</span></Link>;
        })}
      </div>
    </section>
  );
}
