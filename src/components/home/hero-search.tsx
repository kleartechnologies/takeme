"use client";

import { MapPin, Search, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function HeroSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  function submit(event: FormEvent) { event.preventDefault(); router.push(query.trim() ? `/explore?q=${encodeURIComponent(query.trim())}` : "/explore"); }
  return (
    <section className="relative overflow-hidden rounded-[var(--takeme-radius-xl)] bg-[var(--takeme-charcoal)] px-5 py-10 text-white sm:px-10 md:px-14 md:py-14">
      <div className="pointer-events-none absolute -right-20 -top-32 size-80 rounded-full bg-[var(--takeme-green)]/18 blur-3xl" />
      <div className="relative z-10 grid min-w-0 items-center gap-8 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="min-w-0"><p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/85">A marketplace for Malaysia</p><h1 className="max-w-3xl text-4xl font-bold tracking-[-0.05em] sm:text-5xl md:text-6xl">Same Stuff. <span className="text-[var(--takeme-green)]">A Brighter <span className="block min-[360px]:inline">Tomorrow.</span></span></h1><p className="mt-5 max-w-xl text-base font-medium leading-7 text-gray-200 md:text-lg">Buy. Sell. Give. Reuse.</p>
        <form onSubmit={submit} className="mt-8 flex max-w-2xl gap-2 rounded-2xl bg-white p-2 shadow-xl shadow-black/20"><label className="flex min-w-0 flex-1 items-center gap-3 px-3 text-[var(--takeme-gray)]"><Search size={20} className="shrink-0" /><span className="sr-only">Search listing titles</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What are you looking for?" className="h-12 min-w-0 flex-1 bg-transparent text-base text-[var(--takeme-charcoal)] outline-none placeholder:text-gray-400" /></label><button className="button-primary h-12 px-5 sm:px-7" type="submit">Search</button></form>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-gray-300 sm:text-sm"><span className="flex items-center gap-1.5"><MapPin size={15} className="text-[var(--takeme-green)]" /> Discover across Malaysia</span><span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-[var(--takeme-green)]" /> Built with safety in mind</span></div></div>
        <div className="relative mx-auto hidden aspect-square w-full max-w-[310px] lg:block"><div className="absolute inset-7 rounded-full bg-[var(--takeme-green)]/12" /><Image src="/brand/mascot-3d-happy.png" alt="TAKEME mascot welcoming marketplace shoppers" fill sizes="310px" className="relative object-contain" /></div>
      </div>
    </section>
  );
}
