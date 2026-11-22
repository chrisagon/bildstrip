import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import Together from "together-ai";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/input-limits";
import { generateCast } from "@/lib/didactic/cast";
import { publishJob } from "@/lib/qstash";
import {
  getCharacters,
  getChosenScenario,
  getComicBySlug,
  getObjectives,
  replaceCharacters,
  setComicStatus,
  updateCharacterFields,
} from "@/lib/comics-actions";

const updateCastSchema = z.object({
  characters: z
    .array(
      z.object({
        position: z.number().int().min(0).max(2),
        name: z.string().trim().min(1).max(80).optional(),
        appearance: z.string().trim().min(1).max(400).optional(),
      }),
    )
    .max(3),
});

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
      return NextResponse.json(
        { error: "Choisissez un scénario avant de créer les personnages." },
        { status: 400 },
      );
    }

    const objectives = (await getObjectives(story.id)).map((objective) => ({
      title: objective.title,
      summary: objective.summary,
      sourceQuote: objective.sourceQuote,
    }));

    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Service temporairement indisponible" },
        { status: 503 },
      );
    }

    const client = new Together({ apiKey });
    const cast = await generateCast(
      { createCompletion: (body) => client.chat.completions.create(body) },
      {
        objectives,
        scenario: {
          templateId: scenario.templateId,
          title: scenario.title,
          synopsis: scenario.synopsis,
          beats: scenario.beats,
          estimatedPages: scenario.estimatedPages,
        },
        audience: story.audience ?? "grand public",
      },
    );

    if (cast.length < 2) {
      return NextResponse.json(
        { error: "La distribution proposée est incomplète." },
        { status: 502 },
      );
    }

    const rows = await replaceCharacters(story.id, cast);
    for (const character of rows) {
      await publishJob("render-portrait", { characterId: character.id });
    }

    await setComicStatus(story.id, "cast_ready");
    return NextResponse.json({ characters: rows });
  } catch (error) {
    console.error("Error generating cast:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
  return NextResponse.json({ characters: await getCharacters(story.id) });
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

  const body = await parseJsonBody(request, updateCastSchema);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  await updateCharacterFields(story.id, body.characters);
  return NextResponse.json({ characters: await getCharacters(story.id) });
}
