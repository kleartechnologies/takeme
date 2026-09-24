import type { Metadata } from "next";
import { ListingDetailView } from "@/components/listings/listing-detail-view";

type ListingPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: "Marketplace listing", alternates: { canonical: `/listings/${encodeURIComponent(id)}` } };
}

export default async function ListingPage({ params, searchParams }: ListingPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <ListingDetailView id={id} created={query.created === "1"} />;
}
