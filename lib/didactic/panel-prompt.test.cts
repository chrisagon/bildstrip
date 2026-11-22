const assert = require("node:assert/strict");
const test = require("node:test");

const { buildPanelImagePrompt } = require("./panel-prompt.ts");

const panel = {
  intent: "montrer le geste correct",
  visualPrompt: "gros plan sur la main qui tient un verre",
  caption: "",
  dialogue: [{ speaker: "Nora", text: "Je n'avais pas vu ça.", anchor: "right" }],
  characterIndexes: [0, 1, 2],
};

const cast = [
  { name: "Nora", role: "protagonist", appearance: "cheveux courts, veste verte", portraitPrompt: "" },
  { name: "M. Basile", role: "mentor", appearance: "cinquante ans, lunettes rondes", portraitPrompt: "" },
  { name: "Le chien", role: "comic-relief", appearance: "petit chien noir", portraitPrompt: "" },
];

test("panel prompt forbids drawn text and keeps at most two portraits", () => {
  const prompt = buildPanelImagePrompt({
    panel,
    cast,
    stylePrompt: "noir",
    hasPreviousPage: false,
  });

  assert.match(prompt, /no text/i);
  assert.match(prompt, /no speech bubbles/i);
  assert.ok((prompt.match(/REFERENCE CHARACTER/g) || []).length <= 2);
});

test("states continuity without adding a third portrait", () => {
  const prompt = buildPanelImagePrompt({
    panel,
    cast,
    stylePrompt: "noir",
    hasPreviousPage: true,
  });
  assert.match(prompt, /previous page/i);
  assert.ok((prompt.match(/REFERENCE CHARACTER/g) || []).length <= 2);
});
