export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export type ListingType = "buy_now" | "auction" | "buy_now_and_auction";
export type ListingStatus = "draft" | "active" | "sold" | "ended" | "removed";
export type ListingCondition = "New" | "Like new" | "Good" | "Fair";
export type AuctionStatus = "scheduled" | "active" | "ended" | "cancelled";

export interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  categoryId: string;
  condition: ListingCondition;
  price: number;
  listingType: ListingType;
  location: string;
  latitude?: number;
  longitude?: number;
  imageUrls: string[];
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
  auctionStartAt?: string;
  auctionEndAt?: string;
  startingBid?: number;
  currentBid?: number;
  currentBidderId?: string | null;
  bidCount?: number;
  minimumBidIncrement?: number;
  auctionStatus?: AuctionStatus;
  winnerId?: string | null;
  finalBid?: number | null;
  endedAt?: string | null;
  searchTokens?: string[];
  facetKeys?: string[];
  locationKey?: string;
}

export interface BaseListingInput {
  title: string;
  description: string;
  categoryId: string;
  condition: ListingCondition;
  location: string;
  latitude?: number;
  longitude?: number;
}

export interface BuyNowListingInput extends BaseListingInput {
  listingType: "buy_now";
  price: number;
}

export interface AuctionListingInput extends BaseListingInput {
  listingType: "auction";
  startingBid: number;
  minimumBidIncrement: number;
  auctionStartAt: string;
  auctionEndAt: string;
}

export type ListingInput = BuyNowListingInput | AuctionListingInput;

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface SavedListing {
  listingId: string;
  savedAt: string;
  listing: Listing | null;
}

export type TransactionType = "buy_now" | "offer" | "auction";
export type TransactionStatus = "in_progress" | "completed" | "cancelled" | "disputed";
export type PaymentMethod = "cod" | "bank_transfer" | "external" | "other" | "protected";
export type SettlementMode = "standard" | "protected";
export type ProtectedPaymentStatus = "not_required" | "pending" | "requires_action" | "authorized" | "protected" | "failed" | "refunded" | "partially_refunded" | "released" | "cancelled";
export type PayoutStatus = "not_eligible" | "eligible" | "processing" | "paid" | "failed" | "reversed";
export type RefundStatus = "none" | "requested" | "pending" | "approved" | "processing" | "refunded" | "failed" | "partially_refunded" | "cancelled";
export type SellerOnboardingStatus = "not_started" | "pending" | "restricted" | "active" | "disabled";
export type ProtectedDisputeStatus = "open" | "awaiting_buyer" | "awaiting_seller" | "under_review" | "resolved_buyer" | "resolved_seller" | "partially_resolved" | "cancelled";
export type OfferStatus = "submitted" | "countered" | "accepted" | "rejected" | "withdrawn" | "expired";

export interface MarketplaceOffer {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  type: "buy_now" | "offer";
  status: OfferStatus;
  proposedAmountSen: number;
  quotedAmountSen: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
  transactionId: string | null;
}

export interface MarketplaceTransaction {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerId: string;
  sellerId: string;
  type: TransactionType;
  sourceId: string;
  status: TransactionStatus;
  amountSen: number;
  currency: "MYR";
  paymentMethod: PaymentMethod;
  settlementMode: SettlementMode;
  paymentProvider: "none" | "stripe_connect";
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  reviewWindowEndAt: string | null;
  reviewsVisibleAt: string | null;
  cancellationRequestedBy: string | null;
  cancellationReason: string | null;
  disputeReason: string | null;
}

export interface ProtectedPaymentSummary {
  provider: "stripe_connect";
  status: ProtectedPaymentStatus;
  protectedAmountSen: number;
  currency: "MYR";
  platformFeeSen: number | null;
  sellerNetAmountSen: number | null;
  paidAt: string | null;
  protectedAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
}

export interface ProtectedPayoutSummary { status: PayoutStatus; amountSen: number | null; eligibleAt: string | null; paidAt: string | null }
export interface ProtectedRefundSummary { id: string; status: RefundStatus; amountSen: number; reason: string; requestedAt: string | null; refundedAt: string | null }
export interface ProtectedDisputeSummary {
  id: string; status: ProtectedDisputeStatus; reason: string; description: string; openedBy: string; openedAt: string | null;
  sellerResponse: string | null; resolution: string | null; resolvedAt: string | null; refundAmountSen: number | null;
  evidence: { id: string; actorRole: "buyer" | "seller"; note: string; createdAt: string | null }[];
}
export interface ProtectedTimelineEvent { id: string; eventType: string; actorType: "buyer" | "seller" | "admin" | "provider" | "system"; createdAt: string | null; metadata: Record<string, string | number | boolean | null> }
export interface ProtectedTransactionDetail {
  payment: ProtectedPaymentSummary | null;
  payout: ProtectedPayoutSummary | null;
  refunds: ProtectedRefundSummary[];
  dispute: ProtectedDisputeSummary | null;
  timeline: ProtectedTimelineEvent[];
}

export interface SellerPaymentOnboarding {
  enabled: boolean; provider: "stripe_connect"; status: SellerOnboardingStatus; chargesEnabled: boolean; payoutsEnabled: boolean;
  requirementsStatus: string; lastCheckedAt: string | null; message: string;
}

export interface TransactionReview {
  transactionId: string;
  buyerId: string;
  sellerId: string;
  reviewerId: string;
  reviewedUserId: string;
  reviewerRole: "buyer" | "seller";
  rating: number;
  tags: string[];
  comment: string;
  createdAt: string;
}

export interface PublicReview {
  id: string;
  reviewerRole: "buyer" | "seller";
  rating: number;
  tags: string[];
  comment: string;
  createdAt: string;
}

export type ReputationTier = "bronze" | "silver" | "gold" | "platinum";
export interface RoleReputation {
  completedCount: number;
  tier: ReputationTier | null;
  reviewCount: number;
  ratingSum: number;
  averageRating: number | null;
  ratingDistribution: Record<string, number>;
}

export interface TrustSummary {
  userId: string;
  verificationStatus: "unverified" | "verified";
  buyer: RoleReputation;
  seller: RoleReputation;
  updatedAt: string;
}

export interface PublicSellerSummary {
  uid: string;
  displayName: string;
  photoURL: string | null;
  sellerRating: number | null;
  sellerReviewCount: number;
  sellerCompletedTransactionCount: number;
  sellerTier: ReputationTier | null;
  verificationStatus: "unverified" | "verified";
}

export interface Conversation {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  participants: [string, string];
  latestMessage: { id: string; senderId: string; body: string; createdAt: string } | null;
  unreadBy: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export type ReportReason = "spam" | "misleading" | "prohibited_item" | "counterfeit" | "wrong_category" | "suspicious_behavior" | "harassment" | "fraud_concern" | "other";
export type ReportTargetType = "listing" | "user" | "conversation" | "message";
export type ReportStatus = "submitted" | "reviewing" | "resolved" | "dismissed";

export interface MarketplaceReport {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Bid {
  id: string;
  listingId: string;
  bidderId: string;
  amount: number;
  createdAt: string;
}

export interface MarketplaceEntityMap {
  users: UserProfile;
  listings: Listing;
  categories: Category;
  bids: Bid;
}
