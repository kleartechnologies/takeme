import { createHash, randomUUID } from "node:crypto";
import { productionEnvironment } from "./production-environment";
import { stagingFirebaseProjectId } from "./staging-environment";

export const MESSAGE_REQUEST_RETENTION_MS = 24 * 60 * 60_000;
export const LEGACY_MESSAGE_MAX_WINDOW_MS = 7 * 24 * 60 * 60_000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
type LegacyMessageRuntime = { env: Record<string, string | undefined>; appProjectId?: string };

/** Missing keys are tolerated only in an explicitly selected, finite server window. */
export function legacyMessageTransitionUntil({ env, appProjectId }: LegacyMessageRuntime, nowMs = Date.now()): number | null {
  if (env.TAKEME_ENABLE_LEGACY_MESSAGE_SEND !== "true" || !Number.isFinite(nowMs)) return null;
  const target = env.TAKEME_RELEASE_TARGET;
  const expectedProject = target === "production" ? productionEnvironment.projectId
    : target === "staging" ? stagingFirebaseProjectId : target === "demo" ? "demo-takeme" : null;
  if (!expectedProject || appProjectId !== expectedProject || env.TAKEME_FIREBASE_PROJECT_ID !== expectedProject) return null;
  const projects = [env.GCLOUD_PROJECT, env.GOOGLE_CLOUD_PROJECT, env.GCP_PROJECT].filter(value => value !== undefined);
  if (!projects.length || projects.some(value => value !== expectedProject)) return null;
  if (env.FIREBASE_CONFIG !== undefined) {
    try {
      const config = JSON.parse(env.FIREBASE_CONFIG);
      if (!config || typeof config !== "object" || Array.isArray(config)
        || config.projectId !== undefined && config.projectId !== expectedProject) return null;
    } catch { return null; }
  }
  if (target === "demo") {
    if (env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" || env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080"
      || env.FIREBASE_STORAGE_EMULATOR_HOST !== undefined && env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9199") return null;
  } else if (Object.keys(env).some(name => /EMULATOR|EMULATORS/.test(name)
    && !(name === "NEXT_PUBLIC_USE_FIREBASE_EMULATORS" && env[name] === "false"))) return null;
  const raw = env.TAKEME_LEGACY_MESSAGE_SEND_UNTIL;
  if (!raw || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw)) return null;
  const until = Date.parse(raw);
  const canonical = raw.includes(".") ? raw : raw.replace(/Z$/, ".000Z");
  if (!Number.isFinite(until) || new Date(until).toISOString() !== canonical
    || nowMs < until - LEGACY_MESSAGE_MAX_WINDOW_MS || nowMs >= until) return null;
  return until;
}

export function normalizeMessageBody(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a message.");
  const body = value.trim().replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n");
  if (!body || body.length > 2000) throw new Error("Message must be 1–2000 characters.");
  return body;
}

export function messageRequestIdentity(senderId: string, conversationId: string, key: unknown, body: string) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new Error("A valid message request is required. Please try again.");
  // JSON framing prevents ambiguity between independently controlled scope parts.
  const requestId = digest(JSON.stringify([senderId, conversationId, "send-message", key]));
  return { requestId, messageId: `m_${requestId}`, bodyHash: digest(body) };
}

export function messageRequestIdentityForSend(senderId: string, conversationId: string, data: Record<string, unknown>,
  body: string, runtime: LegacyMessageRuntime, nowMs = Date.now()) {
  // An explicit invalid/null/empty key is never converted into a legacy request.
  if (Object.prototype.hasOwnProperty.call(data, "idempotencyKey")) {
    return { ...messageRequestIdentity(senderId, conversationId, data.idempotencyKey, body), legacyUntilMs: null };
  }
  const until = legacyMessageTransitionUntil(runtime, nowMs);
  if (until === null) return { ...messageRequestIdentity(senderId, conversationId, undefined, body), legacyUntilMs: null };
  // Assigned once per callable invocation, before transaction retries. Separate
  // old-client HTTP retries are distinct sends: there is no client request key
  // to deduplicate them without collapsing intentional identical messages.
  return { ...messageRequestIdentity(senderId, conversationId, randomUUID(), body), legacyUntilMs: until };
}

export function assertMessageTransitionStillActive(identity: ReturnType<typeof messageRequestIdentityForSend>, nowMs: number) {
  if (identity.legacyUntilMs !== null && (!Number.isFinite(nowMs) || nowMs >= identity.legacyUntilMs)) {
    throw new Error("This older app version can no longer send messages. Refresh TAKEME and try again.");
  }
}

/** A removed/expired private receipt never makes an existing message a new send. */
export function messageRetryDecision(message: Record<string, unknown> | undefined, receipt: Record<string, unknown> | undefined,
  senderId: string, body: string, identity: ReturnType<typeof messageRequestIdentity>): "new" | "retry" {
  if (receipt && (receipt.messageId !== identity.messageId || receipt.bodyHash !== identity.bodyHash)) {
    throw new Error("This message request has already been used for different content.");
  }
  if (message) {
    if (message.senderId !== senderId || message.body !== body) throw new Error("This message request has already been used for different content.");
    return "retry";
  }
  if (receipt) throw new Error("The original message is unavailable. Please refresh the conversation.");
  return "new";
}
