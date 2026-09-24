import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreBrowser } from "@/components/listings/explore-browser";

export const metadata: Metadata = { title: "Explore listings", description: "Discover active listings and auctions from TAKEME sellers in Malaysia.", alternates: { canonical: "/explore" } };

export default function ExplorePage() {
  return <main className="page-shell py-4 pb-28 sm:py-6 md:py-9 lg:pb-16"><div className="mb-3 sm:mb-5"><p className="eyebrow">Live marketplace</p><h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Explore good finds</h1><p className="mt-2 hidden max-w-2xl text-sm text-stone-600 sm:block">Search, browse categories and discover active listings from TAKEME sellers.</p></div><Suspense fallback={<div className="min-h-96 animate-pulse rounded-3xl bg-stone-100" />}><ExploreBrowser /></Suspense></main>;
}
