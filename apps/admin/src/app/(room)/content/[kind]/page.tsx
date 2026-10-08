import { notFound } from "next/navigation";
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
  return <ContentList key={kind} kind={kind as EditorialKind} />;
}
