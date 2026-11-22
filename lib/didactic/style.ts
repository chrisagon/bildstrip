import type { CreateCompletion } from "../story-metadata.ts";
import { COMIC_STYLES } from "../constants.ts";

const TEXT_MODEL = "Qwen/Qwen3.5-9B";

/** Keeps at most three known style ids; a broken answer falls back to the library order. */
export function parseStyleRanking(raw: string, allowed: string[]): string[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return allowed.slice(0, 3);

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return allowed.slice(0, 3);
  }

  const list =
    typeof parsed === "object" && parsed !== null && "styles" in parsed
      ? (parsed as { styles?: unknown }).styles
      : undefined;
  if (!Array.isArray(list)) return allowed.slice(0, 3);

  const seen = new Set<string>();
  const ranked: string[] = [];
  for (const entry of list) {
    if (typeof entry !== "string" || !allowed.includes(entry) || seen.has(entry)) continue;
    seen.add(entry);
    ranked.push(entry);
    if (ranked.length === 3) break;
  }

  return ranked.length > 0 ? ranked : allowed.slice(0, 3);
}

export async function rankStyles(
  tone: string,
  createCompletion: CreateCompletion,
): Promise<string[]> {
  const allowed = COMIC_STYLES.map((style) => style.id);
  const catalogue = COMIC_STYLES.map(
    (style) => `- ${style.id} : ${style.name} — ${style.prompt}`,
  ).join("\n");

  const response = await createCompletion({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "Tu choisis un style graphique pour une bande dessinée didactique imprimée.",
          "Privilégie la lisibilité en petit format et à l'impression.",
          'Réponds uniquement en JSON : {"styles":["id1","id2","id3"]}',
          "Choisis exactement trois identifiants parmi la liste fournie, du plus au moins adapté.",
        ].join("\n"),
      },
      {
        role: "user",
        content: `Ton du support : ${tone}\n\nStyles disponibles :\n${catalogue}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 120,
    reasoning: { enabled: false },
  });

  const content = response.choices[0]?.message?.content?.trim() ?? "";
  return parseStyleRanking(content, allowed);
}
