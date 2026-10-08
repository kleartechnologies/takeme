/** Bounded editorial contracts. Pure module shared with the isolated admin app. */
export const EDITORIAL_KINDS = [
  "campaigns",
  "banners",
  "collections",
  "announcements",
  "homepage",
  "categories",
] as const;
export type EditorialKind = (typeof EDITORIAL_KINDS)[number];
export const SECTION_TYPES = [
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
] as const;
export const CATEGORY_IDS = [
  "electronics",
  "fashion",
  "home-living",
  "games",
  "toys-hobbies",
  "sports",
  "automotive",
  "books",
  "collectibles",
  "tools",
  "baby-kids",
  "tv-home-appliances",
  "health-nutrition",
  "others",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];
export type State = "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED";
export interface Schedule {
  startAt: string | null;
  endAt: string | null;
}
export interface Campaign extends Schedule {
  title: string;
  internalDescription: string;
  lifecycleStatus: State;
  priority: number;
  ctaLabel: string;
  destination: string;
  placements: SectionType[];
  productIds: string[];
  sellerIds: string[];
  categoryIds: string[];
  bannerIds: string[];
}
export interface Banner extends Partial<Schedule> {
  /** Absent on legacy, single-artwork records. */
  mobileAssetId?: string | null;
  title: string;
  placement: "desktop_hero" | "mobile_hero" | "promo_strip" | "secondary_card";
  assetId: string;
  alt: string;
  ctaLabel: string;
  destination: string;
  order: number;
  enabled: boolean;
  campaignId: string | null;
}
export interface Collection extends Schedule {
  title: string;
  slug: string;
  description: string;
  productIds: string[];
  assetId: string;
  active: boolean;
}
export interface Announcement extends Schedule {
  title: string;
  destination: string;
  enabled: boolean;
  order: number;
}
export interface Section extends Schedule {
  sectionId: string;
  type: SectionType;
  enabled: boolean;
  order: number;
  title: string;
  source: "AUTOMATIC" | "MANUAL" | "CAMPAIGN";
  productIds: string[];
  sellerIds: string[];
  categoryIds: string[];
  bannerIds: string[];
  collectionId: string | null;
  announcementId: string | null;
  campaignId: string | null;
}
export interface Homepage {
  title: string;
  sections: Section[];
}
export interface CategoryConfig {
  title: string;
  categories: {
    id: string;
    visible: boolean;
    order: number;
    featured: boolean;
  }[];
}
export type Content =
  | Campaign
  | Banner
  | Collection
  | Announcement
  | Homepage
  | CategoryConfig;
export interface EditorialRecord {
  id: string;
  kind: EditorialKind;
  content: Content;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  effectiveState?: State;
}
export const id = (v: unknown): string => {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(v))
    throw new Error("Choose a valid record reference.");
  return v;
};
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Invalid content.");
  return v as Record<string, unknown>;
}
function keys(v: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    throw new Error("Unrecognized content field.");
}
function text(v: unknown, max = 100, required = false): string {
  if (typeof v !== "string" || v.trim().length > max || (required && !v.trim()))
    throw new Error("Text is missing or too long.");
  return v.trim();
}
function integer(v: unknown) {
  if (!Number.isSafeInteger(v) || (v as number) < 0 || (v as number) > 999)
    throw new Error("Order must be between 0 and 999.");
  return v as number;
}
function bool(v: unknown) {
  if (typeof v !== "boolean") throw new Error("Choose enabled or disabled.");
  return v;
}
function optionalId(v: unknown): string | null {
  return v === null || v === "" || v === undefined ? null : id(v);
}
function ids(v: unknown, max = 12): string[] {
  if (!Array.isArray(v) || v.length > max)
    throw new Error(`Choose at most ${max} references.`);
  const result = v.map(id);
  if (new Set(result).size !== result.length)
    throw new Error("Remove duplicate references.");
  return result;
}
export function destination(v: unknown): string {
  const s = text(v, 512);
  if (
    s &&
    (!s.startsWith("/") ||
      s.startsWith("//") ||
      /[\\\s\x00-\x1f]/.test(s) ||
      /%2f|%5c|%0[ad]/i.test(s))
  )
    throw new Error(
      "Choose a marketplace-relative destination, such as /explore.",
    );
  return s;
}
function schedule(o: Record<string, unknown>): Schedule {
  const stamp = (v: unknown) => {
    if (v === null || v === "" || v === undefined) return null;
    if (
      typeof v !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(v) ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(v) ||
      !Number.isFinite(Date.parse(v))
    )
      throw new Error("Use an explicit timezone for scheduling.");
    return new Date(v).toISOString();
  };
  const startAt = stamp(o.startAt),
    endAt = stamp(o.endAt);
  if (startAt && endAt && startAt >= endAt)
    throw new Error("End time must be after start time.");
  return { startAt, endAt };
}
export function effectiveState(
  c: Pick<Campaign, "lifecycleStatus" | "startAt" | "endAt">,
  now: number,
): State {
  if (c.lifecycleStatus === "DRAFT" || c.lifecycleStatus === "ENDED")
    return c.lifecycleStatus;
  if (c.endAt && Date.parse(c.endAt) <= now) return "ENDED";
  if (c.startAt && Date.parse(c.startAt) > now) return "SCHEDULED";
  return "LIVE";
}
export function inWindow(s: Schedule, now: number) {
  return (
    (!s.startAt || Date.parse(s.startAt) <= now) &&
    (!s.endAt || Date.parse(s.endAt) > now)
  );
}
export function parseContent(kind: EditorialKind, value: unknown): Content {
  const o = object(value);
  const title = text(o.title, 100, true);
  if (kind === "campaigns") {
    keys(o, [
      "title",
      "internalDescription",
      "lifecycleStatus",
      "startAt",
      "endAt",
      "priority",
      "ctaLabel",
      "destination",
      "placements",
      "productIds",
      "sellerIds",
      "categoryIds",
      "bannerIds",
    ]);
    if (
      !["DRAFT", "SCHEDULED", "LIVE", "ENDED"].includes(
        String(o.lifecycleStatus),
      )
    )
      throw new Error("Invalid campaign state.");
    const placements = ids(o.placements).map((v) => {
      if (!SECTION_TYPES.includes(v as SectionType))
        throw new Error("Invalid placement.");
      return v as SectionType;
    });
    const categoryIds = ids(o.categoryIds);
    if (
      categoryIds.some(
        (v) => !CATEGORY_IDS.includes(v as (typeof CATEGORY_IDS)[number]),
      )
    )
      throw new Error("Invalid category.");
    return {
      title,
      internalDescription: text(o.internalDescription, 1000),
      lifecycleStatus: o.lifecycleStatus as State,
      ...schedule(o),
      priority: integer(o.priority),
      ctaLabel: text(o.ctaLabel, 60),
      destination: destination(o.destination),
      placements,
      productIds: ids(o.productIds),
      sellerIds: ids(o.sellerIds),
      categoryIds,
      bannerIds: ids(o.bannerIds, 4),
    };
  }
  if (kind === "banners") {
    keys(o, [
      "title",
      "placement",
      "assetId",
      "alt",
      "ctaLabel",
      "destination",
      "order",
      "enabled",
      "campaignId",
      "mobileAssetId",
      "startAt",
      "endAt",
    ]);
    if (
      ![
        "desktop_hero",
        "mobile_hero",
        "promo_strip",
        "secondary_card",
      ].includes(String(o.placement))
    )
      throw new Error("Invalid banner placement.");
    return {
      title,
      placement: o.placement as Banner["placement"],
      assetId: id(o.assetId),
      alt: text(o.alt, 180, true),
      ctaLabel: text(o.ctaLabel, 60),
      destination: destination(o.destination),
      order: integer(o.order),
      enabled: bool(o.enabled),
      campaignId: optionalId(o.campaignId),
      ...(o.mobileAssetId !== undefined
        ? { mobileAssetId: optionalId(o.mobileAssetId) }
        : {}),
      ...(o.startAt !== undefined || o.endAt !== undefined ? schedule(o) : {}),
    };
  }
  if (kind === "collections") {
    keys(o, [
      "title",
      "slug",
      "description",
      "productIds",
      "assetId",
      "active",
      "startAt",
      "endAt",
    ]);
    return {
      title,
      slug: id(o.slug),
      description: text(o.description, 500),
      productIds: ids(o.productIds),
      assetId: optionalId(o.assetId) ?? "",
      active: bool(o.active),
      ...schedule(o),
    };
  }
  if (kind === "announcements") {
    keys(o, ["title", "destination", "enabled", "order", "startAt", "endAt"]);
    return {
      title,
      destination: destination(o.destination),
      enabled: bool(o.enabled),
      order: integer(o.order),
      ...schedule(o),
    };
  }
  if (kind === "categories") {
    keys(o, ["title", "categories"]);
    if (
      !Array.isArray(o.categories) ||
      o.categories.length !== CATEGORY_IDS.length
    )
      throw new Error("Keep every existing category.");
    const categories = o.categories.map((v) => {
      const c = object(v);
      keys(c, ["id", "visible", "order", "featured"]);
      return {
        id: id(c.id),
        visible: bool(c.visible),
        order: integer(c.order),
        featured: bool(c.featured),
      };
    });
    if (
      new Set(categories.map((v) => v.id)).size !== CATEGORY_IDS.length ||
      categories.some(
        (v) => !CATEGORY_IDS.includes(v.id as (typeof CATEGORY_IDS)[number]),
      )
    )
      throw new Error("Invalid category configuration.");
    return { title, categories };
  }
  keys(o, ["title", "sections"]);
  if (!Array.isArray(o.sections) || o.sections.length > 16)
    throw new Error("Use at most 16 homepage sections.");
  const sections = o.sections.map((v) => {
    const s = object(v);
    keys(s, [
      "sectionId",
      "type",
      "enabled",
      "order",
      "title",
      "source",
      "productIds",
      "sellerIds",
      "categoryIds",
      "bannerIds",
      "collectionId",
      "announcementId",
      "campaignId",
      "startAt",
      "endAt",
    ]);
    if (
      !SECTION_TYPES.includes(s.type as SectionType) ||
      !["AUTOMATIC", "MANUAL", "CAMPAIGN"].includes(String(s.source))
    )
      throw new Error("Invalid section type/source.");
    if (s.source === "CAMPAIGN" && !s.campaignId)
      throw new Error("Select a campaign.");
    const categoryIds = ids(s.categoryIds);
    if (
      categoryIds.some(
        (v) => !CATEGORY_IDS.includes(v as (typeof CATEGORY_IDS)[number]),
      )
    )
      throw new Error("Invalid category.");
    if (
      s.source === "AUTOMATIC" &&
      ![
        "fresh",
        "hot",
        "under20",
        "ending",
        "near",
        "saved",
        "categories",
      ].includes(String(s.type))
    )
      throw new Error("This module needs manual references or a campaign.");
    return {
      sectionId: id(s.sectionId),
      type: s.type as SectionType,
      enabled: bool(s.enabled),
      order: integer(s.order),
      title: text(s.title, 100, true),
      source: s.source as Section["source"],
      productIds: ids(s.productIds),
      sellerIds: ids(s.sellerIds),
      categoryIds,
      bannerIds: ids(s.bannerIds, 4),
      collectionId: optionalId(s.collectionId),
      announcementId: optionalId(s.announcementId),
      campaignId: optionalId(s.campaignId),
      ...schedule(s),
    };
  });
  if (new Set(sections.map((v) => v.sectionId)).size !== sections.length)
    throw new Error("Use unique section IDs.");
  return { title, sections };
}
export function newContent(kind: EditorialKind): Content {
  const base = { title: "", startAt: null, endAt: null };
  if (kind === "campaigns")
    return {
      ...base,
      internalDescription: "",
      lifecycleStatus: "DRAFT",
      priority: 0,
      ctaLabel: "Explore",
      destination: "/explore",
      placements: ["hero"],
      productIds: [],
      sellerIds: [],
      categoryIds: [],
      bannerIds: [],
    };
  if (kind === "banners")
    return {
      title: "",
      placement: "desktop_hero",
      assetId: "",
      alt: "",
      ctaLabel: "Explore",
      destination: "/explore",
      order: 0,
      enabled: false,
      campaignId: null,
    };
  if (kind === "collections")
    return {
      ...base,
      slug: "",
      description: "",
      productIds: [],
      assetId: "",
      active: false,
    };
  if (kind === "announcements")
    return { ...base, destination: "", enabled: false, order: 0 };
  if (kind === "categories")
    return {
      title: "Marketplace categories",
      categories: CATEGORY_IDS.map((id, order) => ({
        id,
        visible: true,
        order,
        featured: false,
      })),
    };
  return {
    title: "Homepage",
    sections: ["hero", "categories", "fresh", "near", "ending"].map(
      (type, order) => ({
        sectionId: type,
        type: type as SectionType,
        enabled: true,
        order,
        title:
          type === "fresh"
            ? "Fresh Drops"
            : type === "ending"
              ? "Ending Soon"
              : type === "near"
                ? "Near You"
                : type === "hero"
                  ? "Discover TAKEME"
                  : "Categories",
        source: type === "hero" ? "MANUAL" : "AUTOMATIC",
        productIds: [],
        sellerIds: [],
        categoryIds: [],
        bannerIds: [],
        collectionId: null,
        announcementId: null,
        campaignId: null,
        startAt: null,
        endAt: null,
      }),
    ),
  };
}
export function malaysiaInput(value: string | null) {
  return value
    ? new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 16)
    : "";
}
export function malaysiaTimestamp(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Invalid Malaysia time.");
  const date = new Date(`${value}:00+08:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    malaysiaInput(date.toISOString()) !== value
  )
    throw new Error("Invalid Malaysia time.");
  return date.toISOString();
}

/** Legacy records keep their single artwork and campaign relationship. */
export function bannerState(
  b: Banner,
  now: number,
): "LIVE" | "SCHEDULED" | "INACTIVE" | "ENDED" {
  if (!b.enabled) return "INACTIVE";
  if (b.endAt && Date.parse(b.endAt) <= now) return "ENDED";
  if (b.startAt && Date.parse(b.startAt) > now) return "SCHEDULED";
  return "LIVE";
}
export function transitionBanner(
  b: Banner,
  action: string,
  now: number,
): Banner {
  const next = { ...b };
  if (action === "save") return next;
  if (action === "duplicate")
    return { ...next, enabled: false, startAt: null, endAt: null };
  if (action === "pause") return { ...next, enabled: false };
  if (action === "schedule") {
    if (
      !next.startAt ||
      Date.parse(next.startAt) <= now ||
      !next.endAt ||
      Date.parse(next.endAt) <= Date.parse(next.startAt)
    )
      throw new Error("Choose a future start and a later end time.");
    return { ...next, enabled: true };
  }
  if (action === "publish" || action === "activate")
    return {
      ...next,
      enabled: true,
      startAt: new Date(now).toISOString(),
      endAt: next.endAt && Date.parse(next.endAt) > now ? next.endAt : null,
    };
  throw new Error("Invalid banner action.");
}
/** Keep legacy placements intact; a new paired hero is one logical placement. */
export function placeBanner(
  home: Homepage,
  bannerId: string,
  b: Banner,
): Homepage {
  const sections = [...home.sections];
  if (!sections.some((s) => s.bannerIds.includes(bannerId)) && b.enabled) {
    const section: Section = {
      ...(newContent("homepage") as Homepage).sections[0]!,
      sectionId: "banner_" + bannerId,
      title: b.title,
      order: 0,
      bannerIds: [bannerId],
    };
    sections.unshift(section);
  }
  const match = /^\/#collection_([A-Za-z0-9_-]{1,128})$/.exec(b.destination);
  if (
    b.enabled &&
    match &&
    !sections.some((s) => s.sectionId === "collection_" + match[1])
  )
    sections.push({
      ...(newContent("homepage") as Homepage).sections[0]!,
      sectionId: "collection_" + match[1],
      type: "products",
      title: b.title,
      source: "MANUAL",
      collectionId: match[1]!,
    });
  if (sections.length > 16)
    throw new Error(
      "The homepage is full. Remove a section before adding another banner.",
    );
  return { ...home, sections: sections.map((s, order) => ({ ...s, order })) };
}
