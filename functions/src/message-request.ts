import { createHash } from "node:crypto";

export const MESSAGE_REQUEST_RETENTION_MS = 24 * 60 * 60_000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

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
