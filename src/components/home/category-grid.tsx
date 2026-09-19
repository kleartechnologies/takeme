import { Shapes, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { categories } from "@/data/categories";

export function CategoryGrid() {
  return (
    <section id="categories" className="scroll-mt-24 py-10 md:py-14">
      <p className="eyebrow">Browse your way</p>
      <h2 className="section-title">Shop by category</h2>
      <div className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3" role="region" aria-label="Categories; scroll horizontally for more" tabIndex={0}>
        {categories.map((category) => {
          const Fallback = category.icon === "Wrench" ? Wrench : Shapes;
          return <Link key={category.id} href={`/explore?category=${category.id}`} className="group flex w-32 shrink-0 snap-start flex-col items-center rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-[var(--takeme-shadow-sm)] transition hover:border-[var(--takeme-green)] focus-visible:border-[var(--takeme-green)] sm:w-36"><span className="grid size-24 place-items-center">{category.icon.startsWith("/") ? <Image src={category.icon} alt="" width={96} height={96} sizes="96px" loading="lazy" className="size-24 object-contain" /> : <span className="grid size-20 place-items-center rounded-full bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"><Fallback size={34} /></span>}</span><span className="mt-2 flex min-h-10 items-center justify-center text-xs font-semibold leading-4 text-[var(--takeme-charcoal)] sm:text-sm">{category.name}</span></Link>;
        })}
      </div>
    </section>
  );
}
