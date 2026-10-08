/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { HeroBannerCarousel } from "./hero-banner-carousel";
import { CategoryGrid } from "./category-grid";
import {
  HomeMarketplace,
  NearYouMarketplace,
  PersonalizedMarketplace,
} from "./home-marketplace";
import { DeferredMarketplace } from "./deferred-marketplace";
import { EndingSoonMarketplace } from "./ending-soon-marketplace";
import { FeaturedMarketplace } from "./featured-marketplace";
import { EditorialAutomatic } from "./editorial-automatic";
import type { PublicCataloguePage } from "@/lib/public-catalogue";
import type { PublicHomepage } from "../../../functions/src/homepage-projection";
import { getCategoryName } from "@/data/categories";
export function PublishedHome({
  page,
  homepage,
}: {
  page: PublicCataloguePage | null;
  homepage: PublicHomepage | null;
}) {
  if (!homepage)
    return (
      <>
        <HeroBannerCarousel headingLevel={1} />
        <CategoryGrid />
        <HomeMarketplace initialPage={page} />
        <NearYouMarketplace />
        <DeferredMarketplace>
          <EndingSoonMarketplace />
          <FeaturedMarketplace />
          <PersonalizedMarketplace />
        </DeferredMarketplace>
      </>
    );
  const categories = homepage.categories.length
    ? homepage.categories.filter((v) => v.visible).map((v) => v.id)
    : undefined;
  return (
    <>
      {!homepage.sections.some((s) => s.type === "hero") && (
        <h1 className="sr-only">TAKEME marketplace</h1>
      )}
      {homepage.sections.map((section) => {
        if (section.source === "AUTOMATIC") {
          if (section.type === "fresh")
            return (
              <HomeMarketplace
                key={section.sectionId}
                initialPage={page}
                title={section.title}
              />
            );
          if (section.type === "categories")
            return (
              <CategoryGrid
                key={section.sectionId}
                visibleIds={
                  homepage.categories.some((v) => v.featured)
                    ? homepage.categories
                        .filter((v) => v.visible && v.featured)
                        .map((v) => v.id)
                    : categories
                }
                title={section.title}
              />
            );
          if (section.type === "near")
            return (
              <DeferredMarketplace key={section.sectionId}>
                <NearYouMarketplace />
              </DeferredMarketplace>
            );
          if (section.type === "ending")
            return (
              <DeferredMarketplace key={section.sectionId}>
                <EndingSoonMarketplace />
              </DeferredMarketplace>
            );
          if (["hot", "under20", "saved"].includes(section.type))
            return (
              <DeferredMarketplace key={section.sectionId}>
                <EditorialAutomatic
                  type={section.type as "hot" | "under20" | "saved"}
                  title={section.title}
                />
              </DeferredMarketplace>
            );
        }
        const desktop = section.banners.find(
            (b) => b.placement === "desktop_hero",
          ),
          mobile = section.banners.find((b) => b.placement === "mobile_hero"),
          hero = desktop ?? mobile;
        return (
          <section
            key={section.sectionId}
            className="discovery-section"
            aria-label={section.title}
          >
            {section.type === "hero" ? (
              <h1 className="mb-4 text-2xl font-bold">{section.title}</h1>
            ) : (
              <h2 className="mb-4 text-xl font-bold">{section.title}</h2>
            )}
            {hero && (
              <Link
                href={hero.destination || "/explore"}
                className="block overflow-hidden rounded-xl"
              >
                <picture>
                  {mobile && (
                    <source media="(max-width:767px)" srcSet={mobile.url} />
                  )}
                  <img
                    src={hero.url}
                    alt={hero.alt}
                    width={1920}
                    height={640}
                    className="w-full aspect-[3/1] object-cover max-md:aspect-square"
                    loading={section.type === "hero" ? "eager" : "lazy"}
                  />
                </picture>
                {hero.ctaLabel && (
                  <span className="inline-flex min-h-11 items-center px-3 font-semibold">
                    {hero.ctaLabel} →
                  </span>
                )}
              </Link>
            )}
            {section.banners
              .filter(
                (b) => !["desktop_hero", "mobile_hero"].includes(b.placement),
              )
              .map((b, index) => (
                <Link
                  className="my-3 block"
                  key={index}
                  href={b.destination || "/explore"}
                >
                  <img
                    src={b.url}
                    alt={b.alt}
                    width={1200}
                    height={400}
                    className="w-full aspect-[3/1] object-cover rounded-lg"
                    loading="lazy"
                  />
                  <span className="action-link">{b.ctaLabel}</span>
                </Link>
              ))}
            {section.products.length > 0 && (
              <div className="home-product-grid">
                {section.products.map((product) => (
                  <Link
                    key={product.id}
                    href={`/listings/${product.id}`}
                    className="min-w-0 rounded-lg border border-gray-200 bg-white overflow-hidden"
                  >
                    <div className="aspect-square bg-gray-100">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          width={400}
                          height={400}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="line-clamp-2 text-sm font-semibold">
                        {product.title}
                      </h3>
                      <p className="mt-1 font-bold">
                        {product.priceLabel === "Starting bid" && (
                          <span className="mr-1 text-xs font-normal">
                            Starting bid
                          </span>
                        )}{" "}
                        RM {product.price.toFixed(2)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {section.sellers.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                {section.sellers.map((seller) => (
                  <Link
                    key={seller.id}
                    href={`/sellers/${seller.id}`}
                    className="flex min-h-16 items-center gap-3 border border-gray-200 rounded-lg p-3"
                  >
                    {seller.photoURL && (
                      <img
                        src={seller.photoURL}
                        alt=""
                        width={44}
                        height={44}
                        className="size-11 rounded-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <strong>{seller.displayName}</strong>
                  </Link>
                ))}
              </div>
            )}
            {section.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {section.categories
                  .filter((id) => !categories || categories.includes(id))
                  .map((id) => (
                    <Link
                      className="button-secondary min-h-11 px-3"
                      key={id}
                      href={`/explore?category=${id}`}
                    >
                      {getCategoryName(id)}
                    </Link>
                  ))}
              </div>
            )}
            {section.cta && (
              <Link
                className="action-link mt-3"
                href={section.cta.destination || "/explore"}
              >
                {section.cta.label} →
              </Link>
            )}
            {section.announcement && (
              <p className="rounded-lg bg-[var(--takeme-light-green)] p-4">
                {section.announcement.destination ? (
                  <Link
                    className="inline-flex min-h-11 items-center font-semibold"
                    href={section.announcement.destination}
                  >
                    {section.announcement.title} →
                  </Link>
                ) : (
                  section.announcement.title
                )}
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}
