import { type NextRequest, NextResponse } from "next/server";
import { composePage } from "@/lib/didactic/compose-page";
import { verifyQstashRequest } from "@/lib/qstash";
import {
  getPageById,
  getPagesForStory,
  getPanelsByPage,
  setComicStatus,
  setPageStatus,
} from "@/lib/comics-actions";

export async function POST(request: NextRequest) {
  if (!(await verifyQstashRequest(request))) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let pageId: unknown;
  try {
    ({ pageId } = await request.clone().json());
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (typeof pageId !== "string" || !pageId) {
    return NextResponse.json({ error: "pageId requis" }, { status: 400 });
  }

  const page = await getPageById(pageId);
  if (!page) return NextResponse.json({ error: "Planche introuvable" }, { status: 404 });

  const result = await composePage({
    loadPanels: async () => getPanelsByPage(page.id),
    markPage: (status) => setPageStatus(page.id, status),
  });

  if (result === "done") {
    const pages = await getPagesForStory(page.storyId);
    if (pages.every((entry) => entry.status === "done")) {
      await setComicStatus(page.storyId, "done");
    }
  }

  if (result === "failed") {
    const pages = await getPagesForStory(page.storyId);
    if (
      pages.every((entry) => entry.status === "done" || entry.status === "failed")
    ) {
      await setComicStatus(page.storyId, "failed");
    }
  }

  return NextResponse.json({ result });
}
