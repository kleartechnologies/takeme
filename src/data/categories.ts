import type { Category } from "@/types/marketplace";

export const categories: Category[] = [
  { id: "electronics", name: "Electronics", icon: "/categories/laptop-computers.png" },
  { id: "fashion", name: "Fashion", icon: "/categories/fashion.png" },
  { id: "home-living", name: "Home & Living", icon: "/categories/home-living.png" },
  { id: "games", name: "Games & Consoles", icon: "/categories/games-consoles.png" },
  { id: "toys-hobbies", name: "Toys & Hobbies", icon: "/categories/hobbies%20%26%20collectibles.png" },
  { id: "sports", name: "Sports & Outdoors", icon: "/categories/sports.png" },
  { id: "automotive", name: "Automotive", icon: "/categories/auto accessories.png" },
  { id: "books", name: "Books", icon: "/categories/books.png" },
  { id: "collectibles", name: "Collectibles", icon: "/categories/hobbies%20%26%20collectibles.png" },
  { id: "tools", name: "Tools", icon: "Wrench" },
  { id: "baby-kids", name: "Baby & Kids", icon: "/categories/babies-kids.png" },
  { id: "tv-home-appliances", name: "TV & Home Appliances", icon: "/categories/tv-home appliances.png" },
  { id: "health-nutrition", name: "Health & Nutrition", icon: "/categories/health-nutritions.png" },
  { id: "others", name: "Others", icon: "Shapes" },
];

export function getCategoryName(id: string) {
  return categories.find((category) => category.id === id)?.name ?? id.replaceAll("-", " ");
}
