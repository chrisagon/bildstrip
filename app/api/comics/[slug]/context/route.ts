import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Together from "together-ai";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateObjectives } from "@/lib/didactic/context";
import {
  getComicBySlug,
  getSourceByStoryId,
  replaceObjectives,
  setComicStatus,
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

    const rateLimitResponse = await enforceRateLimit("write", request, userId);
    if (rateLimitResponse) return rateLimitResponse;

    const { slug } = await params;
    const story = await getComicBySlug(slug);
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    if (story.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const source = await getSourceByStoryId(story.id);
    if (!source?.extractedText) {
      return NextResponse.json(
        { error: "Aucun texte source : importez un document ou décrivez un sujet." },
        { status: 400 },
      );
    }

    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      console.error("TOGETHER_API_KEY is not configured");
      return NextResponse.json(
        { error: "Service temporairement indisponible" },
        { status: 503 },
      );
    }

    const client = new Together({ apiKey });
    const objectives = await generateObjectives(
      { createCompletion: (body) => client.chat.completions.create(body) },
      {
        sourceText: source.extractedText,
        audience: story.audience ?? "grand public",
        mode: source.kind,
        topic: source.kind === "demo" ? source.extractedText : undefined,
      },
    );

    if (objectives.length === 0) {
      return NextResponse.json(
        { error: "Aucune notion n'a pu être extraite de ce contenu." },
        { status: 502 },
      );
    }

    await replaceObjectives(story.id, objectives);
    await setComicStatus(story.id, "context_ready");

    return NextResponse.json({ objectives });
  } catch (error) {
    console.error("Error extracting objectives:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
