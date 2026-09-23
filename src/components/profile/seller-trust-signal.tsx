import { PublicSellerSummary } from "@/components/profile/public-seller-summary";

export function SellerTrustSignal({ uid }: { uid: string }) {
  return <PublicSellerSummary uid={uid} variant="detail" />;
}
