import type { Metadata } from "next";
import { CategoryGrid } from "@/components/home/category-grid";
import { HeroBannerCarousel } from "@/components/home/hero-banner-carousel";
import { FeaturedMarketplace } from "@/components/home/featured-marketplace";
import { HomeMarketplace } from "@/components/home/home-marketplace";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return (
    <main className="page-shell pb-14 pt-4 lg:pb-20 lg:pt-7">
      <HeroBannerCarousel headingLevel={1} />
      <HomeMarketplace />
      <FeaturedMarketplace />
      <CategoryGrid />
    </main>
  );
}
