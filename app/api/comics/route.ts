import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createComicRequestSchema, parseJsonBody } from "@/lib/input-limits";
import { createComicDraft } from "@/lib/comics-actions";
import { extractSourceText } from "@/lib/didactic/extract";

// Only our own bucket may be fetched server-side: the URL comes from the client.
function isOwnBucketUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const bucket = process.env.S3_UPLOAD_BUCKET;
    const region = process.env.S3_UPLOAD_REGION ?? "us-east-1";
    return Boolean(bucket) && url.hostname === `${bucket}.s3.${region}.amazonaws.com`;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit("write", request, userId);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await parseJsonBody(request, createComicRequestSchema);
    if (!body) {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    let sourceText = body.extractedText ?? "";

    if (body.kind === "document" && !sourceText) {
      if (!body.originalUrl || !isOwnBucketUrl(body.originalUrl)) {
        return NextResponse.json(
          { error: "Document introuvable dans notre stockage." },
          { status: 400 },
        );
      }
      try {
        const response = await fetch(body.originalUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = Buffer.from(await response.arrayBuffer());
        sourceText = await extractSourceText({
          data,
          mimeType: body.mimeType ?? "",
          filename: body.originalName ?? "",
        });
      } catch (error) {
        console.error("Source extraction failed:", error);
        return NextResponse.json(
          { error: "Aucun texte exploitable n'a été extrait de ce document." },
          { status: 400 },
        );
      }
    }

    const story = await createComicDraft({
      userId,
      kind: body.kind,
      audience: body.audience,
      topic: body.topic,
      sourceText,
      originalUrl: body.originalUrl,
      originalName: body.originalName,
      mimeType: body.mimeType,
    });

    return NextResponse.json({ slug: story.slug }, { status: 201 });
  } catch (error) {
    console.error("Error creating comic draft:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
