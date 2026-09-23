import { AdminRecordView } from "@/components/admin/admin-record";
export default async function Page({ params }: PageProps<"/admin/reports/[reportId]">) { const { reportId } = await params; return <AdminRecordView section="reports" id={reportId} />; }
