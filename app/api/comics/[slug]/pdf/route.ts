import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { jsPDF } from "jspdf";
import { enforceRateLimit } from "@/lib/rate-limit";
import { layoutBubbles } from "@/lib/didactic/pdf-layout";
import {
  getComicBySlug,
  getPanelsByPage,
  getPagesForStory,
} from "@/lib/comics-actions";

// Cells are laid out in a 420x480 "text unit" space, then scaled to millimetres.
const UNIT_SCALE = 0.25;

const GRID: Record<number, { x: number; y: number; w: number; h: number }> = {
  1: { x: 5, y: 12, w: 100, h: 90 },
  2: { x: 110, y: 12, w: 95, h: 90 },
  3: { x: 5, y: 107, w: 200, h: 95 },
  4: { x: 5, y: 207, w: 100, h: 80 },
  5: { x: 110, y: 207, w: 95, h: 80 },
};

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { userId } = await auth();
    const rateLimitResponse = await enforceRateLimit("download", request, userId);
    if (rateLimitResponse) return rateLimitResponse;

    const { slug } = await params;
    const story = await getComicBySlug(slug);
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

    const token = request.nextUrl.searchParams.get("t");
    const isOwner = Boolean(userId) && story.userId === userId;
    if (
      !isOwner &&
      !(story.visibility === "unlisted" && token === story.shareToken)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const pages = (await getPagesForStory(story.id)).filter(
      (page) => page.status === "done",
    );
    if (pages.length === 0) {
      return NextResponse.json(
        { error: "Aucune planche terminée à exporter." },
        { status: 400 },
      );
    }

    const pdf = new jsPDF({ unit: "mm", format: "a4" });

    for (const [index, page] of pages.entries()) {
      if (index > 0) pdf.addPage();

      const panels = await getPanelsByPage(page.id);
      for (const panel of panels) {
        const cell = GRID[panel.position];
        if (!cell) continue;

        const image = panel.imageUrl ? await toDataUrl(panel.imageUrl) : null;
        if (image) {
          pdf.addImage(image, "JPEG", cell.x, cell.y, cell.w, cell.h);
        }

        pdf.setDrawColor(0);
        pdf.setLineWidth(0.6);
        pdf.rect(cell.x, cell.y, cell.w, cell.h);

        const boxes = layoutBubbles(
          [{ position: panel.position, dialogue: panel.dialogue }],
          { width: cell.w / UNIT_SCALE, height: cell.h / UNIT_SCALE },
        );

        pdf.setFillColor(255, 255, 255);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        for (const box of boxes) {
          const x = cell.x + box.x * UNIT_SCALE;
          const y = cell.y + box.y * UNIT_SCALE;
          const w = box.width * UNIT_SCALE;
          const h = box.height * UNIT_SCALE;
          pdf.roundedRect(x, y, w, h, 2, 2, "FD");
          box.lines.forEach((line, lineIndex) => {
            pdf.text(line, x + 1.5, y + 4 + lineIndex * 3.2, { maxWidth: w - 3 });
          });
        }
      }

      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Planche ${page.pageNumber} — Make Comics`, 105, 292, {
        align: "center",
      });

      if (story.title) {
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(story.title, 105, 8, { align: "center" });
      }
    }

    const buffer = Buffer.from(pdf.output("arraybuffer") as ArrayBuffer);
    const safeName =
      story.title
        .replace(/[^\x00-\x7F]/g, "")
        .replace(/[<>:"/\\|?*]/g, "-")
        .trim() || "bande-dessinee";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
