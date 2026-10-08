import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublicHomePage } from "@/lib/firebase/public-catalogue-server";
import { CategoryGrid } from "@/components/home/category-grid";
import { HeroBannerCarousel } from "@/components/home/hero-banner-carousel";
import { PublishedHome } from "@/components/home/published-home";
import { HomeMarketplaceSkeleton } from "@/components/home/home-marketplace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return (
    <main className="page-shell home-marketplace pb-8 pt-3 lg:pb-12 lg:pt-6">
      <Suspense
        fallback={
          <>
            <HeroBannerCarousel headingLevel={1} />
            <CategoryGrid />
            <HomeMarketplaceSkeleton />
          </>
        }
      >
        <PublicFreshFinds />
      </Suspense>
    </main>
  );
}

async function PublicFreshFinds() {
  const page = await getPublicHomePage();
  return <PublishedHome page={page} homepage={page?.homepage ?? null} />;
}
