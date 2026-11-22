import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseUserApiKey } from "@/lib/api-key";
import { quoteCredits } from "@/lib/didactic/quote";
import { canUseSynchronousMode, submitGeneration } from "@/lib/didactic/credits";
import { dbComicStatus, redisLedger } from "@/lib/credits";
import { publishJob } from "@/lib/qstash";
import {
  getCharacters,
  getComicBySlug,
  getPagesForStory,
  getPanelsByPage,
} from "@/lib/comics-actions";

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
    if (story.status !== "script_ready") {
      return NextResponse.json(
        { error: "Le storyboard doit être validé avant la génération." },
        { status: 400 },
      );
    }

    const pages = await getPagesForStory(story.id);
    const characters = await getCharacters(story.id);
    const cost = quoteCredits(pages.length, characters.length);

    const userApiKey = parseUserApiKey(request.headers.get("x-api-key"));
    if (userApiKey.status === "invalid") {
      return NextResponse.json(
        { error: "Invalid API key", errorType: "invalid_api_key" },
        { status: 400 },
      );
    }

    const hasOwnKey = userApiKey.status === "valid";
    if (hasOwnKey) {
      if (!canUseSynchronousMode({ pages: pages.length, hasOwnKey })) {
        return NextResponse.json(
          {
            error: "Avec votre clé, la génération est limitée à 4 planches.",
            errorType: "own_key_too_long",
          },
          { status: 400 },
        );
      }

      await dbComicStatus.set(story.id, "generating");
      const panels = [];
      for (const page of pages) {
        panels.push(...(await getPanelsByPage(page.id)));
      }
      return NextResponse.json({ mode: "synchronous", panels, credits: 0 });
    }

    const result = await submitGeneration({
      storyId: story.id,
      userId,
      cost,
      store: redisLedger,
      // The route publishes one message per panel below; this adapter satisfies
      // the contract without emitting a generic job.
      jobs: { publish: async () => {} },
      status: dbComicStatus,
    });

    if (result === "insufficient") {
      return NextResponse.json(
        {
          error: `Il manque des crédits : ${cost} nécessaires pour ${pages.length} planches.`,
          errorType: "insufficient_credits",
          credits: cost,
        },
        { status: 402 },
      );
    }
    if (result === "already_queued") {
      return NextResponse.json({ mode: "queued", credits: cost, already: true });
    }

    for (const page of pages) {
      for (const panel of await getPanelsByPage(page.id)) {
        await publishJob("render-panel", { panelId: panel.id });
      }
    }

    return NextResponse.json({
      mode: "queued",
      credits: cost,
      panels: pages.length * 5,
    });
  } catch (error) {
    console.error("Error starting generation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
