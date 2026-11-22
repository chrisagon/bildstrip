import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCharacters,
  getComicBySlug,
  getPagesForStory,
  getPanelsByPage,
} from "@/lib/comics-actions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { userId } = await auth();
  const { slug } = await params;

  const story = await getComicBySlug(slug);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const token = request.nextUrl.searchParams.get("t");
  const isOwner = Boolean(userId) && story.userId === userId;
  const canRead =
    isOwner || (story.visibility === "unlisted" &&
      Boolean(story.shareToken) &&
      token === story.shareToken);
  if (!canRead) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const pages = await getPagesForStory(story.id);
  const characters = await getCharacters(story.id);

  const panels = [];
  for (const page of pages) {
    const pagePanels = await getPanelsByPage(page.id);
    panels.push(
      ...pagePanels.map((panel) => ({ ...panel, pageNumber: page.pageNumber })),
    );
  }

  const done = panels.filter((panel) => panel.status === "done").length;
  const { userId: _ownerId, shareToken: _shareToken, ...publicStory } = story;

  return NextResponse.json({
    story: publicStory,
    isOwner,
    pages,
    panels,
    characters,
    progress: { done, total: panels.length },
  });
}
