const assert = require("node:assert/strict");
const test = require("node:test");

const { canAdvance } = require("./wizard-rules.ts");

test("the wizard refuses to move on without a selected objective", () => {
  assert.equal(canAdvance({ step: "objectives", selectedObjectives: [] }), false);
  assert.equal(canAdvance({ step: "objectives", selectedObjectives: ["a"] }), true);
});

test("the storyboard step needs a validated cast", () => {
  assert.equal(
    canAdvance({ step: "cast", castSize: 0, portraitsReady: false }),
    false,
  );
  assert.equal(
    canAdvance({ step: "cast", castSize: 2, portraitsReady: true }),
    true,
  );
});

test("a scenario and a style are both required before generating", () => {
  assert.equal(
    canAdvance({ step: "scenario", scenarioId: "s1", styleId: "noir" }),
    true,
  );
  assert.equal(canAdvance({ step: "scenario", scenarioId: "s1" }), false);
});
