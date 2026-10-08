import type { Metadata } from "next";
import { ListingDetailView } from "@/components/listings/listing-detail-view";
import { getPublicProductSnapshot } from "@/lib/firebase/public-catalogue-server";
import { buildListingMetadata } from "@/lib/listing-metadata";

type ListingPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { id } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return buildListingMetadata(id, (await getPublicProductSnapshot(id))?.listing ?? null, siteUrl);
}

export default async function ListingPage({ params, searchParams }: ListingPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const snapshot = await getPublicProductSnapshot(id);
  return <ListingDetailView key={id} id={id} initialListing={snapshot?.listing} initialBids={snapshot?.bids} created={query.created === "1"} />;
}
