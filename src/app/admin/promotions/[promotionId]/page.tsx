import { AdminRecordView } from "@/components/admin/admin-record";
export default async function Page({ params }: PageProps<"/admin/promotions/[promotionId]">) { const { promotionId } = await params; return <AdminRecordView section="promotions" id={promotionId} />; }
