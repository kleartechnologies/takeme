import {
  inWindow,
  type Schedule,
  type SectionType,
} from "./editorial-domain.ts";
export interface HomeProduct {
  id: string;
  title: string;
  price: number;
  priceLabel: "Price" | "Starting bid";
  imageUrl: string;
  sellerId: string;
  endAt: string | null;
}
export interface HomeSeller {
  id: string;
  displayName: string;
  photoURL: string | null;
}
export interface HomeBanner extends Schedule {
  placement: string;
  url: string;
  alt: string;
  ctaLabel: string;
  destination: string;
  order: number;
}
export interface PublicHomeSection extends Schedule {
  sectionId: string;
  type: SectionType;
  title: string;
  source: string;
  products: HomeProduct[];
  sellers: HomeSeller[];
  categories: string[];
  banners: HomeBanner[];
  announcement: { title: string; destination: string } | null;
  cta: { label: string; destination: string } | null;
}
export interface PublicHomepage {
  schemaVersion: 1;
  version: number;
  sections: PublicHomeSection[];
  categories: {
    id: string;
    visible: boolean;
    order: number;
    featured: boolean;
  }[];
}
/** Defensive parser also rejects accidental private/admin payload additions. */
export function parseHomepage(value: unknown): PublicHomepage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as PublicHomepage;
  const exact = (o: object, allowed: string[]) =>
    Object.keys(o).every((k) => allowed.includes(k));
  const text = (v: unknown, max = 2048) =>
    typeof v === "string" && v.length <= max;
  const timestamp = (v: unknown) =>
    v === null || (typeof v === "string" && Number.isFinite(Date.parse(v)));
  const safeDestination = (v: unknown) =>
    text(v, 512) &&
    (!v ||
      (typeof v === "string" &&
        v.startsWith("/") &&
        !v.startsWith("//") &&
        !/[\\\s\x00-\x1f]|%2f|%5c|%0[ad]/i.test(v)));
  const image = (v: unknown) =>
    text(v) &&
    (!v ||
      /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//.test(String(v)) ||
      /^http:\/\/127\.0\.0\.1:9199\//.test(String(v)));
  try {
    if (
      !exact(p, ["schemaVersion", "version", "sections", "categories"]) ||
      p.schemaVersion !== 1 ||
      !Number.isSafeInteger(p.version) ||
      p.version < 1 ||
      !Array.isArray(p.sections) ||
      p.sections.length > 16 ||
      !Array.isArray(p.categories) ||
      p.categories.length > 14
    )
      return null;
    for (const s of p.sections) {
      if (
        s.cta &&
        (!exact(s.cta, ["label", "destination"]) ||
          !text(s.cta.label, 60) ||
          !safeDestination(s.cta.destination))
      )
        return null;
      if (
        !exact(s, [
          "sectionId",
          "type",
          "title",
          "source",
          "startAt",
          "endAt",
          "products",
          "sellers",
          "categories",
          "banners",
          "announcement",
          "cta",
        ]) ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(s.sectionId) ||
        !text(s.title, 100) ||
        ![
          "hero",
          "hot",
          "under20",
          "fresh",
          "ending",
          "trending",
          "near",
          "saved",
          "categories",
          "products",
          "sellers",
          "announcement",
        ].includes(s.type) ||
        !["AUTOMATIC", "MANUAL", "CAMPAIGN"].includes(s.source) ||
        !timestamp(s.startAt) ||
        !timestamp(s.endAt)
      )
        return null;
      if (
        !Array.isArray(s.products) ||
        s.products.length > 12 ||
        s.products.some(
          (v) =>
            !exact(v, [
              "id",
              "title",
              "price",
              "priceLabel",
              "imageUrl",
              "sellerId",
              "endAt",
            ]) ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(v.id) ||
            !text(v.title, 100) ||
            !["Price", "Starting bid"].includes(v.priceLabel) ||
            !Number.isFinite(v.price) ||
            v.price < 0 ||
            !image(v.imageUrl) ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(v.sellerId) ||
            !timestamp(v.endAt),
        )
      )
        return null;
      if (
        !Array.isArray(s.sellers) ||
        s.sellers.length > 12 ||
        s.sellers.some(
          (v) =>
            !exact(v, ["id", "displayName", "photoURL"]) ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(v.id) ||
            !text(v.displayName, 80) ||
            (v.photoURL !== null &&
              !image(v.photoURL) &&
              !/^https:\/\/lh3\.googleusercontent\.com\//.test(v.photoURL)),
        )
      )
        return null;
      if (
        !Array.isArray(s.categories) ||
        s.categories.length > 14 ||
        s.categories.some((v) => !text(v, 60)) ||
        !Array.isArray(s.banners) ||
        s.banners.length > 4
      )
        return null;
      if (
        s.banners.some(
          (v) =>
            !exact(v, [
              "placement",
              "url",
              "alt",
              "ctaLabel",
              "destination",
              "order",
              "startAt",
              "endAt",
            ]) ||
            ![
              "desktop_hero",
              "mobile_hero",
              "promo_strip",
              "secondary_card",
            ].includes(v.placement) ||
            !image(v.url) ||
            !text(v.alt, 180) ||
            !text(v.ctaLabel, 60) ||
            !safeDestination(v.destination) ||
            !Number.isSafeInteger(v.order) ||
            !timestamp(v.startAt) ||
            !timestamp(v.endAt),
        )
      )
        return null;
      if (
        s.announcement &&
        (!exact(s.announcement, ["title", "destination"]) ||
          !text(s.announcement.title, 100) ||
          !safeDestination(s.announcement.destination))
      )
        return null;
    }
    if (
      p.categories.some(
        (v) =>
          !exact(v, ["id", "visible", "order", "featured"]) ||
          !text(v.id, 60) ||
          typeof v.visible !== "boolean" ||
          typeof v.featured !== "boolean" ||
          !Number.isSafeInteger(v.order),
      )
    )
      return null;
    if (JSON.stringify(p).length > 150000) return null;
    return p;
  } catch {
    return null;
  }
}
export function currentHomepage(
  value: unknown,
  now: number,
): PublicHomepage | null {
  const p = parseHomepage(value);
  if (!p) return null;
  return {
    ...p,
    sections: p.sections
      .filter((s) => inWindow(s, now))
      .map((s) => ({
        ...s,
        products: s.products.filter(
          (v) => !v.endAt || Date.parse(v.endAt) > now,
        ),
        banners: s.banners.filter((v) => inWindow(v, now)),
      })),
  };
}
