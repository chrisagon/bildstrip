import { type NextRequest, NextResponse } from "next/server";
import Together from "together-ai";
import { generatePageScript } from "@/lib/didactic/storyboard";
import { verifyQstashRequest } from "@/lib/qstash";
import {
  getCharacters,
  getChosenScenario,
  getObjectives,
  getPageById,
  getPagesForStory,
  replacePanels,
  setComicStatus,
  setPageSynopsis,
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

  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Service indisponible" }, { status: 503 });
  }

  try {
    const page = await getPageById(pageId);
    if (!page) {
      return NextResponse.json({ error: "Planche introuvable" }, { status: 404 });
    }

    const scenario = await getChosenScenario(page.storyId);
    if (!scenario) {
      return NextResponse.json({ error: "Aucun scénario choisi" }, { status: 400 });
    }

    const cast = await getCharacters(page.storyId);
    const objectives = (await getObjectives(page.storyId)).map((objective) => ({
      title: objective.title,
      summary: objective.summary,
      sourceQuote: objective.sourceQuote,
    }));

    const pages = await getPagesForStory(page.storyId);
    const previousSynopses = pages
      .filter((entry) => entry.pageNumber < page.pageNumber && entry.synopsis)
      .map((entry) => entry.synopsis as string);

    const client = new Together({ apiKey });
    const script = await generatePageScript(
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
        cast: cast.map((member) => ({
          name: member.name,
          role: member.role,
          appearance: member.appearance,
          portraitPrompt: member.portraitPrompt,
        })),
        previousSynopses,
        pageNumber: page.pageNumber,
        totalPages: pages.length,
      },
    );

    await replacePanels(page.id, script);
    await setPageSynopsis(page.id, script.synopsis);

    const allPages = await getPagesForStory(page.storyId);
    const scripted = allPages.filter((entry) => entry.status === "scripted").length;
    if (scripted === allPages.length) {
      await setComicStatus(page.storyId, "script_ready");
    }

    return NextResponse.json({ pageId: page.id, scripted });
  } catch (error) {
    console.error("Error rendering page script:", error);
    return NextResponse.json({ error: "Échec du storyboard" }, { status: 500 });
  }
}
