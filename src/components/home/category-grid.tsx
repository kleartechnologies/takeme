import { Armchair, Baby, Bike, BookOpen, Car, Gamepad2, Laptop, Puzzle, Shapes, Shirt, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { categories } from "@/data/categories";

const icons: Record<string, LucideIcon> = { Armchair, Baby, Bike, BookOpen, Car, Gamepad2, Laptop, Puzzle, Shapes, Shirt, Sparkles, Wrench };

export function CategoryGrid() {
  return (
    <section id="categories" className="scroll-mt-24 py-10 md:py-14">
      <p className="eyebrow">Browse your way</p>
      <h2 className="section-title">Shop by category</h2>
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {categories.map((category) => {
          const Icon = icons[category.icon];
          return <Link key={category.id} href={`/explore?category=${category.id}`} className="group flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-[var(--takeme-shadow-sm)] transition hover:-translate-y-0.5 hover:border-[var(--takeme-green)]"><span className="grid size-11 place-items-center rounded-2xl bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)] transition group-hover:bg-[var(--takeme-green)] group-hover:text-[var(--takeme-charcoal)]"><Icon size={21} /></span><span className="text-xs font-semibold leading-4 text-[var(--takeme-charcoal)] sm:text-sm">{category.name}</span></Link>;
        })}
      </div>
    </section>
  );
}
