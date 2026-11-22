const assert = require("node:assert/strict");
const test = require("node:test");

const { composePage } = require("./compose-page.ts");

const panel = (status: string) => ({ status });

test("a page with a missing panel is never marked done", async () => {
  let marked: string | null = null;
  const result = await composePage({
    loadPanels: async () => [
      panel("done"),
      panel("done"),
      panel("done"),
      panel("done"),
      panel("pending"),
    ],
    markPage: async (status: string) => {
      marked = status;
    },
  });

  assert.equal(result, "waiting");
  assert.equal(marked, null);
});

test("a page is done only when all five panels rendered", async () => {
  let marked: string | null = null;
  const result = await composePage({
    loadPanels: async () => Array.from({ length: 5 }, () => panel("done")),
    markPage: async (status: string) => {
      marked = status;
    },
  });

  assert.equal(result, "done");
  assert.equal(marked, "done");
});

test("a settled page with a failed panel is reported as failed", async () => {
  const result = await composePage({
    loadPanels: async () => [
      panel("done"),
      panel("done"),
      panel("failed"),
      panel("done"),
      panel("done"),
    ],
    markPage: async () => {},
  });

  assert.equal(result, "failed");
});
