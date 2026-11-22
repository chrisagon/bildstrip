import type { DialogueLine } from "@/lib/didactic/types";

export function Bubble({
  line,
  anchor,
  index,
}: {
  line: DialogueLine;
  anchor: "left" | "right";
  index: number;
}) {
  return (
    <div
      className="absolute max-w-[62%] rounded-2xl border-2 border-black bg-white px-2 py-1 text-[11px] leading-tight text-black shadow"
      style={
        anchor === "right"
          ? { right: "4%", top: `${6 + index * 26}%` }
          : { left: "4%", top: `${6 + index * 26}%` }
      }
    >
      <span className="font-semibold">{line.speaker} : </span>
      {line.text}
    </div>
  );
}
