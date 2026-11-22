const assert = require("node:assert/strict");
const test = require("node:test");

const { estimatePages, quoteCredits, PANELS_PER_PAGE, FREE_WEEKLY_CREDITS } =
  require("./quote.ts");

test("estimates pages from objective count, clamped to 2..20", () => {
  assert.equal(estimatePages(1), 2);
  assert.equal(estimatePages(2), 3);
  assert.equal(estimatePages(3), 5);
  assert.equal(estimatePages(40), 20);
});

test("quotes one credit per panel plus one per portrait", () => {
  assert.equal(quoteCredits(3, 2), 17);
  assert.equal(quoteCredits(2, 3), 13);
});

test("exposes the pricing constants the UI displays", () => {
  assert.equal(PANELS_PER_PAGE, 5);
  assert.equal(FREE_WEEKLY_CREDITS, 15);
});
