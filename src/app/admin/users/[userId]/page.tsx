import { AdminRecordView } from "@/components/admin/admin-record";
export default async function Page({ params }: PageProps<"/admin/users/[userId]">) { const { userId } = await params; return <AdminRecordView section="users" id={userId} />; }
