import type { CreateCompletion } from "../story-metadata.ts";
import { estimatePages, MAX_PAGES, MIN_PAGES } from "./quote.ts";
import { SCENARIO_TEMPLATES } from "./templates.ts";
import type { Objective, ScenarioDraft, ScenarioTemplate } from "./types.ts";

const TEXT_MODEL = "Qwen/Qwen3.5-9B";

export { SCENARIO_TEMPLATES };

export function buildScenariosPrompt(input: {
  objectives: Objective[];
  templates: ScenarioTemplate[];
}): { system: string; user: string } {
  const system = [
    "Tu conçois le récit d'une bande dessinée didactique.",
    "Choisis trois structures différentes parmi la bibliothèque fournie et adapte-les aux notions.",
    'Réponds uniquement en JSON : {"scenarios":[{"templateId":"...","title":"...","synopsis":"...","beats":["..."],"estimatedPages":3}]}',
    "title ≤ 80 caractères, synopsis ≤ 300 caractères, 4 à 10 beats par proposition.",
    "templateId doit être exactement l'un des identifiants fournis.",
  ].join("\n");

  const templates = input.templates
    .map((template) =>
      [
        `- ${template.id} (${template.name}) : ${template.shape}`,
        `  pour : ${template.bestFor}`,
        `  étapes : ${template.beats.join(" | ")}`,
      ].join("\n"),
    )
    .join("\n");

  const notions = input.objectives
    .map((objective, index) => `${index + 1}. ${objective.title} — ${objective.summary}`)
    .join("\n");

  return {
    system,
    user: `Notions à faire comprendre :\n${notions}\n\nBibliothèque de structures :\n${templates}`,
  };
}

function clampPages(value: unknown): number {
  const numeric =
    typeof value === "number" && Number.isFinite(value)
      ? Math.round(value)
      : MIN_PAGES;
  return Math.min(MAX_PAGES, Math.max(MIN_PAGES, numeric));
}

export function parseScenariosResponse(
  raw: string,
  templates: ScenarioTemplate[],
  options: { objectiveCount?: number } = {},
): ScenarioDraft[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Réponse du modèle illisible : aucun JSON.");

  const parsed = JSON.parse(match[0]) as { scenarios?: unknown };
  if (!Array.isArray(parsed.scenarios)) return [];

  const known = new Set(templates.map((template) => template.id));
  const pages =
    typeof options.objectiveCount === "number"
      ? estimatePages(options.objectiveCount)
      : null;

  return parsed.scenarios
    .map((entry) => {
      const value = entry as Record<string, unknown>;
      const templateId = typeof value.templateId === "string" ? value.templateId : "";
      return {
        templateId,
        title: typeof value.title === "string" ? value.title.trim() : "",
        synopsis: typeof value.synopsis === "string" ? value.synopsis.trim() : "",
        beats: Array.isArray(value.beats)
          ? value.beats
              .filter((beat): beat is string => typeof beat === "string")
              .slice(0, 10)
          : [],
        estimatedPages: pages ?? clampPages(value.estimatedPages),
      };
    })
    .filter(
      (draft) =>
        known.has(draft.templateId) &&
        draft.title.length > 0 &&
        draft.synopsis.length > 0,
    )
    .slice(0, 3);
}

export async function generateScenarios(
  deps: { createCompletion: CreateCompletion },
  input: { objectives: Objective[]; templates?: ScenarioTemplate[] },
): Promise<ScenarioDraft[]> {
  const templates = input.templates ?? SCENARIO_TEMPLATES;
  const { system, user } = buildScenariosPrompt({
    objectives: input.objectives,
    templates,
  });

  const response = await deps.createCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
    max_tokens: 1200,
    reasoning: { enabled: false },
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("No response from text generation");

  return parseScenariosResponse(content, templates, {
    objectiveCount: input.objectives.length,
  });
}
