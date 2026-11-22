export const MAX_SOURCE_CHARS = 30_000;
export const MIN_USABLE_CHARS = 200;

/**
 * Collapses runs of spaces/tabs, trims each line, and folds three or more
 * newlines into a single blank line. Keeps the text readable for review.
 */
export function normalizeSource(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncateSource(
  text: string,
  limit: number = MAX_SOURCE_CHARS,
): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  return { text: text.slice(0, limit), truncated: true };
}
