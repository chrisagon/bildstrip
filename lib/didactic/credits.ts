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

/**
 * An atomic single-flight guard. `claim` must succeed for exactly one caller
 * (a conditional UPDATE in the database); `release` puts the comic back to a
 * runnable state when the run could not start.
 */
export type GenerationClaim = {
  claim(): Promise<boolean>;
  release(): Promise<void>;
};

export type SubmitResult =
  | "queued"
  | "already_queued"
  | "insufficient"
  | "publish_failed";

/** Own-key generation stays synchronous, so it is capped to keep runs short. */
export function canUseSynchronousMode(input: {
  pages: number;
  hasOwnKey: boolean;
}): boolean {
  return input.hasOwnKey && input.pages <= OWN_KEY_MAX_PAGES;
}

/**
 * Claim, debit, then queue — in that order, so a double submission cannot debit
 * twice and a failed queue call leaves the balance untouched and the comic
 * runnable.
 */
export async function submitGeneration(input: {
  storyId: string;
  userId: string;
  cost: number;
  store: Ledger;
  claim: GenerationClaim;
  jobs: JobPublisher;
}): Promise<SubmitResult> {
  if (!(await input.claim.claim())) return "already_queued";

  const balance = await input.store.balance(input.userId);
  if (balance < input.cost) {
    await input.claim.release();
    return "insufficient";
  }

  await input.store.apply(input.userId, -input.cost, "generation", input.storyId);

  try {
    await input.jobs.publish("render-panel", { storyId: input.storyId });
  } catch {
    await input.store.apply(input.userId, input.cost, "generation_rollback", input.storyId);
    await input.claim.release();
    return "publish_failed";
  }

  return "queued";
}
