import { isLegalCalendarDate } from "./legal-publication.ts";

export type LegalLaunchDatePlan = Readonly<
  | { status: "pending"; effectiveDate: null; lastUpdated: null }
  | { status: "prepared-not-applied"; effectiveDate: string; lastUpdated: string }
>;

/** Prepare the shared V1 date pair only. This grants no approval and applies no source or runtime change. */
export function planLegalLaunchDate(value: unknown): LegalLaunchDatePlan {
  if (value === null || value === undefined) {
    return Object.freeze({ status: "pending", effectiveDate: null, lastUpdated: null });
  }
  if (!isLegalCalendarDate(value)) {
    throw new Error("Legal launch-date preparation requires an exact valid calendar date (YYYY-MM-DD).");
  }
  return Object.freeze({ status: "prepared-not-applied", effectiveDate: value, lastUpdated: value });
}
