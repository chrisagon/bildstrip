const assert = require("node:assert/strict");
const test = require("node:test");

const { parseStyleRanking } = require("./style.ts");

const ALLOWED = ["american-modern", "manga", "noir", "vintage"];

test("keeps only known styles, three at most", () => {
  const ranked = parseStyleRanking(
    JSON.stringify({ styles: ["manga", "inconnu", "noir", "vintage", "manga"] }),
    ALLOWED,
  );
  assert.deepEqual(ranked, ["manga", "noir", "vintage"]);
});

test("falls back to the first allowed styles when the answer is empty", () => {
  assert.deepEqual(parseStyleRanking("pas de json", ALLOWED), [
    "american-modern",
    "manga",
    "noir",
  ]);
});
