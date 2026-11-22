const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parsePageScriptResponse,
  markPagesStaleFrom,
} = require("./storyboard.ts");

function pageFixture(patch: Record<string, unknown> = {}) {
  return JSON.stringify({
    synopsis: "Nora découvre…",
    panels: [
      {
        intent: "a",
        visualPrompt: "b",
        caption: "",
        dialogue: [{ speaker: "Nora", text: "Hein ?", anchor: "left" }],
        characterIndexes: [0],
        ...patch,
      },
    ],
  });
}

test("always yields exactly five panels", () => {
  assert.throws(() => parsePageScriptResponse(pageFixture(), 2));
});

test("clamps character indexes to the cast", () => {
  const raw = JSON.stringify({
    synopsis: "x",
    panels: Array.from({ length: 5 }, () => ({
      intent: "a",
      visualPrompt: "b",
      caption: "",
      dialogue: [],
      characterIndexes: [0, 7],
    })),
  });
  const page = parsePageScriptResponse(raw, 2);
  assert.deepEqual(page.panels[0].characterIndexes, [0]);
});

test("normalizes anchors", () => {
  const raw = JSON.stringify({
    synopsis: "x",
    panels: Array.from({ length: 5 }, () => ({
      intent: "a",
      visualPrompt: "b",
      caption: "",
      dialogue: [{ speaker: "Nora", text: "…", anchor: "center" }],
      characterIndexes: [],
    })),
  });
  const page = parsePageScriptResponse(raw, 2);
  assert.equal(page.panels[0].dialogue[0].anchor, "left");
});

test("editing a rendered page marks it stale instead of leaving stale images valid", async () => {
  const pages = new Map([
    [1, { status: "done" }],
    [2, { status: "done" }],
  ]);
  const store = {
    async markStaleFrom(pageNumber: number) {
      for (const [number, page] of pages) {
        if (number >= pageNumber) page.status = "stale";
      }
    },
  };

  await markPagesStaleFrom(2, store);

  assert.equal(pages.get(1)?.status, "done");
  assert.equal(pages.get(2)?.status, "stale");
});
