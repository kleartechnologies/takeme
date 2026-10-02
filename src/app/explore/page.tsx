import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreBrowser } from "@/components/listings/explore-browser";
import { ListingSkeleton } from "@/components/ui/states";

export const metadata: Metadata = { title: "Explore listings", description: "Discover active listings and auctions from TAKEME sellers in Malaysia.", alternates: { canonical: "/explore" } };

export default function ExplorePage() {
  return <main className="page-shell explore-marketplace"><h1 className="sr-only">Explore listings</h1><Suspense fallback={<div aria-label="Loading marketplace" aria-busy="true"><div className="mb-6 h-11 animate-pulse rounded-full bg-gray-100" /><div className="explore-product-grid">{Array.from({ length: 6 }, (_, index) => <ListingSkeleton key={index} discovery />)}</div></div>}><ExploreBrowser /></Suspense></main>;
}
