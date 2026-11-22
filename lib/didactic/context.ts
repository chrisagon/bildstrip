import type { CreateCompletion } from "../story-metadata.ts";
import type { Objective } from "./types.ts";
import { MAX_SOURCE_CHARS } from "./source.ts";

const TEXT_MODEL = "Qwen/Qwen3.5-9B";

export type ContextPromptInput = {
  sourceText: string;
  audience: string;
  mode: "document" | "demo";
  topic?: string;
};

export function buildContextPrompt(input: ContextPromptInput): {
  system: string;
  user: string;
} {
  const excerpt = input.sourceText.slice(0, MAX_SOURCE_CHARS);

  const system = [
    "Tu prépares une bande dessinée didactique de 2 à 20 planches.",
    "Extrais les notions que le lecteur doit retenir, pas les anecdotes.",
    "Chaque notion doit pouvoir être mise en scène en une ou deux planches.",
    'Réponds uniquement en JSON : {"objectives":[{"title":"...","summary":"...","sourceQuote":"..."}]}',
    "3 à 5 notions. title ≤ 80 caractères, summary ≤ 240 caractères.",
    "sourceQuote reprend la phrase du support qui fonde la notion, ou null si le contenu est inventé.",
  ].join("\n");

  const body =
    input.mode === "demo"
      ? `Sujet à vulgariser : ${input.topic ?? ""}\nPublic : ${input.audience}`
      : `Public : ${input.audience}\n\nSupport de cours :\n"""\n${excerpt}\n"""`;

  return { system, user: body.slice(0, MAX_SOURCE_CHARS) };
}

export function parseContextResponse(
  raw: string,
  options: { mode?: "document" | "demo" } = {},
): Objective[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Réponse du modèle illisible : aucun JSON.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error("Réponse du modèle illisible : JSON invalide.");
  }

  const rawList =
    typeof parsed === "object" && parsed !== null && "objectives" in parsed
      ? (parsed as { objectives?: unknown }).objectives
      : undefined;
  if (!Array.isArray(rawList)) return [];

  return rawList
    .map((entry) => {
      const value = entry as Record<string, unknown>;
      return {
        title: typeof value.title === "string" ? value.title.trim() : "",
        summary: typeof value.summary === "string" ? value.summary.trim() : "",
        sourceQuote:
          options.mode === "demo"
            ? null
            : typeof value.sourceQuote === "string" && value.sourceQuote.trim()
              ? value.sourceQuote.trim()
              : null,
      };
    })
    .filter((objective) => objective.title && objective.summary)
    .slice(0, 5);
}

export async function generateObjectives(
  deps: { createCompletion: CreateCompletion },
  input: ContextPromptInput,
): Promise<Objective[]> {
  const { system, user } = buildContextPrompt(input);

  const response = await deps.createCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_tokens: 900,
    reasoning: { enabled: false },
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("No response from text generation");

  return parseContextResponse(content, { mode: input.mode });
}
