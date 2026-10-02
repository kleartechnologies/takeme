import type { Metadata } from "next";
import { SellerProfileView } from "@/components/profile/seller-profile-view";
type SellerPageProps = { params: Promise<{ uid: string }> };
export async function generateMetadata({ params }: SellerPageProps): Promise<Metadata> { const { uid } = await params; return { title: "Seller profile", alternates: { canonical: `/sellers/${encodeURIComponent(uid)}` } }; }
export default async function SellerPage({ params }: SellerPageProps) { const { uid } = await params; return <main className="page-shell profile-system"><SellerProfileView uid={uid} /></main>; }
