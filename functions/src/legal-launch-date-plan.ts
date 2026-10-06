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

export const legalLaunchDateInput = "TAKEME_V1_LAUNCH_DATE";
export const v1LegalDocumentIds = ["terms", "privacyEn", "privacyBm", "prohibitedItems"] as const;
export type V1LegalDocumentId = typeof v1LegalDocumentIds[number];
export type V1LegalDates = Readonly<Record<V1LegalDocumentId, Readonly<{ effectiveDate: string | null; lastUpdated: string | null }>>>;

/** The named owner input is the only proposal source. No clock, draft or staging fallback. */
export function planV1LegalDates(inputs: Readonly<Record<string, unknown>>) {
  const dates = planLegalLaunchDate(inputs[legalLaunchDateInput]);
  const documents = Object.freeze(Object.fromEntries(v1LegalDocumentIds.map(id => [id, Object.freeze({
    effectiveDate: dates.effectiveDate, lastUpdated: dates.lastUpdated,
  })])) as V1LegalDates);
  return Object.freeze({ input: legalLaunchDateInput, status: dates.status, documents });
}

export function validateV1LegalDates(documents: V1LegalDates, ownerDate: unknown): string[] {
  const dates = planLegalLaunchDate(ownerDate);
  if (dates.status === "pending") return ["The owner-approved actual public launch date is required."];
  const issues: string[] = [];
  if (Object.keys(documents).length !== v1LegalDocumentIds.length) issues.push("Exactly four V1 legal documents are required.");
  for (const id of v1LegalDocumentIds) {
    if (documents[id]?.effectiveDate !== dates.effectiveDate || documents[id]?.lastUpdated !== dates.lastUpdated) {
      issues.push(`${id}: both source dates must equal the owner-approved launch date.`);
    }
  }
  return issues;
}

/** Return a review proposal only. Never write source, change approval flags or invoke deployment. */
export function prepareV1LegalDateSource(source: string, inputs: Readonly<Record<string, unknown>>) {
  const plan = planV1LegalDates(inputs);
  if (plan.status === "pending") throw new Error(`${legalLaunchDateInput} must be supplied explicitly for a source-date proposal.`);
  const blocks = [...source.matchAll(/export const legalPublicationReadiness:[\s\S]*?Object\.freeze\(\{[\s\S]*?\}\);/g)];
  const block = blocks[0]?.[0];
  const pendingPair = "effectiveDate: null, lastUpdated: null";
  if (blocks.length !== 1 || !block?.includes("publicationApproved: false") || block.split(pendingPair).length !== 2) {
    throw new Error("Source-date preparation requires the reviewed unpublished, unresolved central source; review changes rather than overwriting it.");
  }
  const date = plan.documents.terms.effectiveDate;
  const replacement = `effectiveDate: ${JSON.stringify(date)}, lastUpdated: ${JSON.stringify(date)}`;
  return Object.freeze({ ...plan, sourcePath: "functions/src/legal-publication.ts", before: pendingPair, after: replacement,
    proposedSource: source.replace(block, block.replace(pendingPair, replacement)), applied: false });
}
