"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

const banners = [
  {
    title: <>Same Stuff.<br />A Brighter Tomorrow.</>,
    supporting: "Buy. Sell. Give. Reuse.",
    action: "Explore Now",
    href: "/explore",
    theme: "brand",
    images: ["/categories/laptop-computers.png", "/categories/fashion.png", "/categories/books.png"],
  },
  {
    title: <>Got Stuff<br />to Sell?</>,
    supporting: "List your items for free on TAKEME.",
    action: "Sell Something",
    href: "/sell",
    theme: "sell",
    images: ["/brand/mascot-3d-happy.png"],
  },
  {
    title: <>Bid. Win.<br />Repeat.</>,
    supporting: "Discover items going under the hammer.",
    action: "Explore Auctions",
    href: "/explore?type=auction",
    theme: "auctions",
    images: ["/categories/games-consoles.png", "/categories/hobbies & collectibles.png"],
  },
  {
    title: <>Find Something<br />Great.</>,
    supporting: "Discover unique finds from TAKEME sellers.",
    action: "Explore Listings",
    href: "/explore",
    theme: "discover",
    images: ["/categories/home-living.png", "/categories/sports.png", "/categories/babies-kids.png"],
  },
] as const;

export function HeroBannerCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  function goTo(index: number) {
    track.current?.scrollTo({ left: index * track.current.clientWidth, behavior: "smooth" });
    setCurrent(index);
  }

  return (
    <section aria-label="TAKEME marketplace highlights">
      <div ref={track} onScroll={(event) => {
        const { scrollLeft, clientWidth } = event.currentTarget;
        if (clientWidth) setCurrent(Math.round(scrollLeft / clientWidth));
      }} className="banner-track flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl lg:rounded-3xl" role="region" aria-roledescription="carousel" aria-label="Marketplace promotions" tabIndex={0}>
        {banners.map((banner, index) => (
          <div key={banner.theme} className={`marketplace-banner marketplace-banner--${banner.theme} relative flex w-full shrink-0 snap-start items-center overflow-hidden rounded-2xl lg:rounded-3xl`} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${banners.length}: ${banner.action}`}>
            <div className="relative z-10 w-[68%] pl-4 sm:pl-8 lg:pl-14">
              <p className="banner-kicker">TAKEME MARKETPLACE</p>
              {index === 0 ? <h1 className="banner-title">{banner.title}</h1> : <h2 className="banner-title">{banner.title}</h2>}
              <p className="banner-supporting">{banner.supporting}</p>
              <Link href={banner.href} className="banner-action group inline-flex items-center gap-1.5 rounded-full font-semibold focus-visible:outline-offset-2">{banner.action}<ArrowRight className="size-3 transition group-hover:translate-x-0.5 sm:size-4" aria-hidden="true" /></Link>
            </div>
            <div className={`banner-art banner-art--${banner.theme} pointer-events-none absolute inset-y-0 right-0 w-[43%]`} aria-hidden="true">
              {banner.images.map((src, imageIndex) => (
                <span key={src} className={`banner-object banner-object--${imageIndex + 1}`}>
                  <Image src={src} alt="" fill sizes="(max-width: 640px) 112px, (max-width: 1024px) 170px, 240px" className="object-contain" priority={index === 0 && imageIndex === 0} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex justify-center gap-1.5" aria-label="Choose a promotion">
        {banners.map((banner, index) => <button key={banner.theme} type="button" onClick={() => goTo(index)} aria-label={`Show promotion ${index + 1}: ${banner.action}`} aria-current={current === index ? "true" : undefined} className="grid min-h-8 min-w-8 place-items-center rounded-full"><span className={`block h-1.5 rounded-full transition-all ${current === index ? "w-5 bg-[var(--takeme-dark-green)]" : "w-1.5 bg-gray-300"}`} /></button>)}
      </div>
    </section>
  );
}
