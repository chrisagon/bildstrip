import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { quoteCredits } from "@/lib/didactic/quote";
import { submitGeneration } from "@/lib/didactic/credits";
import { redisLedger } from "@/lib/credits";
import { publishJob } from "@/lib/qstash";
import {
  claimComicStatus,
  getCharacters,
  getComicBySlug,
  getPagesForStory,
  getPanelsByPage,
  setComicStatus,
} from "@/lib/comics-actions";

const RUNNABLE: Array<"script_ready" | "failed" | "done"> = [
  "script_ready",
  "failed",
  "done",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit("generation", request, userId);
    if (rateLimitResponse) return rateLimitResponse;

    const { slug } = await params;
    const story = await getComicBySlug(slug);
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    if (story.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!RUNNABLE.includes(story.status as (typeof RUNNABLE)[number])) {
      return NextResponse.json(
        { error: "Le storyboard doit être validé avant la génération." },
        { status: 400 },
      );
    }

    const pages = await getPagesForStory(story.id);
    const characters = await getCharacters(story.id);

    // A retry only pays for what is still missing: panels already rendered and
    // portraits already generated are not charged again.
    const pending: string[] = [];
    for (const page of pages) {
      for (const panel of await getPanelsByPage(page.id)) {
        if (panel.status !== "done") pending.push(panel.id);
      }
    }
    const missingPortraits = characters.filter((member) => !member.portraitUrl);
    const cost = quoteCredits(0, pending.length + missingPortraits.length);

    if (pending.length === 0 && missingPortraits.length === 0) {
      return NextResponse.json(
        { error: "Toutes les cases sont déjà générées." },
        { status: 400 },
      );
    }

    const claim = {
      claim: () => claimComicStatus(story.id, RUNNABLE, "generating"),
      release: () => setComicStatus(story.id, "script_ready"),
    };

    const result = await submitGeneration({
      storyId: story.id,
      userId,
      cost,
      store: redisLedger,
      claim,
      // Per-panel messages are published below; this adapter only satisfies the
      // contract and is the single point where a queue failure is detected.
      jobs: {
        publish: async () => {
          if (pending.length === 0 && missingPortraits.length === 0) {
            throw new Error("nothing to queue");
          }
        },
      },
    });

    if (result === "already_queued") {
      return NextResponse.json({ mode: "queued", already: true });
    }
    if (result === "insufficient") {
      return NextResponse.json(
        {
          error: `Il manque des crédits : ${cost} nécessaires pour ${pending.length} cases.`,
          errorType: "insufficient_credits",
          credits: cost,
        },
        { status: 402 },
      );
    }
    if (result === "publish_failed") {
      return NextResponse.json(
        { error: "Mise en file impossible, crédits rendus. Réessayez." },
        { status: 503 },
      );
    }

    for (const member of missingPortraits) {
      await publishJob("render-portrait", { characterId: member.id });
    }
    for (const panelId of pending) {
      await publishJob("render-panel", { panelId });
    }

    return NextResponse.json({ mode: "queued", credits: cost, panels: pending.length });
  } catch (error) {
    console.error("Error starting generation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
