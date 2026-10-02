import type { Metadata } from "next";
import { MyListingsView } from "@/components/profile/my-listings-view";
export const metadata: Metadata = { title: "My Listings" };
type Props = { searchParams: Promise<{ tab?: string; type?: string }> };
export default async function MyListingsPage({ searchParams }: Props) {
  const query = await searchParams;
  const tab = query.tab === "sold" || query.tab === "drafts" || query.tab === "past" ? query.tab : "active";
  return <main className="page-shell profile-system"><MyListingsView key={`${tab}-${query.type}`} initialTab={tab} auctionOnly={query.type === "auction"} /></main>;
}
