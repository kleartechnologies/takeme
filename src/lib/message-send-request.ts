export interface PendingMessageSend {
  senderId: string;
  conversationId: string;
  body: string;
  idempotencyKey: string;
}

/** Keep one logical request through a failed/uncertain send; edits start a new one. */
export function pendingMessageSend(previous: PendingMessageSend | null, senderId: string, conversationId: string,
  value: string, createKey = () => globalThis.crypto.randomUUID()): PendingMessageSend {
  const body = value.trim().replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return previous?.senderId === senderId && previous.conversationId === conversationId && previous.body === body
    ? previous : { senderId, conversationId, body, idempotencyKey: createKey() };
}
