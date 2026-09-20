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

export type TransactionType = "buy_now" | "auction";
export type TransactionStatus = "pending" | "completed" | "cancelled";

export interface MarketplaceTransaction {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  type: TransactionType;
  status: TransactionStatus;
  agreedAmountSen: number;
  currency: "MYR";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface TransactionReview {
  transactionId: string;
  buyerId: string;
  sellerId: string;
  reviewerId: string;
  reviewedUserId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface TrustSummary {
  userId: string;
  verificationStatus: "unverified" | "verified";
  completedSellerTransactions: number;
  reviewCount: number;
  ratingSum: number;
  reputationLevel: "bronze" | "silver" | "gold" | "platinum" | null;
  updatedAt: string;
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
