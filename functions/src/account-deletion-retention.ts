import { Timestamp } from "firebase-admin/firestore";

/** Calendar months, clamping leap/month-end dates without extending into the next month. */
export function monthsAfter(date: Timestamp, months: number) {
  const value = date.toDate();
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const last = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, last));
  return Timestamp.fromDate(value);
}
