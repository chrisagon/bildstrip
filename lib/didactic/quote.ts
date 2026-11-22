export const PANELS_PER_PAGE = 5;
export const MIN_PAGES = 2;
export const MAX_PAGES = 20;
export const FREE_WEEKLY_CREDITS = 15;

// One notion needs about one and a half pages to be shown and resolved.
export function estimatePages(objectiveCount: number): number {
  const raw = Math.ceil(objectiveCount * 1.5);
  return Math.min(MAX_PAGES, Math.max(MIN_PAGES, raw));
}

// One credit per generated panel, plus one per generated character portrait.
export function quoteCredits(pages: number, characters: number): number {
  return pages * PANELS_PER_PAGE + characters;
}
