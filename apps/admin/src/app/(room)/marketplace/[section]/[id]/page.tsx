import { notFound } from "next/navigation";
import { MarketplaceRecord } from "@admin/components/operations";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { section, id } = await params;
  if (
    !["listings", "auctions", "users", "sellers", "reports"].includes(
      section,
    ) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id)
  )
    notFound();
  return (
    <MarketplaceRecord key={`${section}/${id}`} section={section} id={id} />
  );
}
