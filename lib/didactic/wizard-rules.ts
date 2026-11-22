export type WizardStep =
  | "source"
  | "objectives"
  | "scenario"
  | "cast"
  | "storyboard"
  | "generate";

export type WizardState = {
  step: WizardStep;
  selectedObjectives?: string[];
  scenarioId?: string;
  styleId?: string;
  castSize?: number;
  portraitsReady?: boolean;
};

/** The UI enforces the same order the API enforces server-side. */
export function canAdvance(state: WizardState): boolean {
  switch (state.step) {
    case "source":
      return true;
    case "objectives":
      return (state.selectedObjectives?.length ?? 0) > 0;
    case "scenario":
      return Boolean(state.scenarioId) && Boolean(state.styleId);
    case "cast":
      return (state.castSize ?? 0) >= 2 && state.portraitsReady === true;
    case "storyboard":
      return true;
    case "generate":
      return false;
    default:
      return false;
  }
}
