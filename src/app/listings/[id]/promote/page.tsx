import type { Metadata } from "next";
import { PromotionFlow } from "@/components/promotions/promotion-flow";

export const metadata: Metadata = { title: "Promote your listing" };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> };

export default async function PromoteListingPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <main className="page-shell py-8 md:py-12"><PromotionFlow listingId={id} initialType={query.type === "featured" ? "featured" : "boost"} /></main>;
}
