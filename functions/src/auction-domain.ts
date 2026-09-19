export const MIN_AUCTION_DURATION_MS = 10 * 60 * 1000;
export const MAX_AUCTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_AUCTION_LEAD_MS = 90 * 24 * 60 * 60 * 1000;
export const MAX_MONEY_SEN = 1_000_000_000;

export interface AuctionSettings {
  startingBid: number;
  minimumBidIncrement: number;
  auctionStartAt: Date;
  auctionEndAt: Date;
}

export function validateMoneySen(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > MAX_MONEY_SEN) {
    return `${field} must be a positive whole number of sen.`;
  }
  return null;
}

export function validateAuctionSettings(settings: AuctionSettings, now = new Date()) {
  const errors: string[] = [];
  const startingBidError = validateMoneySen(settings.startingBid, "Starting bid");
  const incrementError = validateMoneySen(settings.minimumBidIncrement, "Minimum bid increment");
  if (startingBidError) errors.push(startingBidError);
  if (incrementError) errors.push(incrementError);
  if (!Number.isFinite(settings.auctionStartAt.getTime())) errors.push("Auction start is invalid.");
  if (!Number.isFinite(settings.auctionEndAt.getTime())) errors.push("Auction end is invalid.");
  if (errors.length) return errors;

  const start = settings.auctionStartAt.getTime();
  const end = settings.auctionEndAt.getTime();
  const duration = end - start;
  if (start < now.getTime() - 60_000) errors.push("Auction start cannot be in the past.");
  if (start > now.getTime() + MAX_AUCTION_LEAD_MS) errors.push("Auction start must be within 90 days.");
  if (end <= start) errors.push("Auction end must be after its start.");
  if (duration < MIN_AUCTION_DURATION_MS) errors.push("Auction duration must be at least 10 minutes.");
  if (duration > MAX_AUCTION_DURATION_MS) errors.push("Auction duration cannot exceed 30 days.");
  return errors;
}

export function minimumNextBid(startingBid: number, currentBid: number, bidCount: number, increment: number) {
  return bidCount === 0 ? startingBid : currentBid + increment;
}

export function validateBidAmount(amount: unknown, minimum: number) {
  const moneyError = validateMoneySen(amount, "Bid");
  if (moneyError) return moneyError;
  if (Number(amount) < minimum) return `Bid must be at least ${minimum} sen.`;
  return null;
}

export function effectiveAuctionStatus(
  storedStatus: "scheduled" | "active" | "ended" | "cancelled",
  startAt: Date,
  endAt: Date,
  now = new Date(),
) {
  if (storedStatus === "cancelled" || storedStatus === "ended") return storedStatus;
  if (now.getTime() >= endAt.getTime()) return "ended" as const;
  if (now.getTime() < startAt.getTime()) return "scheduled" as const;
  return "active" as const;
}
