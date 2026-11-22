import type { DialogueLine } from "./types.ts";

export type BubblePanel = {
  position: number;
  dialogue: DialogueLine[];
};

export type BubbleBox = {
  panelPosition: number;
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
  maxCharsPerLine: number;
  anchor: "left" | "right";
};

const MARGIN = 8;
const LINE_HEIGHT = 10;
const PADDING = 6;

function splitToLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/**
 * Deterministic bubble placement for one panel cell: the same math feeds the
 * PDF and the on-screen component, so both render the same page.
 */
export function layoutBubbles(
  panels: BubblePanel[],
  cell: { width: number; height: number },
): BubbleBox[] {
  const boxes: BubbleBox[] = [];

  for (const panel of panels) {
    const lines = panel.dialogue.slice(0, 2);
    const width = Math.min(
      cell.width - MARGIN * 2,
      Math.round(cell.width * 0.62),
    );
    const maxCharsPerLine = Math.max(8, Math.floor((width - PADDING * 2) / 5.4));

    lines.forEach((line, index) => {
      const wrapped = splitToLines(line.text, maxCharsPerLine);
      const height = Math.min(
        wrapped.length * LINE_HEIGHT + PADDING * 2,
        cell.height - MARGIN * 2,
      );
      const anchor = line.anchor === "right" ? "right" : "left";
      const x = anchor === "right" ? cell.width - width - MARGIN : MARGIN;
      const y = MARGIN + index * (height + MARGIN);

      boxes.push({
        panelPosition: panel.position,
        x: Math.max(0, Math.min(x, cell.width - width)),
        y: Math.max(0, Math.min(y, cell.height - height)),
        width,
        height,
        lines: wrapped,
        maxCharsPerLine,
        anchor,
      });
    });
  }

  return boxes;
}
