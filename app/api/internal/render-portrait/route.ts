import { type NextRequest, NextResponse } from "next/server";
import { renderPortrait } from "@/lib/didactic/render-portrait";
import { createTogetherProvider } from "@/lib/providers/image-provider";
import { uploadImageToS3 } from "@/lib/s3-upload";
import { getCharacterById, saveCharacterPortrait } from "@/lib/comics-actions";
import { getStoryById } from "@/lib/db-actions";
import { COMIC_STYLES } from "@/lib/constants";
import { verifyQstashRequest } from "@/lib/qstash";

export async function POST(request: NextRequest) {
  if (!(await verifyQstashRequest(request))) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let characterId: unknown;
  try {
    ({ characterId } = await request.clone().json());
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (typeof characterId !== "string" || !characterId) {
    return NextResponse.json({ error: "characterId requis" }, { status: 400 });
  }

  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Service indisponible" }, { status: 503 });
  }

  try {
    const character = await getCharacterById(characterId);
    if (!character) {
      return NextResponse.json({ error: "Personnage introuvable" }, { status: 404 });
    }

    const story = await getStoryById(character.storyId);
    const style =
      COMIC_STYLES.find((entry) => entry.id === story?.style) ?? COMIC_STYLES[2];

    const result = await renderPortrait({
      provider: createTogetherProvider(apiKey),
      loadCharacter: async () => ({
        name: character.name,
        role: character.role,
        appearance: character.appearance,
        portraitUrl: character.portraitUrl,
      }),
      stylePrompt: style.prompt,
      upload: (tempUrl) =>
        uploadImageToS3(
          tempUrl,
          `${character.storyId}/portrait-${character.position}-${Date.now()}.jpg`,
        ),
      savePortrait: (url) => saveCharacterPortrait(character.id, url),
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Error rendering portrait:", error);
    return NextResponse.json({ error: "Échec du portrait" }, { status: 500 });
  }
}
