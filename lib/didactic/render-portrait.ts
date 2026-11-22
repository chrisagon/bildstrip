import type { ImageProvider } from "../providers/image-provider.ts";
import { buildPortraitPrompt } from "./cast.ts";
import type { CastMember } from "./types.ts";

export type PortraitCharacter = Pick<CastMember, "name" | "role" | "appearance"> & {
  portraitUrl: string | null;
};

/** A portrait is generated once; a replayed job must not pay for it twice. */
export async function renderPortrait(deps: {
  provider: ImageProvider;
  loadCharacter: () => Promise<PortraitCharacter | null>;
  stylePrompt: string;
  savePortrait: (url: string) => Promise<void>;
  upload: (tempUrl: string) => Promise<string>;
}): Promise<"done" | "skipped"> {
  const character = await deps.loadCharacter();
  if (!character) throw new Error("Personnage introuvable");
  if (character.portraitUrl) return "skipped";

  const prompt = buildPortraitPrompt(
    {
      name: character.name,
      role: character.role,
      appearance: character.appearance,
      portraitPrompt: "",
    },
    deps.stylePrompt,
  );

  const tempUrl = await deps.provider.generate({
    prompt,
    referenceImages: [],
    width: 864,
    height: 1184,
  });
  const url = await deps.upload(tempUrl);
  await deps.savePortrait(url);
  return "done";
}
