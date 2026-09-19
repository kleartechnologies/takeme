import { CategoryGrid } from "@/components/home/category-grid";
import { HeroBannerCarousel } from "@/components/home/hero-banner-carousel";
import { HomeMarketplace } from "@/components/home/home-marketplace";

export default function HomePage() {
  return (
    <main className="page-shell pb-14 pt-4 lg:pb-20 lg:pt-7">
      <HeroBannerCarousel />
      <CategoryGrid />
      <HomeMarketplace />
    </main>
  );
}
