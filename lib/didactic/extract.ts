import { MIN_USABLE_CHARS, normalizeSource } from "./source.ts";

/**
 * A document whose extraction yields nothing usable must stop the pipeline:
 * an empty comic is worse than an explicit failure.
 */
export function assertUsableText(text: string): void {
  if (text.trim().length < MIN_USABLE_CHARS) {
    throw new Error("Aucun texte exploitable n'a été extrait de ce document.");
  }
}

export async function extractSourceText({
  data,
  mimeType,
  filename,
}: {
  data: Buffer;
  mimeType: string;
  filename: string;
}): Promise<string> {
  const isPdf =
    mimeType === "application/pdf" ||
    filename.toLowerCase().endsWith(".pdf");

  if (!isPdf) return normalizeSource(data.toString("utf8"));

  // Loaded lazily: keeps the PDF engine out of every other code path.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  return normalizeSource(text);
}
