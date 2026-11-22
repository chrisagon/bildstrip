const assert = require("node:assert/strict");
const test = require("node:test");

const { layoutBubbles } = require("./pdf-layout.ts");

const cell = { width: 200, height: 160 };

function panelWith(longText: string) {
  return {
    position: 1,
    dialogue: [{ speaker: "Nora", text: longText, anchor: "left" }],
  };
}

test("a long line is split across lines instead of overflowing the bubble", () => {
  const boxes = layoutBubbles(
    [
      panelWith(
        "Ceci est une phrase vraiment très longue qui ne peut pas tenir sur une seule ligne dans une bulle de bande dessinée.",
      ),
    ],
    cell,
  );

  assert.ok(boxes[0].lines.length > 1);
  assert.ok(
    boxes[0].lines.every((line: string) => line.length <= boxes[0].maxCharsPerLine),
  );
});

test("bubbles stay inside their cell", () => {
  const boxes = layoutBubbles(
    [
      panelWith("Bonjour."),
      panelWith("Une réplique plus longue, mais raisonnable ici."),
      { position: 3, dialogue: [] },
      { position: 4, dialogue: [{ speaker: "B", text: "Court.", anchor: "right" }] },
      { position: 5, dialogue: [] },
    ],
    cell,
  );

  for (const box of boxes) {
    assert.ok(box.x >= 0);
    assert.ok(box.y >= 0);
    assert.ok(box.x + box.width <= cell.width);
    assert.ok(box.y + box.height <= cell.height);
  }
});
