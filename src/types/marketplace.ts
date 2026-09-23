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
export type PaymentMethod = "cod" | "bank_transfer" | "external" | "other";
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

export type ReportReason = "spam" | "misleading" | "prohibited_item" | "harassment" | "fraud_concern" | "other";
export type ReportTargetType = "listing" | "user";
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
