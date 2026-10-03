import { marketplaceCallable } from "@/lib/services/marketplace-call";
import { auth, functions } from "@/lib/firebase/client";
import type { MarketplaceOffer, MarketplaceTransaction, PaymentMethod, ProtectedTransactionDetail, PublicReview, ReputationTier, SellerPaymentOnboarding } from "@/types/marketplace";

function service(authenticated = true) {
  if (!functions) throw new Error("Transaction service is not configured.");
  if (authenticated && !auth?.currentUser) throw new Error("Sign in to manage a transaction.");
  return functions;
}
async function invoke<T>(name: string, payload: Record<string, unknown> = {}, authenticated = true): Promise<T> {
  return (await marketplaceCallable<Record<string, unknown>, T>(service(authenticated), name)(payload)).data;
}

export interface ReputationPolicy {
  thresholds: Record<ReputationTier, number>;
  reviewWindowDays: number;
  buyerToSellerTags: string[];
  sellerToBuyerTags: string[];
}
export const getReputationPolicy = () => invoke<ReputationPolicy>("getReputationPolicy", {}, false);
export const submitOffer = (listingId: string, type: "buy_now" | "offer", paymentMethod: PaymentMethod, amountSen?: number) => invoke<{ offerId: string; status: string }>("submitOffer", { listingId, type, paymentMethod, ...(amountSen === undefined ? {} : { amountSen }) });
export const respondToOffer = (offerId: string, action: "accept" | "reject" | "counter" | "withdraw", amountSen?: number) => invoke<{ status: string; transactionId?: string }>("respondToOffer", { offerId, action, ...(amountSen === undefined ? {} : { amountSen }) });
export const getListingDealState = (listingId: string) => invoke<{ offers: MarketplaceOffer[]; transaction: MarketplaceTransaction | null }>("getListingDealState", { listingId });
export const getMyTransactions = () => invoke<{ transactions: MarketplaceTransaction[] }>("getMyTransactions").then((data) => data.transactions);
export const getTransactionDetail = (transactionId: string) => invoke<{ transaction: MarketplaceTransaction; reviewed: boolean } & ProtectedTransactionDetail>("getTransactionDetail", { transactionId });
export const confirmTransactionCompletion = (transactionId: string) => invoke<{ status: string; alreadyConfirmed: boolean }>("confirmTransactionCompletion", { transactionId });
export const requestTransactionCancellation = (transactionId: string, reason: string) => invoke<{ status: string }>("requestTransactionCancellation", { transactionId, reason });
export const declineTransactionCancellation = (transactionId: string) => invoke<{ status: string }>("declineTransactionCancellation", { transactionId });
export const disputeTransaction = (transactionId: string, reason: string) => invoke<{ status: string }>("disputeTransaction", { transactionId, reason });
export const submitTransactionReview = (transactionId: string, rating: number, tags: string[], comment: string) => invoke<{ submitted: boolean; visible: boolean }>("submitTransactionReview", { transactionId, rating, tags, comment });
export const getPublicReviews = (userId: string, sellerOnly = false) => invoke<{ reviews: PublicReview[] }>("getPublicReviews", { userId, sellerOnly }, false).then((data) => data.reviews);
export const reportPublicReview = (reviewId: string, reason: string, details: string) => invoke<{ submitted: boolean }>("reportPublicReview", { reviewId, reason, details });
export const getProtectedPaymentPolicy = () => invoke<{ enabled: false; provider: "stripe_connect"; implementationReady: false; message: string; legalNotice: string }>("getProtectedPaymentPolicy", {}, false);
export const getSellerPaymentOnboarding = () => invoke<SellerPaymentOnboarding>("getSellerPaymentOnboarding");
export const createProtectedPayment = (transactionId: string) => invoke<never>("createProtectedPayment", { transactionId });
export const respondToProtectedDispute = (transactionId: string, response: string) => invoke<{ status: string; alreadyRecorded: boolean }>("respondToProtectedDispute", { transactionId, response });
export const addProtectedDisputeEvidence = (transactionId: string, note: string, idempotencyKey: string) => invoke<{ evidenceId: string; alreadyRecorded: boolean }>("addProtectedDisputeEvidence", { transactionId, note, idempotencyKey });
