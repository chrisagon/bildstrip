export type ComicStatus =
  | "draft"
  | "context_ready"
  | "cast_ready"
  | "script_ready"
  | "generating"
  | "done"
  | "failed";

export type Objective = {
  title: string;
  summary: string;
  sourceQuote: string | null;
};

export type CastRole = "protagonist" | "foil" | "mentor" | "comic-relief";

export type CastMember = {
  name: string;
  role: CastRole;
  /** Short, stable physical description, reused verbatim in every prompt. */
  appearance: string;
  portraitPrompt: string;
};

export type DialogueAnchor = "left" | "right";

export type DialogueLine = {
  speaker: string;
  text: string;
  anchor: DialogueAnchor;
};

export type PanelDraft = {
  intent: string;
  visualPrompt: string;
  caption: string;
  dialogue: DialogueLine[];
  /** Indexes into the story cast; at most two portraits are sent per panel. */
  characterIndexes: number[];
};

/** A page script always holds exactly PANELS_PER_PAGE panels. */
export type PageScript = {
  synopsis: string;
  panels: PanelDraft[];
};

export type ScenarioTemplate = {
  id: string;
  name: string;
  shape: string;
  bestFor: string;
  beats: string[];
};

export type ScenarioDraft = {
  templateId: string;
  title: string;
  synopsis: string;
  beats: string[];
  estimatedPages: number;
};

export const PANEL_STATUSES = [
  "pending",
  "generating",
  "done",
  "failed",
  "stale",
] as const;

export type PanelStatus = (typeof PANEL_STATUSES)[number];
