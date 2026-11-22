import type { CreateCompletion } from "../story-metadata.ts";
import { PANELS_PER_PAGE } from "./quote.ts";
import type {
  CastMember,
  DialogueAnchor,
  DialogueLine,
  Objective,
  PageScript,
  PanelDraft,
  ScenarioDraft,
} from "./types.ts";

const TEXT_MODEL = "Qwen/Qwen3.5-9B";

export function buildPageScriptPrompt(input: {
  objectives: Objective[];
  scenario: ScenarioDraft;
  cast: CastMember[];
  previousSynopses: string[];
  pageNumber: number;
  totalPages: number;
}): { system: string; user: string } {
  const system = [
    `Tu écris la planche ${input.pageNumber} sur ${input.totalPages} d'une bande dessinée didactique.`,
    `Chaque planche contient exactement ${PANELS_PER_PAGE} cases.`,
    "Les images seront dessinées SANS texte : le dialogue est écrit ici, jamais dans l'image.",
    "Chaque case porte une intention pédagogique en une phrase (champ intent).",
    "visualPrompt décrit la scène à dessiner (cadrage, action, décor), sans texte ni bulle.",
    "dialogue contient au maximum deux répliques par case, chacune ≤ 140 caractères.",
    "caption est réservé à une phrase de narration, souvent vide.",
    "characterIndexes liste les personnages présents, par leur index de distribution (0, 1, 2).",
    'Réponds uniquement en JSON : {"synopsis":"...","panels":[{"intent":"...","visualPrompt":"...","caption":"...","dialogue":[{"speaker":"...","text":"...","anchor":"left|right"}],"characterIndexes":[0]}]}',
  ].join("\n");

  const cast = input.cast
    .map(
      (member, index) =>
        `${index}. ${member.name} (${member.role}) — ${member.appearance}`,
    )
    .join("\n");

  const notions = input.objectives
    .map((objective) => `- ${objective.title} : ${objective.summary}`)
    .join("\n");

  const previous = input.previousSynopses.length
    ? input.previousSynopses
        .map((synopsis, index) => `Planche ${index + 1} : ${synopsis}`)
        .join("\n")
    : "Aucune planche précédente.";

  return {
    system,
    user: [
      `Notions :\n${notions}`,
      `Structure : ${input.scenario.title} — ${input.scenario.synopsis}`,
      `Étapes : ${input.scenario.beats.join(" | ")}`,
      `Distribution :\n${cast}`,
      `Résumés précédents :\n${previous}`,
    ].join("\n\n"),
  };
}

function normalizeAnchor(value: unknown): DialogueAnchor {
  return value === "right" ? "right" : "left";
}

export function parsePageScriptResponse(raw: string, castSize: number): PageScript {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Réponse du modèle illisible : aucun JSON.");

  const parsed = JSON.parse(match[0]) as {
    synopsis?: unknown;
    panels?: unknown;
  };

  if (!Array.isArray(parsed.panels) || parsed.panels.length !== PANELS_PER_PAGE) {
    throw new Error("Le storyboard doit contenir 5 cases.");
  }

  const panels: PanelDraft[] = parsed.panels.map((entry) => {
    const value = entry as Record<string, unknown>;
    const dialogue: DialogueLine[] = Array.isArray(value.dialogue)
      ? value.dialogue
          .map((line) => line as Record<string, unknown>)
          .filter((line) => typeof line.text === "string" && line.text.trim())
          .slice(0, 2)
          .map((line) => ({
            speaker:
              typeof line.speaker === "string" ? line.speaker.trim() : "Narration",
            text: String(line.text).trim().slice(0, 200),
            anchor: normalizeAnchor(line.anchor),
          }))
      : [];

    const indexes = Array.isArray(value.characterIndexes)
      ? Array.from(
          new Set(
            value.characterIndexes.filter(
              (index): index is number =>
                typeof index === "number" &&
                Number.isInteger(index) &&
                index >= 0 &&
                index < castSize,
            ),
          ),
        )
      : [];

    return {
      intent: typeof value.intent === "string" ? value.intent.trim() : "",
      visualPrompt:
        typeof value.visualPrompt === "string" ? value.visualPrompt.trim() : "",
      caption: typeof value.caption === "string" ? value.caption.trim() : "",
      dialogue,
      characterIndexes: indexes,
    };
  });

  return {
    synopsis: typeof parsed.synopsis === "string" ? parsed.synopsis.trim() : "",
    panels,
  };
}

export async function generatePageScript(
  deps: { createCompletion: CreateCompletion },
  input: Parameters<typeof buildPageScriptPrompt>[0],
): Promise<PageScript> {
  const { system, user } = buildPageScriptPrompt(input);

  const response = await deps.createCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.8,
    max_tokens: 1600,
    reasoning: { enabled: false },
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("No response from text generation");

  return parsePageScriptResponse(content, input.cast.length);
}

export type PageStore = {
  markStaleFrom(pageNumber: number): Promise<void>;
};

/**
 * Editing a page invalidates that page and every page after it. The store is
 * injected so this module stays free of database imports and testable in Node.
 */
export async function markPagesStaleFrom(
  pageNumber: number,
  store: PageStore,
): Promise<void> {
  await store.markStaleFrom(pageNumber);
}
