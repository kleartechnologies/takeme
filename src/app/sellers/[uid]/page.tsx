import { SellerProfileView } from "@/components/profile/seller-profile-view";
type SellerPageProps = { params: Promise<{ uid: string }> };
export default async function SellerPage({ params }: SellerPageProps) { const { uid } = await params; return <main className="page-shell py-8 md:py-12"><SellerProfileView uid={uid} /></main>; }
