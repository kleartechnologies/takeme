"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePublicAuth } from "@/components/auth/auth-provider";
import { ListingCard } from "@/components/listings/listing-card";
import { getActiveListings } from "@/lib/services/listings";
import { getSavedPage } from "@/lib/services/saved";
import { getMarketplaceDiscovery } from "@/lib/services/intelligence";
import type { Listing } from "@/types/marketplace";
export function EditorialAutomatic({
  type,
  title,
}: {
  type: "under20" | "hot" | "saved";
  title: string;
}) {
  const { user, loading } = usePublicAuth();
  const [items, setItems] = useState<{
    uid: string | null;
    items: Listing[];
  } | null>(null);
  const uid = type === "under20" ? null : !loading ? user?.uid : null;
  useEffect(() => {
    if (type !== "under20" && !uid) return;
    let active = true;
    const request =
      type === "under20"
        ? getActiveListings({
            maxPrice: 20,
            listingType: "buy_now",
            pageSize: 8,
          }).then((v) => v.listings)
        : type === "saved"
          ? getSavedPage(null, 4).then((v) =>
              v.items.flatMap((item) =>
                item.listing && item.listing.status === "active"
                  ? [item.listing]
                  : [],
              ),
            )
          : getMarketplaceDiscovery("popular").then((v) =>
              v.sections
                .flatMap((s) => s.listings.map((v) => v.listing))
                .slice(0, 8),
            );
    void request
      .then((value) => {
        if (active) setItems({ uid: uid ?? null, items: value });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [type, uid]);
  const visible = items?.uid === (uid ?? null) ? items.items : [];
  if (!visible.length) return null;
  return (
    <section className="discovery-section">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <Link
          className="action-link"
          href={
            type === "saved"
              ? "/saved"
              : type === "under20"
                ? "/explore?maxPrice=20"
                : "/explore"
          }
        >
          See all
        </Link>
      </div>
      <div className="home-product-grid">
        {visible.map((listing) => (
          <ListingCard key={listing.id} listing={listing} variant="discovery" />
        ))}
      </div>
    </section>
  );
}
