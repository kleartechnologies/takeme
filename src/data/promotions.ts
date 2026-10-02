// Portable marketplace promotion content; presentation lives in the carousel.
export const marketplacePromotions = [
  {
    titleLines: ["Give good stuff", "a second life."],
    supporting: "Buy. Sell. Give. Reuse.",
    action: "Explore Now",
    href: "/explore",
    theme: "brand",
    images: ["/brand/mascot-3d-wink.png", "/categories/laptop-computers.png", "/categories/home-living.png"],
  },
  {
    titleLines: ["Got Stuff", "to Sell?"],
    supporting: "List your items for free on TAKEME.",
    action: "Sell Something",
    href: "/sell",
    theme: "sell",
    images: ["/brand/mascot-3d-happy.png"],
  },
  {
    titleLines: ["Bid. Win.", "Repeat."],
    supporting: "Discover items going under the hammer.",
    action: "Explore Auctions",
    href: "/explore?type=auction",
    theme: "auctions",
    images: ["/categories/games-consoles.png", "/categories/hobbies%20%26%20collectibles.png"],
  },
  {
    titleLines: ["Find Something", "Great."],
    supporting: "Discover unique finds from TAKEME sellers.",
    action: "Explore Listings",
    href: "/explore",
    theme: "discover",
    images: ["/categories/home-living.png", "/categories/sports.png", "/categories/babies-kids.png"],
  },
] as const;
