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

test("resuming a comic lands on the step its status implies", () => {
  const { stepFromStatus } = require("./wizard-rules.ts");
  assert.equal(stepFromStatus("draft"), "source");
  assert.equal(stepFromStatus("context_ready"), "objectives");
  assert.equal(stepFromStatus("cast_ready"), "cast");
  assert.equal(stepFromStatus("script_ready"), "storyboard");
  assert.equal(stepFromStatus("generating"), "generate");
  assert.equal(stepFromStatus("done"), "generate");
  assert.equal(stepFromStatus("failed"), "storyboard");
});
