import { Redis } from "@upstash/redis";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { creditLedger, stories } from "./schema";
import { FREE_WEEKLY_CREDITS } from "./didactic/quote";
import type { ComicStatus } from "./didactic/types";
import type { Ledger } from "./didactic/credits";

export {
  OWN_KEY_MAX_PAGES,
  canUseSynchronousMode,
  submitGeneration,
} from "./didactic/credits";
export type { JobPublisher } from "./didactic/credits";

export type ComicStatusStore = {
  get(storyId: string): Promise<string>;
  set(storyId: string, status: string): Promise<void>;
};

const BALANCE_PREFIX = "credits:";
const BALANCE_TTL_SECONDS = 7 * 24 * 60 * 60;

let redis: Redis | null = null;
function client(): Redis {
  redis ??= new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return redis;
}

/** Redis holds the live balance; the ledger table is the audit trail. */
export const redisLedger: Ledger = {
  async balance(userId) {
    const stored = await client().get<number>(BALANCE_PREFIX + userId);
    if (typeof stored === "number") return stored;

    await client().set(BALANCE_PREFIX + userId, FREE_WEEKLY_CREDITS, {
      ex: BALANCE_TTL_SECONDS,
    });
    return FREE_WEEKLY_CREDITS;
  },

  async apply(userId, delta, reason, storyId) {
    const next = await client().incrby(BALANCE_PREFIX + userId, delta);
    await client().expire(BALANCE_PREFIX + userId, BALANCE_TTL_SECONDS);

    await db.insert(creditLedger).values({ userId, delta, reason, storyId });

    // A refund must never leave a negative balance behind.
    if (next < 0) {
      await client().set(BALANCE_PREFIX + userId, 0, { ex: BALANCE_TTL_SECONDS });
    }
  },
};

export const dbComicStatus: ComicStatusStore = {
  async get(storyId) {
    const rows = await db
      .select({ status: stories.status })
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1);
    return rows[0]?.status ?? "draft";
  },
  async set(storyId, status) {
    await db
      .update(stories)
      .set({ status: status as ComicStatus, updatedAt: new Date() })
      .where(eq(stories.id, storyId));
  },
};

export async function getBalance(userId: string): Promise<number> {
  return redisLedger.balance(userId);
}

export async function refundPanels(
  userId: string,
  storyId: string,
  count = 1,
): Promise<void> {
  await redisLedger.apply(userId, count, "panel_refund", storyId);
}
