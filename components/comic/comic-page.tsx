import { Bubble } from "./bubble";
import type { DialogueLine } from "@/lib/didactic/types";

export type ComicPanel = {
  id: string;
  position: number;
  imageUrl: string | null;
  caption: string;
  dialogue: DialogueLine[];
};

const CELL_CLASS: Record<number, string> = {
  1: "col-start-1 col-span-3 row-start-1",
  2: "col-start-4 col-span-3 row-start-1",
  3: "col-start-1 col-span-6 row-start-2",
  4: "col-start-1 col-span-3 row-start-3",
  5: "col-start-4 col-span-3 row-start-3",
};

/**
 * Screen render of one page. The PDF uses `layoutBubbles` with the same
 * relative positions so both surfaces agree.
 */
export function ComicPage({
  pageNumber,
  panels,
}: {
  pageNumber: number;
  panels: ComicPanel[];
}) {
  return (
    <figure className="mx-auto w-full max-w-3xl">
      <div className="grid aspect-[3/4] grid-cols-6 grid-rows-[1fr_1.2fr_1fr] gap-2 bg-black p-2">
        {panels.map((panel) => (
          <div
            key={panel.id}
            className={`relative overflow-hidden bg-white ${CELL_CLASS[panel.position] ?? ""}`}
          >
            {panel.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={panel.imageUrl}
                alt={`Case ${panel.position} de la planche ${pageNumber}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Case en attente
              </div>
            )}
            {panel.dialogue.slice(0, 2).map((line, index) => (
              <Bubble
                key={`${panel.id}-${index}`}
                line={line}
                anchor={line.anchor}
                index={index}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="mt-1 text-center text-xs text-muted-foreground">
        Planche {pageNumber}
      </figcaption>
    </figure>
  );
}
