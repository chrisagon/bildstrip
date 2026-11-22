import { Client, Receiver } from "@upstash/qstash";

export type QueueName =
  | "render-panel"
  | "render-script"
  | "render-portrait"
  | "compose-page";

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

/**
 * Publishes a worker message. Without QSTASH_TOKEN the call returns silently in
 * local development only (INLINE_GENERATION=1), where the caller runs the worker
 * inline instead; in production a missing token is an error, not a silent skip.
 */
export async function publishJob(
  queue: QueueName,
  body: Record<string, unknown>,
): Promise<void> {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    if (process.env.INLINE_GENERATION !== "1") {
      throw new Error("QSTASH_TOKEN is not configured");
    }
    // Local mode: call the worker on this machine instead of the queue.
    const response = await fetch(`${appUrl()}/api/internal/${queue}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Worker ${queue} failed with ${response.status}`);
    }
    return;
  }

  const client = new Client({ token });
  await client.publishJSON({
    url: `${appUrl()}/api/internal/${queue}`,
    body,
    retries: 3,
  });
}

let receiver: Receiver | null = null;

/** Verifies the Upstash signature on an incoming worker request. */
export async function verifyQstashRequest(request: Request): Promise<boolean> {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentKey || !nextKey) {
    // Local development only: without signing keys there is no signature to check.
    return process.env.INLINE_GENERATION === "1";
  }

  receiver ??= new Receiver({
    currentSigningKey: currentKey,
    nextSigningKey: nextKey,
  });

  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  const body = await request.clone().text();
  try {
    return await receiver.verify({ signature, body });
  } catch {
    return false;
  }
}
