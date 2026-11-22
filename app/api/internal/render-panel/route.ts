import { type NextRequest, NextResponse } from "next/server";
import { renderPanel } from "@/lib/didactic/render-panel";
import { createTogetherProvider } from "@/lib/providers/image-provider";
import { uploadImageToS3 } from "@/lib/s3-upload";
import { verifyQstashRequest, publishJob } from "@/lib/qstash";
import { COMIC_STYLES } from "@/lib/constants";
import {
  getCharacters,
  getPageById,
  getPanelById,
  getPanelsByPage,
  markPanelFailed,
  savePanelImage,
} from "@/lib/comics-actions";
import { getStoryById } from "@/lib/db-actions";

export async function POST(request: NextRequest) {
  if (!(await verifyQstashRequest(request))) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let panelId: unknown;
  try {
    ({ panelId } = await request.clone().json());
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (typeof panelId !== "string" || !panelId) {
    return NextResponse.json({ error: "panelId requis" }, { status: 400 });
  }

  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Service indisponible" }, { status: 503 });
  }

  try {
    const panel = await getPanelById(panelId);
    if (!panel) {
      return NextResponse.json({ error: "Case introuvable" }, { status: 404 });
    }
    const page = await getPageById(panel.pageId);
    if (!page) {
      return NextResponse.json({ error: "Planche introuvable" }, { status: 404 });
    }
    const story = await getStoryById(page.storyId);
    if (!story) {
      return NextResponse.json({ error: "Histoire introuvable" }, { status: 404 });
    }

    const cast = (await getCharacters(story.id)).map((member) => ({
      name: member.name,
      role: member.role,
      appearance: member.appearance,
      portraitPrompt: member.portraitPrompt,
      portraitUrl: member.portraitUrl,
    }));
    const style =
      COMIC_STYLES.find((entry) => entry.id === story.style) ?? COMIC_STYLES[2];

    const result = await renderPanel({
      provider: createTogetherProvider(apiKey),
      loadPanel: async () => ({
        id: panel.id,
        status: panel.status,
        imageUrl: panel.imageUrl,
        panel: {
          intent: panel.intent,
          visualPrompt: panel.visualPrompt,
          caption: panel.caption,
          dialogue: panel.dialogue,
          characterIndexes: panel.characterIndexes,
        },
      }),
      cast,
      stylePrompt: style.prompt,
      hasPreviousPage: page.pageNumber > 1,
      upload: (tempUrl) =>
        uploadImageToS3(
          tempUrl,
          `${story.id}/page-${page.pageNumber}-panel-${panel.position}-${Date.now()}.jpg`,
        ),
      saveImage: (url) => savePanelImage(panel.id, url),
    });

    const panels = await getPanelsByPage(page.id);
    const settled = panels.every(
      (entry) => entry.status === "done" || entry.status === "failed",
    );
    if (settled) {
      await publishJob("compose-page", { pageId: page.id });
    }

    return NextResponse.json({ result, pageId: page.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await markPanelFailed(panelId, message).catch(() => {});
    console.error("Error rendering panel:", error);
    return NextResponse.json({ error: "Échec de la case" }, { status: 500 });
  }
}
