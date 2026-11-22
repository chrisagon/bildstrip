import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/input-limits";
import { estimatePages, PANELS_PER_PAGE } from "@/lib/didactic/quote";
import { markPagesStaleFrom } from "@/lib/didactic/storyboard";
import { publishJob } from "@/lib/qstash";
import {
  createPagesForStory,
  getCharacters,
  getChosenScenario,
  getComicBySlug,
  getObjectives,
  getPagesForStory,
  markPagesStaleFromDb,
  replacePanels,
} from "@/lib/comics-actions";

const panelSchema = z.object({
  intent: z.string().max(400),
  visualPrompt: z.string().max(1200),
  caption: z.string().max(400).default(""),
  dialogue: z
    .array(
      z.object({
        speaker: z.string().max(80),
        text: z.string().max(200),
        anchor: z.enum(["left", "right"]),
      }),
    )
    .max(2),
  characterIndexes: z.array(z.number().int().min(0).max(2)).max(3),
});

const editSchema = z.object({
  pageNumber: z.number().int().min(1).max(20),
  panels: z.array(panelSchema).length(PANELS_PER_PAGE),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const { slug } = await params;
  const story = await getComicBySlug(slug);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (story.userId !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const pages = await getPagesForStory(story.id);
  return NextResponse.json({ pages });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit("write", request, userId);
    if (rateLimitResponse) return rateLimitResponse;

    const { slug } = await params;
    const story = await getComicBySlug(slug);
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    if (story.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const scenario = await getChosenScenario(story.id);
    if (!scenario) {
      return NextResponse.json({ error: "Choisissez un scénario." }, { status: 400 });
    }

    const cast = await getCharacters(story.id);
    if (cast.length < 2 || cast.some((member) => !member.portraitUrl)) {
      return NextResponse.json(
        { error: "La distribution doit être complète et validée." },
        { status: 400 },
      );
    }

    const objectives = await getObjectives(story.id);
    const pageCount = estimatePages(objectives.length);
    const created = await createPagesForStory(story.id, pageCount);

    for (const page of created) {
      await publishJob("render-script", { pageId: page.id });
    }

    return NextResponse.json({ pages: created, pageCount }, { status: 201 });
  } catch (error) {
    console.error("Error starting storyboard:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rateLimitResponse = await enforceRateLimit("write", request, userId);
  if (rateLimitResponse) return rateLimitResponse;

  const { slug } = await params;
  const story = await getComicBySlug(slug);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (story.userId !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await parseJsonBody(request, editSchema);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const pages = await getPagesForStory(story.id);
  const target = pages.find((page) => page.pageNumber === body.pageNumber);
  if (!target) {
    return NextResponse.json({ error: "Planche introuvable" }, { status: 404 });
  }

  await replacePanels(target.id, {
    synopsis: target.synopsis ?? "",
    panels: body.panels,
  });
  await markPagesStaleFrom(body.pageNumber, {
    markStaleFrom: (pageNumber) => markPagesStaleFromDb(story.id, pageNumber),
  });

  return NextResponse.json({ success: true });
}
