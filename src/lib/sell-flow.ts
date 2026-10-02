import type { ListingCondition, ListingInput } from '../types/marketplace';
import { categories } from '../data/categories.ts';
import { makePublicLocation, MALAYSIAN_STATES } from './general-location.ts';
import { LISTING_CONDITIONS, MAX_AUCTION_DURATION_MS, MAX_AUCTION_LEAD_MS, MIN_AUCTION_DURATION_MS, ringgitToSen } from './listing-validation.ts';

export interface SellValues {
  title: string; categoryId: string; condition: ListingCondition; description: string; price: string;
  districtOrCity: string; state: string; meetupLocationId: string; saveLocationToProfile: boolean;
  listingType: 'buy_now' | 'auction'; startingBid: string; minimumBidIncrement: string;
  auctionStartAt: string; auctionEndAt: string; startMode: 'now' | 'scheduled';
}
export const SELL_STEPS = ['Listing type', 'Photos', 'Category', 'Details', 'Condition', 'Pricing', 'Meet-up & location', 'Preview'] as const;
export type SellErrors = Partial<Record<keyof SellValues, string>>;

/** Presentation validation mirrors the existing listing/callable contract. */
export function validateSellStep(values: SellValues, step: number, now = Date.now()): SellErrors {
  const errors: SellErrors = {};
  if (step === 0 && !['buy_now', 'auction'].includes(values.listingType)) errors.listingType = 'Choose how you want to sell.';
  if (step === 2 && !categories.some(category => category.id === values.categoryId)) errors.categoryId = 'Choose a category.';
  if (step === 3) {
    if (values.title.trim().length < 6 || values.title.trim().length > 80) errors.title = 'Use between 6 and 80 characters.';
    if (values.description.trim().length < 20 || values.description.trim().length > 1200) errors.description = 'Share between 20 and 1,200 characters.';
  }
  if (step === 4 && !LISTING_CONDITIONS.includes(values.condition)) errors.condition = 'Choose a condition.';
  if (step === 5) {
    if (values.listingType === 'buy_now') {
      if (ringgitToSen(values.price) === null) errors.price = 'Enter a positive MYR price with up to 2 decimal places (maximum RM10,000,000).';
    } else {
      if (ringgitToSen(values.startingBid) === null) errors.startingBid = 'Enter a positive starting bid with up to 2 decimal places (maximum RM10,000,000).';
      if (ringgitToSen(values.minimumBidIncrement) === null) errors.minimumBidIncrement = 'Enter a positive increment with up to 2 decimal places (maximum RM10,000,000).';
      const start = values.startMode === 'now' ? now : Date.parse(values.auctionStartAt);
      const end = Date.parse(values.auctionEndAt);
      if (!Number.isFinite(start)) errors.auctionStartAt = 'Choose a valid start time.';
      else if (start < now - 60_000) errors.auctionStartAt = 'Choose a start time that is not in the past.';
      else if (start > now + MAX_AUCTION_LEAD_MS) errors.auctionStartAt = 'Schedule within the next 90 days.';
      if (!Number.isFinite(end)) errors.auctionEndAt = 'Choose a valid end time.';
      else if (Number.isFinite(start)) {
        if (end <= start) errors.auctionEndAt = 'Auction end time must be after its start time.';
        else if (end - start < MIN_AUCTION_DURATION_MS) errors.auctionEndAt = 'Auction duration must be at least 10 minutes.';
        else if (end - start > MAX_AUCTION_DURATION_MS) errors.auctionEndAt = 'Auction duration cannot exceed 30 days.';
      }
    }
  }
  if (step === 6) {
    if (!makePublicLocation(values.districtOrCity, 'Kedah')) errors.districtOrCity = values.districtOrCity.trim() ? 'Use a general district or city, without a street address.' : 'Add your district or city.';
    if (!(MALAYSIAN_STATES as readonly string[]).includes(values.state)) errors.state = 'Choose a Malaysian state.';
  }
  return errors;
}
export function sellInput(values: SellValues, now = Date.now()): ListingInput {
  const publicLocation = makePublicLocation(values.districtOrCity, values.state);
  if (!publicLocation) throw new Error('Please add your general location.');
  const base = { title: values.title.trim(), description: values.description.trim(), categoryId: values.categoryId, condition: values.condition, publicLocation, meetupLocationId: values.meetupLocationId || null };
  return values.listingType === 'auction' ? { ...base, listingType: 'auction', startingBid: ringgitToSen(values.startingBid)!, minimumBidIncrement: ringgitToSen(values.minimumBidIncrement)!, auctionStartAt: new Date(values.startMode === 'now' ? now : values.auctionStartAt).toISOString(), auctionEndAt: new Date(values.auctionEndAt).toISOString() } : { ...base, listingType: 'buy_now', price: Number(values.price) };
}
