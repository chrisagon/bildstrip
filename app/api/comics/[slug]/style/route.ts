import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/input-limits";
import { COMIC_STYLES } from "@/lib/constants";
import { getComicBySlug, setStyle } from "@/lib/comics-actions";

const styleSchema = z.object({ styleId: z.string().min(1).max(64) });

const STYLE_IDS = COMIC_STYLES.map((style) => style.id) as string[];

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

  const body = await parseJsonBody(request, styleSchema);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  if (!STYLE_IDS.includes(body.styleId)) {
    return NextResponse.json({ error: "Style inconnu" }, { status: 400 });
  }

  await setStyle(story.id, body.styleId);
  return NextResponse.json({ style: body.styleId });
}
