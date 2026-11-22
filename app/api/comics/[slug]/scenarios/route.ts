import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import Together from "together-ai";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/input-limits";
import { generateScenarios, SCENARIO_TEMPLATES } from "@/lib/didactic/scenarios";
import {
  chooseScenario,
  getComicBySlug,
  getObjectives,
  getScenarioDrafts,
  replaceScenarioDrafts,
} from "@/lib/comics-actions";

const chooseScenarioSchema = z.object({ draftId: z.string().min(1).max(200) });

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

    const all = await getObjectives(story.id);
    const selected = all.filter((objective) => objective.selected);
    const objectives = (selected.length > 0 ? selected : all).map((objective) => ({
      title: objective.title,
      summary: objective.summary,
      sourceQuote: objective.sourceQuote,
    }));

    if (objectives.length === 0) {
      return NextResponse.json(
        { error: "Choisissez au moins une notion avant de proposer un scénario." },
        { status: 400 },
      );
    }

    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Service temporairement indisponible" },
        { status: 503 },
      );
    }

    const client = new Together({ apiKey });
    const drafts = await generateScenarios(
      { createCompletion: (body) => client.chat.completions.create(body) },
      { objectives },
    );

    if (drafts.length === 0) {
      return NextResponse.json(
        { error: "Aucun scénario n'a pu être proposé." },
        { status: 502 },
      );
    }

    const rows = await replaceScenarioDrafts(story.id, drafts);
    return NextResponse.json({ scenarios: rows, templates: SCENARIO_TEMPLATES });
  } catch (error) {
    console.error("Error generating scenarios:", error);
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

  const scenarios = await getScenarioDrafts(story.id);
  return NextResponse.json({ scenarios, templates: SCENARIO_TEMPLATES });
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

  const body = await parseJsonBody(request, chooseScenarioSchema);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const chosen = await chooseScenario(story.id, body.draftId);
  if (!chosen) return NextResponse.json({ error: "Scénario introuvable" }, { status: 404 });

  return NextResponse.json({ scenario: chosen });
}
