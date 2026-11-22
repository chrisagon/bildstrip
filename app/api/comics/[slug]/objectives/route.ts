import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/input-limits";
import {
  getComicBySlug,
  getObjectives,
  setSelectedObjectives,
} from "@/lib/comics-actions";

const objectivesSchema = z.object({
  positions: z.array(z.number().int().min(0).max(4)).max(3),
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
  return NextResponse.json({ objectives: await getObjectives(story.id) });
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

  const body = await parseJsonBody(request, objectivesSchema);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  if (body.positions.length === 0) {
    return NextResponse.json(
      { error: "Sélectionnez au moins une notion." },
      { status: 400 },
    );
  }

  await setSelectedObjectives(story.id, body.positions);
  return NextResponse.json({ objectives: await getObjectives(story.id) });
}
