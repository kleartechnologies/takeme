import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreBrowser } from "@/components/listings/explore-browser";

export const metadata: Metadata = { title: "Explore listings", description: "Discover active listings and auctions from TAKEME sellers in Malaysia.", alternates: { canonical: "/explore" } };

export default function ExplorePage() {
  return <main className="page-shell py-4 pb-28 sm:py-6 md:py-9 lg:pb-16"><h1 className="sr-only">Explore listings</h1><Suspense fallback={<div className="min-h-96 animate-pulse rounded-3xl bg-stone-100" />}><ExploreBrowser /></Suspense></main>;
}
