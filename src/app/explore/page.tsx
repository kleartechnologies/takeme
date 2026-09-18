import { Suspense } from "react";
import { ExploreBrowser } from "@/components/listings/explore-browser";

export default function ExplorePage() {
  return <main className="page-shell py-8 md:py-12"><div className="mb-7"><p className="eyebrow">Live marketplace</p><h1 className="page-title">Explore good finds</h1><p className="mt-2 max-w-2xl text-stone-600">Browse active listings published by TAKEME sellers.</p></div><Suspense fallback={<div className="min-h-96 animate-pulse rounded-3xl bg-stone-100" />}><ExploreBrowser /></Suspense></main>;
}
