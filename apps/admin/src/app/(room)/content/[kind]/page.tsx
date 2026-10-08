import { notFound } from "next/navigation";
import { BannerList, HomepageTabs } from "@admin/components/homepage-workspace";
import { ContentList } from "@admin/components/editorial";
import {
  EDITORIAL_KINDS,
  type EditorialKind,
} from "@contracts/editorial-domain";
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!EDITORIAL_KINDS.includes(kind as EditorialKind)) notFound();
  if (kind === "banners") return <BannerList />;
  return (
    <>
      {kind === "announcements" && <HomepageTabs selected="announcements" />}
      <ContentList key={kind} kind={kind as EditorialKind} />
    </>
  );
}
