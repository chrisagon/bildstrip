const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeSource, truncateSource } = require("./source.ts");

test("collapses whitespace and blank lines", () => {
  assert.equal(normalizeSource("a\r\n\r\n\r\nb\t c  "), "a\n\nb c");
});

test("reports truncation instead of silently cutting", () => {
  const result = truncateSource("x".repeat(30050), 30000);
  assert.equal(result.truncated, true);
  assert.equal(result.text.length, 30000);
});

test("an empty extraction is a failure, not an empty comic", () => {
  assert.deepEqual(truncateSource(normalizeSource("")), {
    text: "",
    truncated: false,
  });
  assert.throws(() => require("./extract.ts").assertUsableText(""));
});
