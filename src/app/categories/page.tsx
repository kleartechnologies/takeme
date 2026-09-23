import { Shapes, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { categories } from "@/data/categories";

export const metadata: Metadata = { title: "Browse categories", description: "Browse all official TAKEME marketplace categories." };

export default function CategoriesPage() {
  return <main className="page-shell min-h-[70vh] py-6 pb-28 md:py-10 lg:pb-16"><div className="mb-6"><p className="eyebrow">Find your next good find</p><h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Browse by categories</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--takeme-gray)]">All 14 TAKEME categories, using the same familiar icons across discovery and selling.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">{categories.map((category) => {
    const Fallback = category.icon === "Wrench" ? Wrench : Shapes;
    return <Link key={category.id} href={`/explore?category=${category.id}`} className="group flex min-h-36 flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-[var(--takeme-shadow-sm)] transition hover:border-[var(--takeme-green)] focus-visible:border-[var(--takeme-green)]"><span className="grid size-20 place-items-center">{category.icon.startsWith("/") ? <Image src={category.icon} alt="" width={84} height={84} sizes="84px" className="size-20 object-contain transition group-hover:scale-105" /> : <span className="grid size-16 place-items-center rounded-full bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"><Fallback size={29} /></span>}</span><span className="mt-2 text-xs font-semibold leading-5 sm:text-sm">{category.name}</span></Link>;
  })}</div></main>;
}
