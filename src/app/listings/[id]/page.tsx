import type { Metadata } from "next";
import { ListingDetailView } from "@/components/listings/listing-detail-view";

export const metadata: Metadata = { title: "Marketplace listing" };
type ListingPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export default async function ListingPage({ params, searchParams }: ListingPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <ListingDetailView id={id} created={query.created === "1"} />;
}
