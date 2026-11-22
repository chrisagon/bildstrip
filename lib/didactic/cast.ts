import type { CreateCompletion } from "../story-metadata.ts";
import type { CastMember, CastRole, Objective, ScenarioDraft } from "./types.ts";

const TEXT_MODEL = "Qwen/Qwen3.5-9B";

const ROLES: CastRole[] = ["protagonist", "foil", "mentor", "comic-relief"];

export function buildCastPrompt(input: {
  objectives: Objective[];
  scenario: ScenarioDraft;
  audience: string;
}): { system: string; user: string } {
  const system = [
    "Tu crées la distribution d'une bande dessinée didactique.",
    "Deux ou trois personnages, pas plus : chaque personnage doit servir le propos.",
    "appearance est une description physique courte et stable (âge apparent, silhouette, cheveux, vêtements, un détail distinctif).",
    "Elle ne changera plus ensuite : le dessinateur s'y réfère à chaque case.",
    'Réponds uniquement en JSON : {"characters":[{"name":"...","role":"protagonist|foil|mentor|comic-relief","appearance":"...","portraitPrompt":"..."}]}',
    "appearance ≤ 300 caractères. Les visages ne doivent contenir aucun texte.",
  ].join("\n");

  const notions = input.objectives
    .map((objective) => `- ${objective.title} : ${objective.summary}`)
    .join("\n");

  return {
    system,
    user: [
      `Public : ${input.audience}`,
      `Structure retenue : ${input.scenario.title} (${input.scenario.templateId})`,
      `Synopsis : ${input.scenario.synopsis}`,
      `Étapes : ${input.scenario.beats.join(" | ")}`,
      `Notions :\n${notions}`,
    ].join("\n\n"),
  };
}

export function parseCastResponse(raw: string): CastMember[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Réponse du modèle illisible : aucun JSON.");

  const parsed = JSON.parse(match[0]) as { characters?: unknown };
  if (!Array.isArray(parsed.characters)) return [];

  return parsed.characters
    .map((entry) => {
      const value = entry as Record<string, unknown>;
      const role = typeof value.role === "string" ? value.role : "";
      return {
        name: typeof value.name === "string" ? value.name.trim() : "",
        role: (ROLES as string[]).includes(role) ? (role as CastRole) : null,
        appearance:
          typeof value.appearance === "string"
            ? value.appearance.trim().slice(0, 400)
            : "",
        portraitPrompt:
          typeof value.portraitPrompt === "string" ? value.portraitPrompt.trim() : "",
      };
    })
    .filter(
      (member): member is CastMember =>
        member.role !== null && member.name.length > 0 && member.appearance.length > 0,
    )
    .slice(0, 3);
}

export function buildPortraitPrompt(member: CastMember, stylePrompt: string): string {
  return [
    "Character reference sheet portrait, head and shoulders, neutral background.",
    "no text, no lettering, no speech bubbles, no watermark",
    `Character: ${member.name}. ${member.appearance}`,
    `Art style: ${stylePrompt}`,
    "Consistent, clearly drawn face suitable for reuse across many comic panels.",
  ].join("\n");
}

export async function generateCast(
  deps: { createCompletion: CreateCompletion },
  input: Parameters<typeof buildCastPrompt>[0],
): Promise<CastMember[]> {
  const { system, user } = buildCastPrompt(input);

  const response = await deps.createCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
    max_tokens: 700,
    reasoning: { enabled: false },
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("No response from text generation");

  return parseCastResponse(content);
}
