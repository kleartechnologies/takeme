import { notFound } from "next/navigation";
import {
  BannerEditor,
  HomepageSections,
  HomepageTabs,
} from "@admin/components/homepage-workspace";
import { ContentEditor } from "@admin/components/editorial";
import {
  EDITORIAL_KINDS,
  type EditorialKind,
} from "@contracts/editorial-domain";
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (
    !EDITORIAL_KINDS.includes(kind as EditorialKind) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id)
  )
    notFound();
  if (kind === "banners") return <BannerEditor key={id} recordId={id} />;
  if (kind === "homepage" && id === "current") return <HomepageSections />;
  return (
    <>
      {kind === "announcements" && <HomepageTabs selected="announcements" />}
      <ContentEditor
        key={`${kind}/${id}`}
        kind={kind as EditorialKind}
        recordId={id}
      />
    </>
  );
}
