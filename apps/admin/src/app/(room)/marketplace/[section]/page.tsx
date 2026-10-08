import { notFound } from "next/navigation";
import { MarketplaceTable } from "@admin/components/operations";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    !["listings", "auctions", "users", "sellers", "reports"].includes(section)
  )
    notFound();
  return <MarketplaceTable key={section} section={section} />;
}
