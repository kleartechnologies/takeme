import { AdminRecordView } from "@/components/admin/admin-record";
export default async function Page({ params }: PageProps<"/admin/transactions/[transactionId]">) { const { transactionId } = await params; return <AdminRecordView section="transactions" id={transactionId} />; }
