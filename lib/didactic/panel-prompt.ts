import type { CastMember, PanelDraft } from "./types.ts";

const MAX_PORTRAITS_PER_PANEL = 2;

/**
 * The image model draws the scene only. Every word of dialogue is composed by
 * the app afterwards, so the prompt must forbid any lettering outright.
 */
export function buildPanelImagePrompt(input: {
  panel: PanelDraft;
  cast: CastMember[];
  stylePrompt: string;
  hasPreviousPage: boolean;
}): string {
  const present = input.panel.characterIndexes
    .filter((index) => index >= 0 && index < input.cast.length)
    .slice(0, MAX_PORTRAITS_PER_PANEL)
    .map((index, portraitIndex) => {
      const member = input.cast[index];
      return `REFERENCE CHARACTER ${portraitIndex + 1}: ${member.name}. ${member.appearance}`;
    });

  return [
    "Single comic panel illustration.",
    "no text, no lettering, no speech bubbles, no captions, no watermark",
    "Leave empty space in the upper third of the panel for speech bubbles added later.",
    `Scene: ${input.panel.visualPrompt}`,
    `Dramatic intent: ${input.panel.intent}`,
    `Art style: ${input.stylePrompt}`,
    ...present,
    input.hasPreviousPage
      ? "Maintain continuity with the previous page: same characters, same setting, same lighting."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
