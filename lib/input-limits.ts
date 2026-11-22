import { z } from "zod";
import { COMIC_STYLES } from "./constants";
import { MAX_USER_PROMPT } from "./prompt";
import { MAX_SOURCE_CHARS } from "./didactic/source";

export const MAX_CHARACTER_IMAGES = 2;
const MAX_URL_LENGTH = 2_048;
const MAX_ID_LENGTH = 200;

const STYLE_IDS = COMIC_STYLES.map((style) => style.id) as [
  (typeof COMIC_STYLES)[number]["id"],
  ...(typeof COMIC_STYLES)[number]["id"][],
];

const idSchema = z.string().trim().min(1).max(MAX_ID_LENGTH);

const promptSchema = z.string().trim().min(1).max(MAX_USER_PROMPT);

const characterImagesSchema = z
  .array(
    z
      .string()
      .max(MAX_URL_LENGTH)
      .refine((value) => {
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      }),
  )
  .max(MAX_CHARACTER_IMAGES)
  .default([]);

export const generateComicRequestSchema = z.object({
  storyId: idSchema.optional(),
  prompt: promptSchema,
  apiKey: z.unknown().optional(),
  style: z.enum(STYLE_IDS).default("noir"),
  characterImages: characterImagesSchema,
  isContinuation: z.boolean().default(false),
  previousContext: z.string().max(MAX_USER_PROMPT).default(""),
});

export const createComicRequestSchema = z
  .object({
    kind: z.enum(["document", "demo"]),
    audience: z.string().trim().min(1).max(200),
    topic: z.string().trim().min(3).max(500).optional(),
    extractedText: z.string().max(MAX_SOURCE_CHARS).optional(),
    originalUrl: z.string().url().max(2_048).optional(),
    originalName: z.string().max(200).optional(),
    mimeType: z.string().max(100).optional(),
  })
  .refine((body) => body.kind !== "demo" || Boolean(body.topic), {
    message: "Le mode démo exige un sujet.",
    path: ["topic"],
  })
  .refine(
    (body) =>
      body.kind !== "document" ||
      Boolean(body.extractedText) ||
      Boolean(body.originalUrl),
    { message: "Un document ou son texte est requis.", path: ["originalUrl"] },
  );

export const sourceTextRequestSchema = z.object({
  text: z.string().max(MAX_SOURCE_CHARS),
});

export const addPageRequestSchema = z.object({
  storyId: idSchema,
  pageId: idSchema.optional(),
  prompt: promptSchema,
  characterImages: characterImagesSchema,
});

export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | null> {
  try {
    const result = schema.safeParse(await request.json());
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
