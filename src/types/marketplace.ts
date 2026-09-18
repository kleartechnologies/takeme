export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export type ListingType = "buy_now" | "auction";
export type ListingStatus = "draft" | "active" | "sold" | "ended" | "removed";
export type ListingCondition = "New" | "Like new" | "Good" | "Fair";

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
  currentBid?: number;
  bidCount?: number;
  endsAt?: string;
  featured?: boolean;
  searchTokens?: string[];
  facetKeys?: string[];
  locationKey?: string;
}

export interface ListingInput {
  title: string;
  description: string;
  categoryId: string;
  condition: ListingCondition;
  price: number;
  listingType: "buy_now";
  location: string;
  latitude?: number;
  longitude?: number;
}

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

export interface Auction {
  id: string;
  listingId: string;
  sellerId: string;
  startingPrice: number;
  currentBid: number;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "active" | "ended" | "cancelled";
}

export interface Bid {
  id: string;
  auctionId: string;
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
  auctions: Auction;
  bids: Bid;
}
