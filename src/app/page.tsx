import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublicHomePage } from "@/lib/firebase/public-catalogue-server";
import { CategoryGrid } from "@/components/home/category-grid";
import { HeroBannerCarousel } from "@/components/home/hero-banner-carousel";
import { FeaturedMarketplace } from "@/components/home/featured-marketplace";
import { HomeMarketplace, HomeMarketplaceSkeleton, PersonalizedMarketplace, NearYouMarketplace } from "@/components/home/home-marketplace";
import { EndingSoonMarketplace } from "@/components/home/ending-soon-marketplace";
import { DeferredMarketplace } from "@/components/home/deferred-marketplace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return (
    <main className="page-shell home-marketplace pb-8 pt-3 lg:pb-12 lg:pt-6">
      <HeroBannerCarousel headingLevel={1} />
      <CategoryGrid />
      <Suspense fallback={<HomeMarketplaceSkeleton />}><PublicFreshFinds /></Suspense>
      <NearYouMarketplace />
      <DeferredMarketplace><EndingSoonMarketplace /><FeaturedMarketplace /><PersonalizedMarketplace /></DeferredMarketplace>
    </main>
  );
}

async function PublicFreshFinds() {
  return <HomeMarketplace initialPage={await getPublicHomePage()} />;
}
