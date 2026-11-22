import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseJsonBody, sourceTextRequestSchema } from "@/lib/input-limits";
import {
  getComicBySlug,
  getSourceByStoryId,
  updateSourceText,
} from "@/lib/comics-actions";

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

  const source = await getSourceByStoryId(story.id);
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  return NextResponse.json({
    kind: source.kind,
    text: source.extractedText ?? "",
    truncated: source.truncatedAt !== null,
    originalName: source.originalName,
  });
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

  const body = await parseJsonBody(request, sourceTextRequestSchema);
  if (!body) return NextResponse.json({ error: "Texte invalide" }, { status: 400 });

  const { truncated } = await updateSourceText(story.id, body.text);
  return NextResponse.json({ success: true, truncated });
}
