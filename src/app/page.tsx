import type { Metadata } from "next";
import { CategoryGrid } from "@/components/home/category-grid";
import { HeroBannerCarousel } from "@/components/home/hero-banner-carousel";
import { FeaturedMarketplace } from "@/components/home/featured-marketplace";
import { HomeMarketplace, NearYouMarketplace } from "@/components/home/home-marketplace";
import { EndingSoonMarketplace } from "@/components/home/ending-soon-marketplace";
import { DeferredMarketplace } from "@/components/home/deferred-marketplace";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return (
    <main className="page-shell home-marketplace pb-8 pt-3 lg:pb-12 lg:pt-6">
      <HeroBannerCarousel headingLevel={1} />
      <CategoryGrid />
      <HomeMarketplace />
      <NearYouMarketplace />
      <DeferredMarketplace><EndingSoonMarketplace /><FeaturedMarketplace /></DeferredMarketplace>
    </main>
  );
}
