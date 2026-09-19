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
  featured?: boolean;
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

export interface Favorite {
  id: string;
  userId: string;
  listingId: string;
  createdAt: string;
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
  favorites: Favorite;
  bids: Bid;
}
