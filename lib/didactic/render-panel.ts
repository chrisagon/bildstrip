import type { ImageProvider } from "../providers/image-provider.ts";
import { buildPanelImagePrompt } from "./panel-prompt.ts";
import type { CastMember, PanelDraft } from "./types.ts";

export type RenderCastMember = CastMember & { portraitUrl?: string | null };

export type RenderPanelRow = {
  id: string;
  status: string;
  imageUrl: string | null;
  panel: PanelDraft;
};

/**
 * One panel per job. A replayed QStash message must neither re-call the
 * provider nor charge a second time: an already rendered panel is skipped.
 */
export async function renderPanel(deps: {
  provider: ImageProvider;
  loadPanel: () => Promise<RenderPanelRow | null>;
  cast: RenderCastMember[];
  stylePrompt: string;
  hasPreviousPage: boolean;
  saveImage: (url: string) => Promise<void>;
  upload: (tempUrl: string) => Promise<string>;
}): Promise<"done" | "skipped"> {
  const row = await deps.loadPanel();
  if (!row) throw new Error("Case introuvable");
  if (row.status === "done" && row.imageUrl) return "skipped";

  const prompt = buildPanelImagePrompt({
    panel: row.panel,
    cast: deps.cast,
    stylePrompt: deps.stylePrompt,
    hasPreviousPage: deps.hasPreviousPage,
  });

  const portraits = row.panel.characterIndexes
    .map((index) => deps.cast[index]?.portraitUrl)
    .filter((url): url is string => Boolean(url))
    .slice(0, 2);

  const tempUrl = await deps.provider.generate({
    prompt,
    referenceImages: portraits,
    width: 864,
    height: 1184,
  });
  const url = await deps.upload(tempUrl);
  await deps.saveImage(url);
  return "done";
}
