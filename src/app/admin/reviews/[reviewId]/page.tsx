import { AdminRecordView } from "@/components/admin/admin-record";
export default async function Page({ params }: PageProps<"/admin/reviews/[reviewId]">) { const { reviewId } = await params; return <AdminRecordView section="reviews" id={reviewId} />; }
