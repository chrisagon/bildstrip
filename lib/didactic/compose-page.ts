import { PANELS_PER_PAGE } from "./quote.ts";

export type ComposeResult = "done" | "failed" | "waiting";

/**
 * A page is done only when every panel rendered. A partially rendered page is
 * `waiting`, never `done`: showing a page with missing panels would be a
 * silent failure the reader cannot see.
 */
export async function composePage(deps: {
  loadPanels: () => Promise<Array<{ status: string }>>;
  markPage: (status: "done" | "failed") => Promise<void>;
}): Promise<ComposeResult> {
  const panels = await deps.loadPanels();

  if (
    panels.some(
      (panel) => panel.status === "pending" || panel.status === "generating",
    )
  ) {
    return "waiting";
  }

  if (
    panels.length !== PANELS_PER_PAGE ||
    panels.some((panel) => panel.status !== "done")
  ) {
    await deps.markPage("failed");
    return "failed";
  }

  await deps.markPage("done");
  return "done";
}
