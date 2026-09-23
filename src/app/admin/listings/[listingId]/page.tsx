import { AdminRecordView } from "@/components/admin/admin-record";
export default async function Page({ params }: PageProps<"/admin/listings/[listingId]">) { const { listingId } = await params; return <AdminRecordView section="listings" id={listingId} />; }
