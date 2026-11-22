const assert = require("node:assert/strict");
const test = require("node:test");

const { renderPanel } = require("./render-panel.ts");

const panelRow = {
  id: "p1",
  status: "pending",
  imageUrl: null,
  panel: {
    intent: "a",
    visualPrompt: "b",
    caption: "",
    dialogue: [],
    characterIndexes: [0],
  },
};

test("an already-rendered panel is skipped without calling the provider", async () => {
  let calls = 0;
  const result = await renderPanel({
    provider: {
      generate: async () => {
        calls++;
        return "https://example.test/tmp.jpg";
      },
    },
    loadPanel: async () => ({
      ...panelRow,
      status: "done",
      imageUrl: "https://example.test/panel.jpg",
    }),
    cast: [],
    stylePrompt: "noir",
    hasPreviousPage: false,
    saveImage: async () => {},
    upload: async () => "https://example.test/panel.jpg",
  });

  assert.equal(result, "skipped");
  assert.equal(calls, 0);
});

test("a pending panel is generated and saved once", async () => {
  let saved = "";
  const result = await renderPanel({
    provider: { generate: async () => "https://example.test/tmp.jpg" },
    loadPanel: async () => panelRow,
    cast: [
      {
        name: "Nora",
        role: "protagonist",
        appearance: "cheveux courts",
        portraitPrompt: "",
        portraitUrl: "https://example.test/portrait.jpg",
      },
    ],
    stylePrompt: "noir",
    hasPreviousPage: true,
    saveImage: async (url: string) => {
      saved = url;
    },
    upload: async () => "https://example.test/panel-final.jpg",
  });

  assert.equal(result, "done");
  assert.equal(saved, "https://example.test/panel-final.jpg");
});
