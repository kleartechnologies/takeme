import { ArrowRight, Camera, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { CategoryGrid } from "@/components/home/category-grid";
import { HeroSearch } from "@/components/home/hero-search";
import { HomeMarketplace } from "@/components/home/home-marketplace";

export default function HomePage() {
  return (
    <main>
      <div className="page-shell pt-5 md:pt-7"><HeroSearch /></div>
      <div className="page-shell"><HomeMarketplace /><CategoryGrid /></div>
      <section className="page-shell pb-14 pt-4 md:pb-20"><div className="grid overflow-hidden rounded-[var(--takeme-radius-xl)] border border-[var(--takeme-green)]/20 bg-[var(--takeme-light-green)] md:grid-cols-[1.1fr_0.9fr]"><div className="p-7 sm:p-10 md:p-12"><Camera size={28} className="text-[var(--takeme-dark-green)]" /><h2 className="mt-5 text-3xl font-bold tracking-tight text-[var(--takeme-charcoal)] sm:text-4xl">Ready to clear some space?</h2><p className="mt-3 max-w-lg leading-7 text-[var(--takeme-gray)]">Create a real listing, upload your best photos, and publish it to the marketplace.</p><Link href="/sell" className="button-primary mt-7 h-12 px-6">Start selling <ArrowRight size={17} /></Link></div><div className="grid content-center gap-3 bg-[var(--takeme-dark-green)] p-7 text-white sm:p-10"><Benefit text="Free to publish a listing" /><Benefit text="Real Firebase-backed inventory" /><Benefit text="Owner-only editing and removal" /></div></div></section>
    </main>
  );
}

function Benefit({ text }: { text: string }) { return <p className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 font-semibold"><CheckCircle2 size={19} className="text-[var(--takeme-green)]" />{text}</p>; }
