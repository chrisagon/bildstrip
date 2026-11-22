const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseScenariosResponse,
  SCENARIO_TEMPLATES,
} = require("./scenarios.ts");

test("keeps three proposals and drops unknown templates", () => {
  const raw = JSON.stringify({
    scenarios: [
      {
        templateId: "investigation",
        title: "L'enquête",
        synopsis: "…",
        beats: ["a", "b", "c"],
        estimatedPages: 9,
      },
      { templateId: "inconnu", title: "X", synopsis: "…", beats: [], estimatedPages: 4 },
      { templateId: "before-after", title: "Avant", synopsis: "…", beats: ["a"], estimatedPages: 3 },
      { templateId: "mentor-apprentice", title: "Dialogue", synopsis: "…", beats: ["a"], estimatedPages: 3 },
    ],
  });

  const drafts = parseScenariosResponse(raw, SCENARIO_TEMPLATES);
  assert.equal(drafts.length, 3);
  assert.ok(drafts.every((draft: any) => draft.templateId !== "inconnu"));
});

test("recomputes page estimate instead of trusting the model", () => {
  const drafts = parseScenariosResponse(
    JSON.stringify({
      scenarios: [
        {
          templateId: "investigation",
          title: "T",
          synopsis: "S",
          beats: ["a"],
          estimatedPages: 99,
        },
      ],
    }),
    SCENARIO_TEMPLATES,
    { objectiveCount: 2 },
  );
  assert.equal(drafts[0].estimatedPages, 3);
});
