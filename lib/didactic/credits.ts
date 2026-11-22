export const OWN_KEY_MAX_PAGES = 4;

export type Ledger = {
  balance(userId: string): Promise<number>;
  apply(
    userId: string,
    delta: number,
    reason: string,
    storyId: string,
  ): Promise<void>;
};

export type JobPublisher = {
  publish(queue: string, body: Record<string, unknown>): Promise<void>;
};

export type ComicStatusStore = {
  get(storyId: string): Promise<string>;
  set(storyId: string, status: string): Promise<void>;
};

/** Own-key generation stays synchronous, so it is capped to keep runs short. */
export function canUseSynchronousMode(input: {
  pages: number;
  hasOwnKey: boolean;
}): boolean {
  return input.hasOwnKey && input.pages <= OWN_KEY_MAX_PAGES;
}

/**
 * Debits up front, then queues. A second call for a comic already generating is
 * deduplicated by the status check, so a double click costs one generation.
 */
export async function submitGeneration(input: {
  storyId: string;
  userId: string;
  cost: number;
  store: Ledger;
  jobs: JobPublisher;
  status: ComicStatusStore;
}): Promise<"queued" | "already_queued" | "insufficient"> {
  const current = await input.status.get(input.storyId);
  if (current === "generating") return "already_queued";

  const balance = await input.store.balance(input.userId);
  if (balance < input.cost) return "insufficient";

  await input.store.apply(input.userId, -input.cost, "generation", input.storyId);
  await input.status.set(input.storyId, "generating");
  await input.jobs.publish("render-panel", { storyId: input.storyId });

  return "queued";
}
