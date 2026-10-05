import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { PolicyContext } from "./policy-runtime";
import type { ReleasePolicy } from "./release-policy";

type PolicyVersions = { termsVersion: string; privacyVersion: string };
const baseFields = ["acceptanceId", "ownerId", "schemaVersion", "evidenceKind", "termsVersion", "privacyVersion", "minimumAgeConfirmed",
  "termsAcceptedAt", "privacyAcceptedAt", "ageConfirmedAt", "source"];
const validVersion = (value: unknown): value is string => typeof value === "string" && value.length > 0
  && value.length <= 256 && value === value.trim() && !/\s/.test(value);
const validTimestamp = (value: unknown): value is Timestamp => value instanceof Timestamp && Number.isFinite(value.toMillis());
const timestampIdentity = (value: Timestamp) => [value.seconds, value.nanoseconds];
const validUid = (uid: unknown): uid is string => typeof uid === "string" && !!uid && uid.length <= 128 && !uid.includes("/");
const validId = (id: unknown): id is string => typeof id === "string"
  && (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) || /^legacy-[a-f0-9]{64}$/.test(id));

/** Six document segments: private history is outside the frequently read current projection. */
export function policyAcceptancePath(uid: string, acceptanceId: string): string {
  if (!validUid(uid) || !validId(acceptanceId)) throw historyUnavailable();
  return `users/${uid}/private/policyAcceptances/events/${acceptanceId}`;
}
export function historyUnavailable(): HttpsError {
  return new HttpsError("failed-precondition", "Your previous policy acceptance needs review before continuing.",
    { reason: "policy-acceptance-history-invalid" });
}

/** Snapshot only evidence that already exists. Never invent original time or release provenance. */
export function legacyAcceptanceHistory(uid: string, value: DocumentData | undefined): DocumentData | null {
  if (!validUid(uid)) throw historyUnavailable();
  if (!value) return null;
  const hasEvidence = ["termsVersion", "privacyVersion", "termsAcceptedAt", "privacyAcceptedAt", "age18ConfirmedAt", "acceptanceSource", "acceptanceHistoryId"]
    .some(field => Object.hasOwn(value, field)) || value.revokedAt != null;
  if (!hasEvidence) return null;
  if (!validVersion(value.termsVersion) || !validVersion(value.privacyVersion) || value.acceptanceSource !== "web"
    || !validTimestamp(value.termsAcceptedAt) || !validTimestamp(value.privacyAcceptedAt) || !validTimestamp(value.age18ConfirmedAt)
    || (value.revokedAt != null && !validTimestamp(value.revokedAt))) throw historyUnavailable();
  const acceptanceId = "legacy-" + createHash("sha256").update(JSON.stringify(["takeme-web-policy-acceptance", 1, uid,
    value.termsVersion, value.privacyVersion, 18, timestampIdentity(value.termsAcceptedAt), timestampIdentity(value.privacyAcceptedAt),
    timestampIdentity(value.age18ConfirmedAt), value.revokedAt ? timestampIdentity(value.revokedAt) : null])).digest("hex");
  return { acceptanceId, ownerId: uid, schemaVersion: 1, evidenceKind: "legacy-current",
    termsVersion: value.termsVersion, privacyVersion: value.privacyVersion, minimumAgeConfirmed: 18,
    termsAcceptedAt: value.termsAcceptedAt, privacyAcceptedAt: value.privacyAcceptedAt, ageConfirmedAt: value.age18ConfirmedAt,
    source: "web", ...(value.revokedAt ? { revokedAt: value.revokedAt } : {}) };
}

/** Never repair/overwrite malformed or foreign immutable evidence. */
export function assertAcceptanceHistory(value: DocumentData, uid: string, acceptanceId: string, versions: PolicyVersions, context: PolicyContext): void {
  policyAcceptancePath(uid, acceptanceId);
  if (!value || Array.isArray(value) || value.acceptanceId !== acceptanceId || value.ownerId !== uid
    || value.schemaVersion !== 1 || !validVersion(versions.termsVersion) || !validVersion(versions.privacyVersion)
    || value.termsVersion !== versions.termsVersion || value.privacyVersion !== versions.privacyVersion
    || value.minimumAgeConfirmed !== 18 || value.source !== "web"
    || !validTimestamp(value.termsAcceptedAt) || !validTimestamp(value.privacyAcceptedAt) || !validTimestamp(value.ageConfirmedAt)) throw historyUnavailable();
  let fields: string[];
  if (value.evidenceKind === "web-acceptance") {
    fields = [...baseFields, "acceptedAt", "releaseTarget", "projectId", ...(Object.hasOwn(value, "reacceptanceAfterRevokedAt") ? ["reacceptanceAfterRevokedAt"] : [])];
    if (acceptanceId.startsWith("legacy-") || !validTimestamp(value.acceptedAt) || value.releaseTarget !== context.target
      || value.projectId !== context.projectId || !value.acceptedAt.isEqual(value.termsAcceptedAt)
      || !value.acceptedAt.isEqual(value.privacyAcceptedAt) || !value.acceptedAt.isEqual(value.ageConfirmedAt)
      || (Object.hasOwn(value, "reacceptanceAfterRevokedAt") && !validTimestamp(value.reacceptanceAfterRevokedAt))) throw historyUnavailable();
  } else if (value.evidenceKind === "legacy-current") {
    fields = [...baseFields, ...(Object.hasOwn(value, "revokedAt") ? ["revokedAt"] : [])];
    const legacy = legacyAcceptanceHistory(uid, { ...value, acceptanceSource: value.source, age18ConfirmedAt: value.ageConfirmedAt });
    if (legacy?.acceptanceId !== acceptanceId) throw historyUnavailable();
  } else throw historyUnavailable();
  if (Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) throw historyUnavailable();
}

/** Bind a history pointer to exactly the acceptance currently projected. */
export function assertProjectedAcceptance(value: DocumentData, previous: DocumentData): void {
  if (!validTimestamp(previous.termsAcceptedAt) || !validTimestamp(previous.privacyAcceptedAt) || !validTimestamp(previous.age18ConfirmedAt)
    || !value.termsAcceptedAt.isEqual(previous.termsAcceptedAt) || !value.privacyAcceptedAt.isEqual(previous.privacyAcceptedAt)
    || !value.ageConfirmedAt.isEqual(previous.age18ConfirmedAt) || (value.revokedAt && !previous.revokedAt)) throw historyUnavailable();
}

/** A server UUID is selected once per callable, and written atomically with its current pointer.
 * Valid retries reuse the committed pointer; version changes/revocation create new logical events. */
export function newAcceptanceHistory(uid: string, acceptanceId: string, policy: ReleasePolicy, context: PolicyContext, revokedAt?: Timestamp): DocumentData {
  policyAcceptancePath(uid, acceptanceId);
  const versions = policy as PolicyVersions;
  if (acceptanceId.startsWith("legacy-") || policy.publicationApproved !== true || policy.minimumAge !== 18
    || !validVersion(versions.termsVersion) || !validVersion(versions.privacyVersion) || (revokedAt !== undefined && !validTimestamp(revokedAt))) throw historyUnavailable();
  return { acceptanceId, ownerId: uid, schemaVersion: 1, evidenceKind: "web-acceptance",
    termsVersion: versions.termsVersion, privacyVersion: versions.privacyVersion, minimumAgeConfirmed: 18,
    termsAcceptedAt: FieldValue.serverTimestamp(), privacyAcceptedAt: FieldValue.serverTimestamp(), ageConfirmedAt: FieldValue.serverTimestamp(),
    acceptedAt: FieldValue.serverTimestamp(), source: "web", releaseTarget: context.target, projectId: context.projectId,
    ...(revokedAt ? { reacceptanceAfterRevokedAt: revokedAt } : {}) };
}
